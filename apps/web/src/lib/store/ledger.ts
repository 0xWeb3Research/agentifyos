// The settlement ledger — the record of payments that actually happened.
//
// Backed by Redis when REDIS_URL is set (Railway provides one), so real
// settlements survive restarts and deploys. Falls back to an in-process array
// for local dev with no Redis running, which keeps `pnpm dev` zero-infra.
//
// This is what makes the dashboard honest: it reads only from here, so the
// numbers on screen are payments that genuinely settled on Casper.
import type { Settlement } from "../types";

const KEY = "agentifyos:settlements";
const MAX = 1000;

// Survives Next's dev hot-reload, which would otherwise leak clients.
const g = globalThis as unknown as {
  __agentifyLedger?: Settlement[];
  __agentifyRedis?: Promise<RedisLike | null>;
};

type RedisLike = {
  lPush(key: string, value: string): Promise<number>;
  lTrim(key: string, start: number, stop: number): Promise<unknown>;
  lRange(key: string, start: number, stop: number): Promise<string[]>;
  del(key: string): Promise<number>;
};

const memory: Settlement[] = (g.__agentifyLedger ??= []);

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
      console.error("[ledger] redis unavailable, using memory:", e instanceof Error ? e.message : e);
      return null;
    }
  })();
  return g.__agentifyRedis;
}

/** Append a settlement. Never throws — a ledger failure must not fail a payment. */
export async function appendSettlement(s: Settlement): Promise<void> {
  memory.unshift(s);
  if (memory.length > MAX) memory.pop();
  try {
    const r = await redis();
    if (r) {
      await r.lPush(KEY, JSON.stringify(s));
      await r.lTrim(KEY, 0, MAX - 1);
    }
  } catch (e) {
    console.error("[ledger] append failed:", e instanceof Error ? e.message : e);
  }
}

/** Newest first. */
export async function readSettlements(limit = 50): Promise<Settlement[]> {
  try {
    const r = await redis();
    if (r) {
      const raw = await r.lRange(KEY, 0, limit - 1);
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
    console.error("[ledger] read failed:", e instanceof Error ? e.message : e);
  }
  return memory.slice(0, limit);
}

/** Only payments that actually settled on-chain. */
export async function readRealSettlements(limit = 200): Promise<Settlement[]> {
  const all = await readSettlements(Math.max(limit, 200));
  return all.filter((s) => s.mode === "real" && s.status === "settled").slice(0, limit);
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
  memory.length = 0;
  const r = await redis();
  if (r) await r.del(KEY);
}
