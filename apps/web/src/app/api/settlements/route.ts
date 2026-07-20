import { NextResponse } from "next/server";
import { getSettlements } from "@/lib/data";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/security/ratelimit";

// The live-feed poll target. Never cached: the in-memory ledger moves as
// settlements are recorded during the session, and the feed must see it.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const rl = rateLimit(`settlements:${clientIp(req)}`, 120, 60_000);
  if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

  // Clamp before the ledger sees it: unbounded limits force full-list reads,
  // and negative values would invert the Redis LRANGE window.
  const raw = new URL(req.url).searchParams.get("limit");
  const n = raw ? Math.trunc(Number(raw)) : NaN;
  const limit = Number.isFinite(n) ? Math.min(100, Math.max(1, n)) : 16;

  return NextResponse.json({ settlements: await getSettlements(limit) });
}
