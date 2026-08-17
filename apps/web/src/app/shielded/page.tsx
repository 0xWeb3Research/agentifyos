import type { Metadata } from "next";
import Link from "next/link";
import { Container, Eyebrow, Button, Arrow, Chip } from "@/components/ui";
import { explorerUrl, readNightpassState, type NightpassState } from "@/lib/nightpass";

export const metadata: Metadata = {
  title: "Nightpass — shielded tool access on Midnight",
  description:
    "Paying for an API on a public ledger publishes an agent's whole toolchain. Nightpass proves entitlement in zero knowledge on Midnight, so the market stays auditable and the agent stays private.",
  alternates: { canonical: "/shielded" },
};

// The ledger moves on every redemption, so never serve this from a static cache.
export const revalidate = 15;

const fmtPrice = (atomic: bigint) => `$${(Number(atomic) / 1e6).toFixed(3)}`;

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
      <div className="label text-muted">{label}</div>
      <div className="stat mt-2 text-[26px] leading-none tracking-[-0.02em]">{value}</div>
      {hint ? <div className="mt-2 text-[12px] leading-snug text-fg-secondary">{hint}</div> : null}
    </div>
  );
}

function LiveState({ state }: { state: NightpassState }) {
  const { deployment } = state;
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone="success">live on midnight {deployment.network}</Chip>
        <Chip>compact {deployment.compiler}</Chip>
        <span className="label text-muted">
          read from the public indexer, no wallet required
        </span>
      </div>

      <div className="mt-5 overflow-x-auto rounded-[var(--radius-md)] border border-border bg-tint p-4">
        <div className="label text-muted">contract</div>
        <a
          href={explorerUrl(deployment.network, deployment.contractAddress)}
          target="_blank"
          rel="noreferrer"
          className="mt-1 block font-mono text-[12px] leading-relaxed break-all text-fg hover:text-accent"
        >
          {deployment.contractAddress}
        </a>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="tools listed" value={String(state.tools.length)} hint="price and quota are public" />
        <Stat
          label="passes issued"
          value={String(state.passesIssued)}
          hint="commitments only, never a buyer"
        />
        <Stat
          label="calls redeemed"
          value={String(state.callsRedeemed)}
          hint="one nullifier each, mutually unlinkable"
        />
        <Stat
          label="attestations"
          value={String(state.attestations)}
          hint="readable only by the named auditor"
        />
      </div>

      {state.tools.length > 0 ? (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="label py-2 font-normal text-muted">tool</th>
                <th className="label py-2 font-normal text-muted">price / pass</th>
                <th className="label py-2 font-normal text-muted">quota</th>
                <th className="label py-2 font-normal text-muted">calls served</th>
                <th className="label py-2 font-normal text-muted">publisher</th>
              </tr>
            </thead>
            <tbody>
              {state.tools.map((t) => (
                <tr key={t.toolId} className="border-b border-border/60">
                  <td className="py-2.5 pr-4">
                    {t.slug ? (
                      <span className="text-fg">{t.slug}</span>
                    ) : (
                      <span className="font-mono text-[12px] text-fg-secondary">
                        {t.toolId.slice(0, 12)}…
                      </span>
                    )}
                    {!t.active ? <span className="ml-2 label text-muted">delisted</span> : null}
                  </td>
                  <td className="py-2.5 pr-4 font-mono text-[12px]">{fmtPrice(t.priceAtomic)}</td>
                  <td className="py-2.5 pr-4 font-mono text-[12px]">{String(t.quota)}</td>
                  <td className="py-2.5 pr-4 font-mono text-[12px]">{String(t.callsServed)}</td>
                  <td className="py-2.5 font-mono text-[12px] text-fg-secondary">
                    {t.publisherCommitment.slice(0, 10)}…
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-[12px] leading-relaxed text-fg-secondary">
            The publisher column is a commitment, not a key. Only the party holding the
            secret behind it can delist the tool, and nobody can tell which publisher
            operates which listings.
          </p>
        </div>
      ) : (
        <p className="mt-6 text-[14px] text-fg-secondary">
          The contract is deployed but no tools are listed yet. Run{" "}
          <code className="font-mono text-[13px]">pnpm nightpass:demo</code> to populate it.
        </p>
      )}
    </>
  );
}

function NotDeployed() {
  return (
    <div className="rounded-[var(--radius-md)] border border-border bg-tint p-6">
      <Chip>not deployed yet</Chip>
      <p className="mt-3 max-w-[62ch] text-[14px] leading-relaxed text-fg-secondary">
        No contract address is recorded for this network, or the public indexer could not
        be reached. Everything below still describes exactly what the deployed contract
        does; the numbers appear here as soon as{" "}
        <code className="font-mono text-[13px]">pnpm nightpass:deploy</code> writes an
        address.
      </p>
    </div>
  );
}

export default async function ShieldedPage() {
  const state = await readNightpassState("preview");

  return (
    <main>
      <Container className="pb-10 pt-16">
        <Eyebrow>nightpass · midnight</Eyebrow>
        <h1 className="mt-4 max-w-[20ch] text-[36px] font-medium leading-[1.05] tracking-[-0.03em] sm:text-[44px]">
          An agent can now pay. That is also how it gets watched.
        </h1>
        <p className="mt-5 max-w-[64ch] text-[15px] leading-relaxed text-fg-secondary">
          Machine payments solved the checkout. They also put every purchase on a public
          ledger, and for a real operator the sequence of tools an agent buys{" "}
          <em>is</em> the strategy: which data a fund reads, which checks a bank runs,
          which models a competitor calls. That is why serious agents still run on
          pre-provisioned enterprise keys instead of open markets.
        </p>
        <p className="mt-4 max-w-[64ch] text-[15px] leading-relaxed text-fg-secondary">
          Nightpass splits the two halves apart on Midnight. An agent proves in zero
          knowledge that it holds a paid pass for a tool, without revealing which agent it
          is, what else it holds, or how far through its quota it is. The half a market
          actually needs public stays public.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Button href="/docs/nightpass">
            How it works <Arrow />
          </Button>
          <Button href="/tools" variant="secondary">
            Browse the catalog
          </Button>
        </div>
      </Container>

      <Container className="py-8">
        <div className="flex items-baseline gap-3">
          <span className="stat text-muted">01</span>
          <h2 className="text-[22px] font-medium tracking-[-0.02em]">The live contract</h2>
        </div>
        <p className="mt-3 max-w-[68ch] text-[14px] leading-relaxed text-fg-secondary">
          Read straight off Midnight&apos;s public indexer when this page rendered. No
          wallet, no proof server, no permission: auditing the market is meant to be
          free, which is precisely why the private half has to be enforced by
          cryptography rather than by access control.
        </p>
        <div className="mt-6">{state ? <LiveState state={state} /> : <NotDeployed />}</div>
      </Container>

      <Container className="py-8">
        <div className="flex items-baseline gap-3">
          <span className="stat text-muted">02</span>
          <h2 className="text-[22px] font-medium tracking-[-0.02em]">
            What the ledger says, and what it refuses to
          </h2>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-[var(--radius-md)] border border-border bg-surface p-5">
            <div className="label text-muted">public, and verifiable by anyone</div>
            <ul className="mt-3 space-y-2 text-[14px] leading-relaxed text-fg-secondary">
              <li>· a tool exists, at a stated price and quota</li>
              <li>· how many calls it has genuinely served</li>
              <li>· that a pass was issued, as an opaque commitment</li>
              <li>· that some call was redeemed, as an opaque nullifier</li>
            </ul>
            <p className="mt-4 text-[13px] leading-relaxed text-fg-secondary">
              Reputation is the settled payment. There are no reviews to game, and
              inflating a call count costs a real pass at a real price.
            </p>
          </div>
          <div className="rounded-[var(--radius-md)] border border-border bg-surface p-5">
            <div className="label text-muted">private, and provably absent</div>
            <ul className="mt-3 space-y-2 text-[14px] leading-relaxed text-fg-secondary">
              <li>· which agent holds which pass</li>
              <li>· which agent made any given call</li>
              <li>· that two calls came from the same agent</li>
              <li>· how much of its quota an agent has left</li>
              <li>· which other tools that agent buys</li>
            </ul>
            <p className="mt-4 text-[13px] leading-relaxed text-fg-secondary">
              A call&apos;s nullifier is{" "}
              <code className="font-mono text-[12px]">hash(commitment, callIndex)</code>,
              so two calls drawn from one pass share nothing. An observer counts anonymous
              calls and never recovers a pattern.
            </p>
          </div>
        </div>
      </Container>

      <Container className="py-8">
        <div className="flex items-baseline gap-3">
          <span className="stat text-muted">03</span>
          <h2 className="text-[22px] font-medium tracking-[-0.02em]">
            What one call actually proves
          </h2>
        </div>
        <p className="mt-3 max-w-[68ch] text-[14px] leading-relaxed text-fg-secondary">
          Every redemption runs a circuit that establishes four things at once, and
          publishes exactly one value: the nullifier.
        </p>
        <ol className="mt-5 grid gap-3 sm:grid-cols-2">
          {[
            {
              n: "1",
              t: "A pass for this tool exists",
              d: "A Merkle path proves the commitment sits in the issued set, without naming which leaf it is.",
            },
            {
              n: "2",
              t: "The caller owns it",
              d: "The commitment is recomputed from a secret only the holder knows, so a scraped commitment is worthless.",
            },
            {
              n: "3",
              t: "The call is within quota",
              d: "The bound is public and checked in-circuit. The position within it stays private.",
            },
            {
              n: "4",
              t: "This call is not a replay",
              d: "The nullifier is recorded once. Rewinding the agent's own machine cannot un-record it.",
            },
          ].map((s) => (
            <li
              key={s.n}
              className="rounded-[var(--radius-md)] border border-border bg-surface p-4"
            >
              <div className="flex items-baseline gap-2.5">
                <span className="stat text-muted">{s.n}</span>
                <span className="text-[15px] font-medium tracking-[-0.01em]">{s.t}</span>
              </div>
              <p className="mt-2 text-[13px] leading-relaxed text-fg-secondary">{s.d}</p>
            </li>
          ))}
        </ol>
      </Container>

      <Container className="py-8">
        <div className="flex items-baseline gap-3">
          <span className="stat text-muted">04</span>
          <h2 className="text-[22px] font-medium tracking-[-0.02em]">
            Private by default, provable on demand
          </h2>
        </div>
        <p className="mt-3 max-w-[68ch] text-[14px] leading-relaxed text-fg-secondary">
          Privacy that cannot be lifted is useless to a regulated operator. An agent can
          publish an attestation naming a single auditor. The public sees only that some
          attestation exists. The auditor, given the pass secret off-chain, recomputes the
          tag, re-derives every call nullifier, and checks each one against the chain:
          a complete history, and an exact one, since the absence of call{" "}
          <span className="font-mono text-[13px]">n+1</span> is just as checkable as the
          presence of the first n.
        </p>
      </Container>

      <Container className="py-8 pb-20">
        <div className="flex items-baseline gap-3">
          <span className="stat text-muted">05</span>
          <h2 className="text-[22px] font-medium tracking-[-0.02em]">Check it yourself</h2>
        </div>
        <p className="mt-3 max-w-[68ch] text-[14px] leading-relaxed text-fg-secondary">
          The privacy claims above are enforced by the contract and asserted by its test
          suite, not by this page.
        </p>
        <pre className="mt-5 overflow-x-auto rounded-[var(--radius-md)] border border-border bg-tint p-4 font-mono text-[12.5px] leading-relaxed">
          {`pnpm nightpass:test      # the privacy properties, as adversarial tests
pnpm nightpass:proof     # start the local proof server
pnpm nightpass:deploy    # put the contract on Midnight preview
pnpm nightpass:demo      # publish, buy a pass, spend it, attest, verify
pnpm nightpass:state     # read the public ledger back`}
        </pre>
        <p className="mt-4 text-[13px] leading-relaxed text-fg-secondary">
          Source:{" "}
          <Link href="/docs/nightpass" className="text-fg underline underline-offset-4">
            the contract, annotated
          </Link>
          .
        </p>
      </Container>
    </main>
  );
}
