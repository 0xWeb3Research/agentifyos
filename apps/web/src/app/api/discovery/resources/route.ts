import { NextResponse } from "next/server";
import { getChain } from "@/lib/chain-server";
import { getToolsWithStats } from "@/lib/data";
import { toDiscoveryResource } from "@/lib/discovery";

// The x402 discovery feed. One GET returns every paid resource on the market as
// a machine-readable record an agent can index, price-shop, and call.
export const dynamic = "force-dynamic";

export async function GET() {
  const chain = await getChain();
  const resources = getToolsWithStats().map((t) => toDiscoveryResource(t, chain.id));
  return NextResponse.json({
    x402Version: 2,
    network: chain.caip2,
    count: resources.length,
    resources,
  });
}
