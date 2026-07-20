import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, readSession, revokeSessions } from "@/lib/auth/siwx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = readSession((await cookies()).get(SESSION_COOKIE)?.value);
  return NextResponse.json({ session }, { headers: { "Cache-Control": "no-store" } });
}

/**
 * Sign out. Clears the cookie AND revokes the account's outstanding tokens. The
 * cookie is only a carrier, so without revocation a copied token would stay
 * valid until it expires.
 */
export async function DELETE() {
  const session = readSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (session) revokeSessions(session.accountHash);
  const res = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
