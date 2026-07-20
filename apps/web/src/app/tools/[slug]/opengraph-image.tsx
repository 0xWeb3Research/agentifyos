import { OG_SIZE, renderOgCard } from "@/lib/og-card";
import { getToolBySlug, getToolsWithStats } from "@/lib/data";
import { usd } from "@/lib/format";

export const alt = "Tool listing on AgentifyOS";
export const size = OG_SIZE;
export const contentType = "image/png";
export const runtime = "nodejs";

export function generateStaticParams() {
  return getToolsWithStats().map((t) => ({ slug: t.slug }));
}

// A shared tool link should preview the tool and its price, not the generic
// homepage card — the price is the whole proposition.
export default async function ToolOpengraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tool = getToolBySlug(slug);
  if (!tool) return renderOgCard();
  return renderOgCard({
    title: tool.name,
    subtitle: tool.tagline,
    badge: `${usd(tool.primaryPrice)} per call`,
    footnote: `${tool.publisher.handle} · x402 on Casper`,
  });
}
