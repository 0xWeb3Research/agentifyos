// The settlement ledger: the record of payments that actually happened.
//
// Backed by Redis when REDIS_URL is set (Railway provides one), so real
// settlements survive restarts and deploys. Falls back to an in-process array
// for local dev with no Redis running, which keeps `pnpm dev` zero-infra.
//
// Real and mock settlements live in separate lists with separate caps, so a
// flood of free mock calls can never evict real on-chain records. The real
// list is the financial audit trail, the mock list is demo exhaust.
//
// This is what makes the dashboard honest: it reads only from here, so the
// numbers on screen are payments that genuinely settled on Casper.
import type { Settlement } from "../types";

const KEYS = {
  real: "agentifyos:settlements:real",
  mock: "agentifyos:settlements:mock",
} as const;
const CAPS = { real: 5000, mock: 500 } as const;
type Lane = keyof typeof KEYS;

// Pre-split single-list key; cleared alongside the lanes by clearLedger.
const LEGACY_KEY = "agentifyos:settlements";

function laneOf(s: Settlement): Lane {
  return s.mode === "real" ? "real" : "mock";
}

// Survives Next's dev hot-reload, which would otherwise leak clients. The
// "V2" key avoids colliding with the pre-split single-array shape across a
// hot-reload boundary.
const g = globalThis as unknown as {
  __agentifyLedgerV2?: Record<Lane, Settlement[]>;
  __agentifyRedis?: Promise<RedisLike | null>;
};

type RedisLike = {
  lPush(key: string, value: string): Promise<number>;
  lTrim(key: string, start: number, stop: number): Promise<unknown>;
  lRange(key: string, start: number, stop: number): Promise<string[]>;
  del(key: string): Promise<number>;
};

const memory = (g.__agentifyLedgerV2 ??= { real: [], mock: [] });

async function redis(): Promise<RedisLike | null> {
  if (!process.env.REDIS_URL) return null;
  g.__agentifyRedis ??= (async () => {
    try {
      const { createClient } = await import("redis");
      const client = createClient({ url: process.env.REDIS_URL });
      // Never let a Redis hiccup take down a payment path.
      client.on("error", (e: unknown) =>
        console.error("[ledger] redis error:", e instanceof Error ? e.message : e),
      );
      await client.connect();
      return client as unknown as RedisLike;
    } catch (e) {
      console.warn(
        "[ledger] WARN: redis unavailable; ledger degraded to per-process memory:",
        e instanceof Error ? e.message : e,
      );
      return null;
    }
  })();
  return g.__agentifyRedis;
}

// Guard against caller-supplied limits inverting or exploding the LRANGE
// window (negative Redis indices count from the end of the list).
function saneLimit(limit: number, fallback: number): number {
  return Number.isInteger(limit) && limit > 0 ? Math.min(limit, CAPS.real) : fallback;
}

/** Append a settlement. Never throws: a ledger failure must not fail a payment. */
export async function appendSettlement(s: Settlement): Promise<void> {
  const lane = laneOf(s);
  memory[lane].unshift(s);
  if (memory[lane].length > CAPS[lane]) memory[lane].pop();
  try {
    const r = await redis();
    if (r) {
      await r.lPush(KEYS[lane], JSON.stringify(s));
      await r.lTrim(KEYS[lane], 0, CAPS[lane] - 1);
    }
  } catch (e) {
    console.warn(
      `[ledger] WARN: redis append failed; ${lane} settlement ${s.id} held in process memory only:`,
      e instanceof Error ? e.message : e,
    );
  }
}

/**
 * Read one lane, newest first. On Redis failure this degrades (loudly) to
 * process memory, which only ever holds genuinely appended settlements. It
 * never substitutes seeded demo fixtures; an empty lane comes back empty.
 */
async function readLane(lane: Lane, limit: number): Promise<Settlement[]> {
  try {
    const r = await redis();
    if (r) {
      const raw = await r.lRange(KEYS[lane], 0, limit - 1);
      const parsed = raw
        .map((x) => {
          try {
            return JSON.parse(x) as Settlement;
          } catch {
            return null;
          }
        })
        .filter((x): x is Settlement => x !== null);
      if (parsed.length) return parsed;
    }
  } catch (e) {
    console.warn(
      `[ledger] WARN: redis read failed; serving ${lane} settlements from process memory:`,
      e instanceof Error ? e.message : e,
    );
  }
  return memory[lane].slice(0, limit);
}

/** Newest first, both lanes merged. */
export async function readSettlements(limit = 50): Promise<Settlement[]> {
  const n = saneLimit(limit, 50);
  const [real, mock] = await Promise.all([readLane("real", n), readLane("mock", n)]);
  return [...real, ...mock]
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
    .slice(0, n);
}

/**
 * Only payments that actually settled on-chain. Reads the real lane directly,
 * so mock volume can never push real records out of the window.
 */
export async function readRealSettlements(limit = 200): Promise<Settlement[]> {
  const n = saneLimit(limit, 200);
  // Headroom because failed/pending real attempts share the lane.
  const lane = await readLane("real", Math.max(n, 200));
  return lane.filter((s) => s.status === "settled").slice(0, n);
}

export interface LedgerTotals {
  count: number;
  volumeUsd: number;
  distinctPayers: number;
  distinctTools: number;
  firstAt: string | null;
  lastAt: string | null;
}

export function totalsOf(settlements: Settlement[]): LedgerTotals {
  const times = settlements.map((s) => s.createdAt).sort();
  return {
    count: settlements.length,
    volumeUsd: +settlements.reduce((a, s) => a + s.amountUsd, 0).toFixed(4),
    distinctPayers: new Set(settlements.map((s) => s.payer)).size,
    distinctTools: new Set(settlements.map((s) => s.toolSlug)).size,
    firstAt: times[0] ?? null,
    lastAt: times[times.length - 1] ?? null,
  };
}

export interface ToolEarnings {
  toolSlug: string;
  toolName: string;
  calls: number;
  grossUsd: number;
  /** what the publisher keeps after the platform fee */
  netUsd: number;
  lastAt: string;
}

export function earningsByTool(settlements: Settlement[], platformFee: number): ToolEarnings[] {
  const by = new Map<string, ToolEarnings>();
  for (const s of settlements) {
    const cur = by.get(s.toolSlug) ?? {
      toolSlug: s.toolSlug,
      toolName: s.toolName,
      calls: 0,
      grossUsd: 0,
      netUsd: 0,
      lastAt: s.createdAt,
    };
    cur.calls += 1;
    cur.grossUsd = +(cur.grossUsd + s.amountUsd).toFixed(4);
    cur.netUsd = +(cur.grossUsd * (1 - platformFee)).toFixed(4);
    if (s.createdAt > cur.lastAt) cur.lastAt = s.createdAt;
    by.set(s.toolSlug, cur);
  }
  return [...by.values()].sort((a, b) => b.grossUsd - a.grossUsd);
}

/** Test/ops helper. */
export async function clearLedger(): Promise<void> {
  memory.real.length = 0;
  memory.mock.length = 0;
  const r = await redis();
  if (r) await Promise.all([r.del(KEYS.real), r.del(KEYS.mock), r.del(LEGACY_KEY)]);
}
