import { OG_SIZE, renderOgCard } from "@/lib/og-card";

export const alt = "What ships next. · AgentifyOS";
export const size = OG_SIZE;
export const contentType = "image/png";
export const runtime = "nodejs";

export default function OpengraphImage() {
  return renderOgCard({
    title: "What ships next.",
    subtitle: "The full x402 loop runs on Casper testnet today. Next: a self-hosted facilitator, mainnet, and an on-chain tool registry.",
    badge: "Roadmap",
  });
}
