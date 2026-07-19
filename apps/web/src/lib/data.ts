import { PLATFORM_FEE } from "./config";
import { publishers, settlementBacklog, stats, tools } from "./seed";
import type { Publisher, Settlement, ToolStats, ToolWithStats } from "./types";

// In-memory session state. Settlements recorded during a session append here so
// the live feed and reputation stats visibly move in the demo. The USE_DB path
// (Prisma/Postgres) is wired via prisma/schema.prisma for the "real" story.
const liveSettlements: Settlement[] = [...settlementBacklog];
const liveStats = new Map<string, ToolStats>(stats.map((s) => [s.toolId, { ...s }]));

export function getPublisher(id: string): Publisher {
  return publishers.find((p) => p.id === id)!;
}

export function statsFor(toolId: string): ToolStats {
  return liveStats.get(toolId)!;
}

function join(slug: string): ToolWithStats | null {
  const tool = tools.find((t) => t.slug === slug);
  if (!tool) return null;
  return {
    ...tool,
    publisher: getPublisher(tool.publisherId),
    stats: statsFor(tool.id),
    primaryPrice: tool.priceEvents[0]?.usd ?? 0,
  };
}

export function getToolsWithStats(): ToolWithStats[] {
  return tools
    .map((t) => join(t.slug)!)
    .sort((a, b) => rank(b) - rank(a));
}

// Sybil-resistant-ish ranking: settled volume + distinct buyers + success +
// recency + verification, weighted. Reputation is ledger-derived only.
function rank(t: ToolWithStats): number {
  const s = t.stats;
  const verifiedBoost = t.status === "verified" ? 1 : 0.35;
  return (
    (Math.log10(s.revenueUsd + 1) * 3 +
      Math.log10(s.distinctBuyers + 1) * 2 +
      s.successRate * 2 +
      (t.featured ? 1.5 : 0)) *
    verifiedBoost
  );
}

export function getToolBySlug(slug: string): ToolWithStats | null {
  return join(slug);
}

export function getFeatured(): ToolWithStats[] {
  return getToolsWithStats().filter((t) => t.featured).slice(0, 1);
}

export function getCategories(): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const t of tools) counts.set(t.category, (counts.get(t.category) ?? 0) + 1);
  return [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
}

export function searchTools(
  query: string,
  filters: { category?: string; maxUsd?: number; tag?: string } = {},
): ToolWithStats[] {
  const q = query.trim().toLowerCase();
  return getToolsWithStats().filter((t) => {
    if (filters.category && t.category !== filters.category) return false;
    if (filters.tag && !t.tags.includes(filters.tag)) return false;
    if (typeof filters.maxUsd === "number" && t.primaryPrice > filters.maxUsd) return false;
    if (!q) return true;
    const hay = `${t.name} ${t.tagline} ${t.tags.join(" ")} ${t.category}`.toLowerCase();
    return hay.includes(q) || q.split(/\s+/).every((w) => hay.includes(w));
  });
}

export function getSettlements(limit = 24): Settlement[] {
  return liveSettlements.slice(0, limit);
}

export function recordSettlement(s: Settlement): void {
  liveSettlements.unshift(s);
  if (liveSettlements.length > 200) liveSettlements.pop();
  const st = liveStats.get(s.toolId);
  if (st && s.status === "settled") {
    st.totalCalls += 1;
    st.last30dCalls += 1;
    st.revenueUsd = +(st.revenueUsd + s.amountUsd * (1 - PLATFORM_FEE)).toFixed(2);
  }
}

export interface PublisherDashboard {
  publisher: Publisher;
  tools: ToolWithStats[];
  totalRevenueUsd: number;
  totalCalls: number;
  settlements: Settlement[];
}

export function getPublisherDashboard(publisherId: string): PublisherDashboard {
  const owned = getToolsWithStats().filter((t) => t.publisherId === publisherId);
  const ownedIds = new Set(owned.map((t) => t.id));
  return {
    publisher: getPublisher(publisherId),
    tools: owned,
    totalRevenueUsd: +owned.reduce((a, t) => a + t.stats.revenueUsd, 0).toFixed(2),
    totalCalls: owned.reduce((a, t) => a + t.stats.totalCalls, 0),
    settlements: liveSettlements.filter((s) => ownedIds.has(s.toolId)).slice(0, 30),
  };
}

// The default publisher shown on the dashboard (the "you" of the demo).
export const DEMO_PUBLISHER_ID = "pub_scrapeworks";
