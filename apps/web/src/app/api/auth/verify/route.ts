import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  consumeNonce,
  issueSession,
  nonceOf,
  verifySignedMessage,
} from "@/lib/auth/siwx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { publicKey, message, signature } = (await req.json().catch(() => ({}))) as {
    publicKey?: string;
    message?: string;
    signature?: string;
  };
  if (!publicKey || !message || !signature) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  // The challenge must be one we issued, unused, and unexpired.
  const nonce = nonceOf(message);
  if (!nonce || !consumeNonce(nonce)) {
    return NextResponse.json({ error: "unknown_or_expired_challenge" }, { status: 401 });
  }
  // And it must be bound to this host.
  if (!message.startsWith(`${new URL(req.url).host} wants you to sign in`)) {
    return NextResponse.json({ error: "domain_mismatch" }, { status: 401 });
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
