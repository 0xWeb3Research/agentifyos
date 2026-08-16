import type { Metadata } from "next";
import Link from "next/link";
import { Container, Eyebrow, Button, Arrow } from "@/components/ui";
import { ALGO } from "@/lib/config";
import { getChain } from "@/lib/chain-server";
import { AddressBook } from "@/components/addresses";
import { MoneyDiagram, PaymentDiagram, SystemDiagram } from "@/components/diagram/diagrams";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "AgentifyOS explained in three diagrams: how an agent pays for a tool, where the money comes from, and what talks to what.",
  alternates: { canonical: "/explain" },
};

export default async function ExplainPage() {
  const chain = await getChain();
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
          The agent signs a USDC transfer, which costs it nothing to sign and never
          reaches the network on its own. A <em>facilitator</em> pairs that signature
          with a fee-paying transaction of its own, submits both as one atomic group,
          and picks up the fee.
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
        {chain.id === "casper" ? (
          <>
            <p className="mt-3 max-w-[68ch] text-[14px] leading-relaxed text-fg-secondary">
              One faucet: 5,000 testnet CSPR, once per account. The treasury then
              wraps CSPR into{" "}
              <span className="font-mono text-[13px]">WCSPR</span> one for one,
              because the x402 scheme settles on a CEP-18 token rather than the
              native coin, and funds agents in WCSPR from there.
            </p>
            <p className="mt-3 max-w-[68ch] text-[14px] leading-relaxed text-fg-secondary">
              The agent pays no gas at all, and holds no CSPR: it signs an
              authorization, and our facilitator key pays to submit it. Prices are
              quoted in dollars and converted to WCSPR at an illustrative rate, so
              a dollar figure here is approximate in a way it is not on Algorand.
            </p>
          </>
        ) : (
          <>
            <p className="mt-3 max-w-[68ch] text-[14px] leading-relaxed text-fg-secondary">
              Two faucets, once each: testnet ALGO from Lora, testnet{" "}
              <span className="font-mono text-[13px]">USDC</span> from Circle. Every
              account that will ever receive USDC first opts into{" "}
              <span className="font-mono text-[13px]">ASA {ALGO.assetId}</span>, which
              is the one on-chain step you cannot skip. After that the treasury funds
              agents in USDC and agents pay publishers in USDC. There is no wrapping
              step and no conversion table: a dollar price is a USDC amount, exactly.
            </p>
            <p className="mt-3 max-w-[68ch] text-[14px] leading-relaxed text-fg-secondary">
              The agent pays no network fees, because GoPlausible signs and funds the
              fee transaction in the group. It is not fee-free in the strict sense: an
              Algorand account holds about 0.2 ALGO of minimum balance, 0.1 for the
              account and 0.1 for the USDC opt-in. That amount is locked, not spent,
              and it never moves again.
            </p>
          </>
        )}
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
          None of the above is hypothetical. These are the live {chain.networkLabel}{" "}
          accounts and the asset this instance settles through. Click any value to
          copy it, or open the arrow to see it on {chain.explorerName}.
        </p>
        <div className="mt-6 max-w-[760px]">
          <AddressBook />
        </div>
        <p className="mt-5 text-[13px] text-fg-secondary">
          Opt-ins, minimum balances, and the funding runbook live in{" "}
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
            The demo runs the real thing on {chain.networkLabel}. Every payment
            produces a {chain.txLabel} you can open on {chain.explorerName}, plus a
            receipt the facilitator serves independently of us.
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
