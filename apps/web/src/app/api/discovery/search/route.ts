import { NextResponse } from "next/server";
import { CSPR } from "@/lib/config";
import { searchTools } from "@/lib/data";
import type { ToolWithStats } from "@/lib/types";

// Filtered discovery. An agent narrows the catalog by free-text query plus
// category / price-ceiling / tag, and gets back the same resource records as the
// full feed, ready to pick one and pay.
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

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const query = sp.get("query") ?? "";
  const category = sp.get("category") ?? undefined;
  const tag = sp.get("tag") ?? undefined;

  // Absent (or empty) maxUsd means "no ceiling". A present-but-garbage value
  // is rejected rather than silently disabling the price filter: an agent
  // shopping on price must not get results above its stated ceiling.
  const rawMaxUsd = sp.get("maxUsd");
  let maxUsd: number | undefined;
  if (rawMaxUsd) {
    const n = Number(rawMaxUsd);
    if (!Number.isFinite(n) || n < 0) {
      return NextResponse.json({ error: "invalid_maxUsd" }, { status: 400 });
    }
    maxUsd = n;
  }

  const resources = searchTools(query, {
    category,
    maxUsd,
    tag,
  }).map(toResource);

  return NextResponse.json({
    count: resources.length,
    query,
    resources,
  });
}
