import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  authOrigin,
  consumeNonce,
  issueSession,
  nonceOf,
  verifySignedMessage,
} from "@/lib/auth/siwx";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/security/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const rl = rateLimit(`auth-verify:${clientIp(req)}`, 20, 60_000);
  if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

  const { publicKey, message, signature } = (await req.json().catch(() => ({}))) as {
    publicKey?: string;
    message?: string;
    signature?: string;
  };
  if (!publicKey || !message || !signature) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  // Bound to this site: the same server-derived host the challenge was minted
  // with, never a value from request headers. Checked before the nonce burn so
  // a mismatch doesn't destroy a still-valid challenge.
  if (!message.startsWith(`${authOrigin(req).host} wants you to sign in`)) {
    return NextResponse.json({ error: "domain_mismatch" }, { status: 401 });
  }

  // The challenge must be one we issued, unused, and unexpired. The match is
  // byte-for-byte, so none of the terms the user saw (account, URI, chain,
  // expiry) can have been rewritten around a valid nonce.
  const nonce = nonceOf(message);
  if (!nonce || !(await consumeNonce(nonce, message))) {
    return NextResponse.json({ error: "unknown_or_expired_challenge" }, { status: 401 });
  }

  const out = verifySignedMessage(publicKey, message, signature);
  if (!out.ok) return NextResponse.json({ error: out.reason }, { status: 401 });

  const token = issueSession({
    publicKey,
    accountHash: out.accountHash!,
    address: out.address!,
  });
  const res = NextResponse.json({
    ok: true,
    publicKey,
    accountHash: out.accountHash,
    address: out.address,
  });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
