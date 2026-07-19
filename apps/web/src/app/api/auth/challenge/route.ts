import { NextResponse } from "next/server";
import { createChallenge } from "@/lib/auth/siwx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { accountHash } = (await req.json().catch(() => ({}))) as { accountHash?: string };
  const url = new URL(req.url);
  const challenge = createChallenge({
    domain: url.host,
    uri: url.origin,
    accountHash,
    chainId: process.env.CSPR_NETWORK || "casper:casper-test",
  });
  return NextResponse.json(challenge, { headers: { "Cache-Control": "no-store" } });
}
