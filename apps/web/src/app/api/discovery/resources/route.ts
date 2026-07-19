import { NextResponse } from "next/server";
import { CSPR } from "@/lib/config";
import { getToolsWithStats } from "@/lib/data";
import type { ToolWithStats } from "@/lib/types";

// The x402 discovery feed. One GET returns every paid resource on the market as
// a machine-readable record an agent can index, price-shop, and call.
export const dynamic = "force-dynamic";

function toResource(tool: ToolWithStats) {
  const event = tool.priceEvents[0];
  return {
    resource: "/api/t/" + tool.slug,
    type: "http",
    name: tool.name,
    description: tool.tagline,
    network: CSPR.network,
    price: {
      event: event.name,
      usd: event.usd,
      freeTrial: !!event.freeTrial,
    },
    input: tool.input,
    output: tool.output,
    outputExample: tool.outputExample,
    capabilities: tool.capabilities,
    status: tool.status,
    publisher: tool.publisher.handle,
    stats: {
      calls: tool.stats.totalCalls,
      buyers: tool.stats.distinctBuyers,
      successRate: tool.stats.successRate,
    },
  };
}

export async function GET() {
  const resources = getToolsWithStats().map(toResource);
  return NextResponse.json({
    x402Version: 2,
    count: resources.length,
    resources,
  });
}
