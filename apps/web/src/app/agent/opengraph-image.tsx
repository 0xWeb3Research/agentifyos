import { OG_SIZE, renderOgCard } from "@/lib/og-card";

export const alt = "Watch an agent pay for itself. · AgentifyOS";
export const size = OG_SIZE;
export const contentType = "image/png";
export const runtime = "nodejs";

export default function OpengraphImage() {
  return renderOgCard({
    title: "Watch an agent pay for itself.",
    subtitle: "Give an agent a task and a WCSPR budget, then watch it discover tools, sign each call, and settle on Casper testnet with a receipt per payment.",
    badge: "Live demo",
  });
}
