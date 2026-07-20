import { OG_SIZE, renderOgCard } from "@/lib/og-card";

export const alt = "Tools an agent can buy. · AgentifyOS";
export const size = OG_SIZE;
export const contentType = "image/png";
export const runtime = "nodejs";

export default function OpengraphImage() {
  return renderOgCard({
    title: "Tools an agent can buy.",
    subtitle: "Search the catalog by name, tag, category, or price. Every listing is callable over HTTP with an x402 payment instead of an API key.",
    badge: "Catalog",
  });
}
