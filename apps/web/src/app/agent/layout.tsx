import type { Metadata } from "next";

// The page itself is a client component, so its metadata lives here.
export const metadata: Metadata = {
  title: "Watch an agent pay",
  description:
    "A live demo: give an agent a task and a 0.1 WCSPR budget, then watch it discover tools, sign each call, and settle on Casper testnet with a receipt per payment.",
  alternates: { canonical: "/agent" },
  openGraph: {
    title: "Watch an agent pay · AgentifyOS",
    description:
      "One task, paid tool calls, real settlements on Casper testnet. Every step of the x402 loop shown on the wire.",
  },
};

export default function AgentLayout({ children }: { children: React.ReactNode }) {
  return children;
}
