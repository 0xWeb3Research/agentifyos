import { AGENT_MAX_SPEND_USD } from "../config";

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

// ── open-demo budget ────────────────────────────────────────────────────────
// Per-IP rate limiting bounds how fast one client can spend, but not how much
// the wallet can lose in a day: an attacker with a handful of IPs, or just
// patience, drains it anyway. When ALLOW_UNAUTH_SPEND is on, this is the cap
// that actually protects the funded wallet.
//
// Reserves the run's MAXIMUM possible spend before the run starts. A run that
// ends up spending less does not get the difference back — deliberately
// conservative, because the alternative is discovering the wallet is empty
// during a demo.
const DEMO_DAILY_USD_CAP = (() => {
  const n = Number(process.env.DEMO_DAILY_USD_CAP);
  return Number.isFinite(n) && n > 0 ? n : 2;
})();

type Counter = { incrByFloat(k: string, v: number): Promise<string>; expire(k: string, s: number): Promise<unknown> };
const g = globalThis as unknown as {
  __agentifyDemoSpend?: Map<string, number>;
  __agentifyDemoRedis?: Promise<Counter | null>;
};
const local = (g.__agentifyDemoSpend ??= new Map());

async function counter(): Promise<Counter | null> {
  if (!process.env.REDIS_URL) return null;
  g.__agentifyDemoRedis ??= (async () => {
    try {
      const { createClient } = await import("redis");
      const c = createClient({ url: process.env.REDIS_URL });
      c.on("error", () => {});
      await c.connect();
      return c as unknown as Counter;
    } catch {
      return null; // fall back to per-process accounting
    }
  })();
  return g.__agentifyDemoRedis;
}

export interface DemoBudget {
  ok: boolean;
  spentUsd: number;
  capUsd: number;
}

/**
 * Reserve `usd` against today's open-demo allowance.
 *
 * Redis-backed so the cap holds across instances and restarts; without Redis it
 * degrades to per-process, which is weaker but still bounded.
 */
export async function reserveDemoSpend(usd: number): Promise<DemoBudget> {
  const day = new Date().toISOString().slice(0, 10);
  const key = `agentifyos:demo-spend:${day}`;
  const cap = DEMO_DAILY_USD_CAP;

  const c = await counter();
  if (c) {
    try {
      const total = Number(await c.incrByFloat(key, usd));
      // 48h TTL so the key disappears on its own without a sweep.
      await c.expire(key, 172_800).catch(() => {});
      if (total > cap) return { ok: false, spentUsd: total - usd, capUsd: cap };
      return { ok: true, spentUsd: total, capUsd: cap };
    } catch {
      /* fall through to memory */
    }
  }

  const spent = local.get(day) ?? 0;
  if (spent + usd > cap) return { ok: false, spentUsd: spent, capUsd: cap };
  local.set(day, spent + usd);
  return { ok: true, spentUsd: spent + usd, capUsd: cap };
}
