import { NextResponse } from "next/server";
import { searchTools } from "@/lib/data";
import { toDiscoveryResource } from "@/lib/discovery";
import { getChainId } from "@/lib/chain-server";

// Filtered discovery. An agent narrows the catalog by free-text query plus
// category / price-ceiling / tag, and gets back the same resource records as the
// full feed, ready to pick one and pay.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const on = await getChainId();
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
  }).map((t) => toDiscoveryResource(t, on));

  return NextResponse.json({
    count: resources.length,
    query,
    resources,
  });
}
