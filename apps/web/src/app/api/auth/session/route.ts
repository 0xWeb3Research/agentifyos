import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, readSession } from "@/lib/auth/siwx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = readSession((await cookies()).get(SESSION_COOKIE)?.value);
  return NextResponse.json({ session }, { headers: { "Cache-Control": "no-store" } });
}

/** Sign out. */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
