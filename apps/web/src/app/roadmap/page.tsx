import { Container, Eyebrow } from "@/components/ui";

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
        title: "Casper testnet settlements",
        desc: "The mock facilitator settles WCSPR deterministically; each receipt carries a deploy hash to testnet.cspr.live.",
      },
      {
        title: "MCP + llms.txt discovery",
        desc: "Agents find and call tools over an MCP endpoint or the discovery API, and llms.txt is the machine-readable front door.",
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
        desc: "Swap the mock for a real Casper facilitator (make-software/casper-x402) that verifies signatures and broadcasts live deploys.",
      },
      {
        title: "Casper mainnet",
        desc: "Flip from casper-test to mainnet: real CSPR moves and every receipt anchors to cspr.live.",
      },
      {
        title: "Listed in MCP directories",
        desc: "Publish AgentifyOS in the Claude and Cursor MCP directories so any agent host can mount the catalog in one click.",
      },
      {
        title: "Onboard Casper builders as suppliers",
        desc: "Wrap other Casper teams' endpoints into paid manifests, turning the market into two-sided supply.",
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
        title: "Stablecoin settlement",
        desc: "Settle in a Casper-native stablecoin the moment the Manifest standard ships it, giving agent budgets price stability.",
      },
      {
        title: "Session-key spend caps",
        desc: "Account-abstraction session keys let an agent hold a bounded, revocable budget instead of a raw wallet.",
      },
      {
        title: "On-chain Odra ToolRegistry",
        desc: "An Odra smart contract anchoring each manifest's hash on-chain, making listings tamper-evident and portable.",
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
            AgentifyOS runs the full x402 loop today, settling on Casper testnet
            in mock mode. From here the path is a self-hosted facilitator,
            mainnet, and an on-chain registry the whole ecosystem can build on.
          </p>
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
