import { AGENT_MAX_SPEND_USD } from "../config";
import { getRedis } from "../store/redis";

// Resolve a client-supplied spend budget into a value that can never exceed the
// server cap. This is the single choke point every server-initiated paid loop
// (agent runner, MCP call_tool) funnels its budget through.
//
// The old code did `budgetUsd ?? 0.1` and gated on `typeof budget === "number"`,
// so omitting the field (null/undefined) or sending a non-number disabled the
// gate entirely. Here every non-positive or non-finite input collapses to 0 and
// a missing budget defaults to the cap. The returned number is always a finite
// value in [0, AGENT_MAX_SPEND_USD].
export function resolveSpendBudget(clientBudgetUsd: unknown): number {
  const cap =
    Number.isFinite(AGENT_MAX_SPEND_USD) && AGENT_MAX_SPEND_USD > 0
      ? AGENT_MAX_SPEND_USD
      : 0.1;
  if (clientBudgetUsd === null || clientBudgetUsd === undefined) return cap;
  const n =
    typeof clientBudgetUsd === "number" ? clientBudgetUsd : Number(clientBudgetUsd);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(n, cap);
}

// ── the daily demo allowance, per chain ─────────────────────────────────────
//
// Per-IP rate limiting bounds how fast one client can spend, but not how much a
// wallet can lose in a day: an attacker with a handful of IPs, or just
// patience, drains it anyway. This is the cap that actually protects the funded
// wallets behind the public demos.
//
// Every chain gets its own allowance because they are not comparable. Algorand
// and Casper spend real value and are metered in dollars. Midnight spends DUST,
// which regenerates from held NIGHT and is worth nothing, so the thing worth
// bounding there is transaction volume rather than a price.
//
// Spend is reserved BEFORE the work runs, at the maximum the run could cost. A
// run that spends less does not get the difference back: the alternative is
// discovering a wallet is empty in front of an audience.

export type SpendChain = "algorand" | "casper" | "midnight";

export type SpendUnit = "usd" | "tx";

export interface SpendStatus {
  chain: SpendChain;
  /** False means the cap is switched off: usage is still counted, never refused. */
  enabled: boolean;
  unit: SpendUnit;
  spent: number;
  cap: number;
  remaining: number;
  /** Whether the amount asked for was allowed. */
  ok: boolean;
  day: string;
}

const num = (value: string | undefined, fallback: number): number => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

/**
 * The master switch. Set DEMO_SPEND_LIMIT_ENABLED=false to let the demos run
 * uncapped, which is reasonable on a private deployment and reckless on a
 * public one. Anything other than an explicit "false" leaves the cap on, so a
 * typo fails closed.
 */
export const spendLimitEnabled = (): boolean =>
  (process.env.DEMO_SPEND_LIMIT_ENABLED ?? "true").trim().toLowerCase() !== "false";

const LIMITS: Record<SpendChain, { unit: SpendUnit; cap: () => number }> = {
  algorand: {
    unit: "usd",
    cap: () => num(process.env.DEMO_DAILY_CAP_ALGORAND_USD ?? process.env.DEMO_DAILY_USD_CAP, 2),
  },
  casper: {
    unit: "usd",
    cap: () => num(process.env.DEMO_DAILY_CAP_CASPER_USD ?? process.env.DEMO_DAILY_USD_CAP, 2),
  },
  midnight: {
    // Transactions, not dollars: DUST has no price and regenerates on its own.
    unit: "tx",
    cap: () => num(process.env.DEMO_DAILY_CAP_MIDNIGHT_TX, 60),
  },
};

const g = globalThis as unknown as { __agentifyDemoSpend?: Map<string, number> };
const local = (g.__agentifyDemoSpend ??= new Map());

const today = (): string => new Date().toISOString().slice(0, 10);
const keyFor = (chain: SpendChain, day: string) => `agentifyos:demo-spend:${chain}:${day}`;

const build = (
  chain: SpendChain,
  spent: number,
  cap: number,
  ok: boolean,
  day: string,
): SpendStatus => ({
  chain,
  enabled: spendLimitEnabled(),
  unit: LIMITS[chain].unit,
  spent: Math.max(0, Number(spent.toFixed(6))),
  cap,
  remaining: Math.max(0, Number((cap - spent).toFixed(6))),
  ok,
  day,
});

/**
 * Reserve `amount` against today's allowance for `chain`.
 *
 * Redis-backed so the cap holds across instances and restarts. Without Redis it
 * degrades to per-process, which is weaker but still bounded, and that is
 * better than failing open.
 */
export async function reserveSpend(chain: SpendChain, amount: number): Promise<SpendStatus> {
  const day = today();
  const cap = LIMITS[chain].cap();
  const enabled = spendLimitEnabled();
  const asked = Number.isFinite(amount) && amount > 0 ? amount : 0;

  const c = await getRedis();
  if (c) {
    try {
      const total = Number(await c.incrByFloat(keyFor(chain, day), asked));
      // 48h TTL so yesterday's key disappears without a sweep.
      await c.expire(keyFor(chain, day), 172_800).catch(() => {});
      const over = total > cap;
      if (over && enabled) {
        // Give back what was refused, so a rejected request does not permanently
        // consume allowance that was never actually spent.
        await c.incrByFloat(keyFor(chain, day), -asked).catch(() => {});
        return build(chain, total - asked, cap, false, day);
      }
      return build(chain, total, cap, true, day);
    } catch {
      /* fall through to the in-process counter */
    }
  }

  const k = `${chain}:${day}`;
  const spent = local.get(k) ?? 0;
  if (spent + asked > cap && enabled) return build(chain, spent, cap, false, day);
  local.set(k, spent + asked);
  return build(chain, spent + asked, cap, true, day);
}

/** Today's usage without reserving anything, for status displays. */
export async function readSpend(chain: SpendChain): Promise<SpendStatus> {
  const day = today();
  const cap = LIMITS[chain].cap();

  const c = await getRedis();
  if (c) {
    try {
      const raw = await c.get(keyFor(chain, day));
      const spent = Number(raw ?? 0);
      return build(chain, Number.isFinite(spent) ? spent : 0, cap, true, day);
    } catch {
      /* fall through */
    }
  }
  return build(chain, local.get(`${chain}:${day}`) ?? 0, cap, true, day);
}

export interface DemoBudget {
  ok: boolean;
  spentUsd: number;
  capUsd: number;
}

/** Back-compat wrapper for the dollar-metered chains. */
export async function reserveDemoSpend(usd: number, chain: SpendChain = "algorand"): Promise<DemoBudget> {
  const s = await reserveSpend(chain, usd);
  return { ok: s.ok, spentUsd: s.spent, capUsd: s.cap };
}
