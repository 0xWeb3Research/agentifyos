import { NextResponse } from "next/server";

// Minimal in-process fixed-window rate limiter. It is NOT distributed and the
// client key is derived from proxy headers (spoofable by anyone who can set
// X-Forwarded-For directly), so it is a speed bump, not an authz boundary; it
// exists to blunt trivial abuse of the unauthenticated money/compute and auth
// endpoints on a single instance. For multi-instance or hostile traffic, move
// this to Redis and a trusted client identifier.
//
// Keyed on globalThis so Next's dev hot-reload doesn't reset every window.
const g = globalThis as unknown as {
  __rlBuckets?: Map<string, { count: number; resetAt: number }>;
};
const buckets = (g.__rlBuckets ??= new Map());

/** Best-effort client identifier from the standard proxy headers. */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim() || "unknown";
  return req.headers.get("x-real-ip") ?? "unknown";
}

export interface RateLimitResult {
  ok: boolean;
  retryAfterSec: number;
}

/**
 * Consume one token from a fixed window. Returns `{ ok: false }` with a
 * retry-after hint once `limit` requests have been seen inside `windowMs`.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    // Opportunistically evict expired buckets so the map can't grow unbounded
    // under a spray of distinct keys.
    if (buckets.size > 10_000) {
      for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
    }
    return { ok: true, retryAfterSec: 0 };
  }
  if (b.count >= limit) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) };
  }
  b.count += 1;
  return { ok: true, retryAfterSec: 0 };
}

/** Standard 429 response with a Retry-After header. */
export function tooManyRequests(retryAfterSec: number): NextResponse {
  return NextResponse.json(
    { error: "rate_limited", retryAfterSec },
    { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
  );
}
