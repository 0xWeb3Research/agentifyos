import type { Metadata } from "next";
import { Container, Eyebrow } from "@/components/ui";

export const metadata: Metadata = {
  title: "Roadmap",
  description:
    "What AgentifyOS ships today and what comes next: the full x402 loop on Algorand testnet, then a self-hosted facilitator, mainnet, and an on-chain tool registry.",
  alternates: { canonical: "/roadmap" },
  openGraph: {
    title: "Roadmap · AgentifyOS",
    description:
      "From the x402 loop running on Algorand testnet today to a self-hosted facilitator, mainnet, and an on-chain tool registry.",
  },
};

// Long-term launch plan. A calm mono timeline: what ships today, what's next,
// and where the machine economy goes once the rails are real.

interface Phase {
  index: string;
  label: string;
  tag: string;
  caption: string;
  dot: string;
  items: { title: string; desc: string }[];
}

const PHASES: Phase[] = [
  {
    index: "01",
    label: "Now",
    tag: "now",
    caption: "live in this build",
    dot: "bg-success",
    items: [
      {
        title: "Full HTTP 402 payment loop",
        desc: "Every tool is a real 402 endpoint over the x402 exact scheme: advertise price, sign, verify, settle, receipt.",
      },
      {
        title: "Algorand testnet settlements",
        desc: "The GoPlausible facilitator settles real USDC (ASA 10458941) in a two-transaction atomic group and sponsors the network fee. Each receipt carries a transaction id on Lora plus the facilitator's own record of the same payment.",
      },
      {
        title: "MCP + llms.txt discovery",
        desc: "Agents find and call tools over an MCP endpoint or the discovery API, and llms.txt is the machine-readable front door. A listing also shows up in GoPlausible's public Bazaar by itself, once one payment for it has settled.",
      },
    ],
  },
  {
    index: "02",
    label: "Next",
    tag: "next",
    caption: "the next few months",
    dot: "bg-accent",
    items: [
      {
        title: "Self-hosted facilitator",
        desc: "Verification and settlement go through GoPlausible's hosted facilitator today. Running our own gives the market a second, independent settler and a fallback when theirs is unavailable.",
      },
      {
        title: "Algorand mainnet",
        desc: "Flip from testnet to mainnet: the same loop against USDC ASA 31566704, with real dollars moving and every receipt anchored on Lora mainnet.",
      },
      {
        title: "Listed in MCP directories",
        desc: "Publish AgentifyOS in the Claude and Cursor MCP directories so any agent host can mount the catalog in one click.",
      },
      {
        title: "Wallet checkout with Pera and Defly",
        desc: "Today the demo pays from a server-held account. Next a human connects Pera or Defly, signs the USDC transfer in the browser, and buys a tool call directly.",
      },
      {
        title: "Onboard Algorand builders as suppliers",
        desc: "Wrap other Algorand teams' endpoints into paid manifests, turning the market into two-sided supply.",
      },
    ],
  },
  {
    index: "03",
    label: "Later",
    tag: "later",
    caption: "the machine economy",
    dot: "bg-muted",
    items: [
      {
        title: "Per-publisher payout accounts",
        desc: "Every settlement lands in one treasury today, because a receiver has to opt into the USDC ASA before it can be paid at all. An onboarding step that opts a publisher in lets payments settle straight to them.",
      },
      {
        title: "Delegated spend caps",
        desc: "A bounded, revocable signing key lets an agent hold a budget instead of a raw account, so a compromised agent can only ever spend what it was granted.",
      },
      {
        title: "On-chain ToolRegistry",
        desc: "An AVM smart contract anchoring each manifest's hash on-chain, making listings tamper-evident and portable between marketplaces.",
      },
    ],
  },
];

export default function RoadmapPage() {
  return (
    <main>
      <Container className="py-16 lg:py-24">
        <div className="animate-fade-up">
          <Eyebrow>launch plan</Eyebrow>
          <h1 className="mt-4 text-[40px] font-medium leading-[1.03] tracking-[-0.04em] sm:text-[48px]">
            From testnet to the
            <br />
            machine economy
          </h1>
          <p className="mt-5 max-w-[54ch] text-[15px] leading-relaxed text-fg-secondary">
            AgentifyOS runs the full x402 loop today, settling real USDC on
            Algorand testnet with the network fee sponsored by the facilitator.
            From here the path is mainnet, wallet checkout, third-party
            suppliers, and an on-chain registry the whole ecosystem can build
            on.
          </p>
          <a
            href="/whitepaper.pdf"
            className="mt-4 inline-block text-[13px] font-medium text-accent hover:underline"
          >
            Read the whitepaper (PDF) →
          </a>
        </div>

        <div className="mt-14 flex flex-col gap-10 sm:gap-12">
          {PHASES.map((phase, pi) => (
            <section
              key={phase.label}
              className="animate-fade-up grid gap-5 lg:grid-cols-[220px_1fr] lg:gap-8"
              style={{ animationDelay: `${80 + pi * 70}ms` }}
            >
              <div className="lg:pt-1">
                <div className="flex items-center gap-2.5">
                  <span className={`inline-block h-2 w-2 rounded-full ${phase.dot}`} />
                  <span className="stat text-fg">{phase.index}</span>
                  <h2 className="text-[19px] font-medium tracking-[-0.02em]">
                    {phase.label}
                  </h2>
                </div>
                <p className="label mt-2">{phase.caption}</p>
              </div>

              <div className="divide-y divide-border overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface">
                {phase.items.map((item) => (
                  <div
                    key={item.title}
                    className="flex gap-4 px-5 py-4 transition-colors duration-200 ease-[var(--ease-out)] hover:bg-tint"
                  >
                    <span className="label mt-[3px] w-11 shrink-0">{phase.tag}</span>
                    <div className="min-w-0">
                      <h3 className="text-[15px] font-medium tracking-[-0.02em]">
                        {item.title}
                      </h3>
                      <p className="mt-1 text-[13px] leading-relaxed text-fg-secondary">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div
          className="animate-fade-up mt-16 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border pt-6"
          style={{ animationDelay: "320ms" }}
        >
          <span className="label">agentifyos.xyz</span>
          <span className="label">@agentifyos</span>
          <span className="label">GitHub</span>
        </div>
      </Container>
    </main>
  );
}
