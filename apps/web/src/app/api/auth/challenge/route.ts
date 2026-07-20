import { NextResponse } from "next/server";
import { authOrigin, createChallenge } from "@/lib/auth/siwx";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/security/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The wallet passes its active public key so the challenge can name it. It is
// display-only, but it lands inside the message the user signs. Reject anything
// that isn't a plain hex key/hash so a caller can't inject extra lines (say, a
// decoy `Nonce:`) into the preimage.
const ACCOUNT_RE = /^(account-hash-)?[0-9a-fA-F]{2,128}$/;

export async function POST(req: Request) {
  // Minting is unauthenticated and allocates a nonce per call. Rate-limit it so
  // a spray can't grow the challenge store or churn the sweep.
  const rl = rateLimit(`auth-challenge:${clientIp(req)}`, 20, 60_000);
  if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

  const { accountHash } = (await req.json().catch(() => ({}))) as { accountHash?: string };
  // The domain in the signed message is the SIWX binding, so it comes from
  // authOrigin (server-trusted config, request host only on `next dev`), the
  // exact value /api/auth/verify checks against. Reading X-Forwarded-Host here
  // would let a client mint challenges naming any site it likes.
  const { host, origin } = authOrigin(req);
  const challenge = await createChallenge({
    domain: host,
    uri: origin,
    accountHash: accountHash && ACCOUNT_RE.test(accountHash) ? accountHash : undefined,
    chainId: process.env.CSPR_NETWORK || "casper:casper-test",
  });
  return NextResponse.json(challenge, { headers: { "Cache-Control": "no-store" } });
}
