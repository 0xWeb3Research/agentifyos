import { OG_SIZE, renderOgCard } from "@/lib/og-card";

export const alt = "Read the whole thing. · AgentifyOS";
export const size = OG_SIZE;
export const contentType = "image/png";
export const runtime = "nodejs";

export default function OpengraphImage() {
  return renderOgCard({
    title: "Read the whole thing.",
    subtitle: "Six documents in reading order: what an agent is, how the x402 handshake works, the testnet runbook, the CLI and MCP server, and the proof.",
    badge: "Docs",
  });
}
