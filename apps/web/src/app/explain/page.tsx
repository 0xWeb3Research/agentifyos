import type { Metadata } from "next";
import Link from "next/link";
import { Container, Eyebrow, Button, Arrow } from "@/components/ui";
import { AddressBook } from "@/components/addresses";
import { MoneyDiagram, PaymentDiagram, SystemDiagram } from "@/components/diagram/diagrams";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "AgentifyOS explained in three diagrams: how an agent pays for a tool, where the money comes from, and what talks to what.",
  alternates: { canonical: "/explain" },
};

export default function ExplainPage() {
  return (
    <main>
      <Container className="pb-8 pt-16">
        <Eyebrow>explained visually</Eyebrow>
        <h1 className="mt-4 max-w-[18ch] text-[36px] font-medium leading-[1.05] tracking-[-0.03em] sm:text-[44px]">
          How an agent buys something.
        </h1>
        <p className="mt-5 max-w-[62ch] text-[15px] leading-relaxed text-fg-secondary">
          Three diagrams, no jargon. The first shows what happens when an AI agent
          pays for a tool. The second shows where the money actually comes from.
          The third shows which pieces talk to which.
        </p>
      </Container>

      {/* 1 */}
      <Container className="py-8">
        <div className="flex items-baseline gap-3">
          <span className="stat text-muted">01</span>
          <h2 className="text-[22px] font-medium tracking-[-0.02em]">
            Paying for a tool
          </h2>
        </div>
        <p className="mt-3 max-w-[68ch] text-[14px] leading-relaxed text-fg-secondary">
          An agent asks for data it doesn&apos;t have. Instead of demanding an API key,
          the server quotes a price with <span className="font-mono text-[13px]">HTTP 402</span>.
          The agent signs a payment, which costs it nothing and touches no blockchain.
          A <em>facilitator</em> then submits it on-chain and covers the fee.
        </p>
        <div className="mt-6">
          <PaymentDiagram />
        </div>
      </Container>

      {/* 2 */}
      <Container className="py-8">
        <div className="flex items-baseline gap-3">
          <span className="stat text-muted">02</span>
          <h2 className="text-[22px] font-medium tracking-[-0.02em]">
            Where the money comes from
          </h2>
        </div>
        <p className="mt-3 max-w-[68ch] text-[14px] leading-relaxed text-fg-secondary">
          Test tokens come from a faucet, once. From there they split two ways: the
          facilitator gets CSPR to pay transaction fees, and the treasury converts
          CSPR into <span className="font-mono text-[13px]">WCSPR</span>, the token
          tools are actually priced in. Agents only ever hold WCSPR.
        </p>
        <div className="mt-6">
          <MoneyDiagram />
        </div>
      </Container>

      {/* 3 */}
      <Container className="py-8">
        <div className="flex items-baseline gap-3">
          <span className="stat text-muted">03</span>
          <h2 className="text-[22px] font-medium tracking-[-0.02em]">
            What talks to what
          </h2>
        </div>
        <p className="mt-3 max-w-[68ch] text-[14px] leading-relaxed text-fg-secondary">
          Humans browse the website. Machines use the same marketplace through a
          command line or through MCP, the protocol that lets Claude and Cursor use
          external tools. All three go through one paid HTTP endpoint.
        </p>
        <div className="mt-6">
          <SystemDiagram />
        </div>
      </Container>

      {/* 4 */}
      <Container className="py-8">
        <div className="flex items-baseline gap-3">
          <span className="stat text-muted">04</span>
          <h2 className="text-[22px] font-medium tracking-[-0.02em]">
            The actual addresses
          </h2>
        </div>
        <p className="mt-3 max-w-[68ch] text-[14px] leading-relaxed text-fg-secondary">
          None of the above is hypothetical. These are the live Casper testnet
          accounts and the contract this instance settles through — click any value
          to copy it, or open the arrow to see it on the block explorer.
        </p>
        <div className="mt-6 max-w-[760px]">
          <AddressBook />
        </div>
        <p className="mt-5 text-[13px] text-fg-secondary">
          Gas budgets, entry-point signatures, and the funding runbook live in{" "}
          <Link href="/docs/addresses" className="text-accent hover:underline">
            the address reference
          </Link>
          .
        </p>
      </Container>

      <Container className="py-14">
        <div className="flex flex-col items-center gap-5 rounded-[var(--radius-card)] border border-border bg-surface px-8 py-12 text-center">
          <Eyebrow>see it happen</Eyebrow>
          <h2 className="max-w-[24ch] text-[26px] font-medium leading-tight tracking-[-0.03em]">
            Watch an agent do all of this, live.
          </h2>
          <p className="max-w-[52ch] text-[14px] leading-relaxed text-fg-secondary">
            The demo runs the real thing on Casper testnet. Every payment produces a
            transaction hash you can open on the block explorer.
          </p>
          <div className="mt-1 flex flex-wrap justify-center gap-3">
            <Button href="/agent">
              Run the agent demo <Arrow />
            </Button>
            <Button href="/tools" variant="secondary">
              Browse the catalog
            </Button>
          </div>
        </div>
      </Container>
    </main>
  );
}
