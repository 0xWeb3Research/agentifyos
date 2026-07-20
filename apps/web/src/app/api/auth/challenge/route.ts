import { NextResponse } from "next/server";
import { createChallenge } from "@/lib/auth/siwx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Behind a proxy, req.url carries the internal address (Railway routes to
// localhost:8080), so the signed message would name a host the user never
// visited. SIWX exists to bind a signature to a site — read the forwarded
// headers so the wallet shows the real one.
function publicOrigin(req: Request): { host: string; origin: string } {
  const url = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? url.host;
  const proto = req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  return { host, origin: `${proto}://${host}` };
}

export async function POST(req: Request) {
  const { accountHash } = (await req.json().catch(() => ({}))) as { accountHash?: string };
  const { host, origin } = publicOrigin(req);
  const challenge = createChallenge({
    domain: host,
    uri: origin,
    accountHash,
    chainId: process.env.CSPR_NETWORK || "casper:casper-test",
  });
  return NextResponse.json(challenge, { headers: { "Cache-Control": "no-store" } });
}
