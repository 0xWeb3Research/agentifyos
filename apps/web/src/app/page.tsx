import type { Metadata } from "next";
import Link from "next/link";
import { Marquee } from "@/components/marquee";
import { WireLog } from "@/components/wire-log";
import { ToolCard } from "@/components/tool-card";
import { Arrow, Button, Container, Eyebrow, LogoTile } from "@/components/ui";
import { getChain, getNetworkId } from "@/lib/chain-server";
import { networkMeta, type ChainMeta, type NetworkId } from "@/lib/chain";
import { getToolsWithStats } from "@/lib/data";
import { publishers } from "@/lib/seed";
import { compact, pct, usd } from "@/lib/format";
import type { WireStep } from "@/lib/x402/loop";

// Title and description come from the layout defaults, which are written for
// this page; only the canonical is page-specific.
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

// A representative wire trace for the hero (no side effects at render time).
// Built per chain, because a trace that named the wrong asset would be the first
// thing a reader saw and the first thing they stopped trusting.
const heroTrace = (chain: ChainMeta): WireStep[] => [
  { seq: 0, kind: "request", label: "GET algo-market-data · Price quote", ok: true, atMs: 0 },
  { seq: 1, kind: "402", label: `HTTP 402: pay 0.002 in ${chain.symbol} to continue`, ok: true, atMs: 4 },
  { seq: 2, kind: "sign", label: `agent signs the ${chain.symbol} transfer with its own key`, ok: true, atMs: 9 },
  { seq: 3, kind: "verify", label: "facilitator /verify → valid", ok: true, atMs: 118 },
  { seq: 4, kind: "settle", label: `facilitator /settle → settled on ${chain.id}`, ok: true, atMs: 3_140 },
  { seq: 5, kind: "result", label: "200 OK: ALGO $0.1732, +1.3% 24h", ok: true, atMs: 3_147 },
  { seq: 6, kind: "receipt", label: `receipt + ${chain.txLabel} → ${chain.explorerName}`, ok: true, atMs: 3_149 },
];

// The demo film, per network. All three are rendered from the same Remotion
// project in video/ and uploaded to the same bucket; the route picks the object,
// this picks what the page says about it. Lengths are the rendered durations,
// not estimates.
//
// Keyed on NetworkId rather than ChainId because Midnight is a network a visitor
// can pick but not a chain anything settles on, and it has its own film: the
// settlement ones are about a payment landing, that one about a payment leaving
// no trace of who made it.
const FILMS: Record<NetworkId, { length: string; poster: string; headline: string }> = {
  algorand: {
    length: "03:26",
    poster: "/demo-poster-algorand.jpg",
    headline: "One agent. Four tools. Zero API keys.",
  },
  casper: {
    length: "03:28",
    poster: "/demo-poster-casper.jpg",
    headline: "One agent. Four tools. Zero API keys.",
  },
  midnight: {
    length: "03:37",
    poster: "/demo-poster-midnight.jpg",
    headline: "One agent. Three calls. No buyer on the record.",
  },
};

export default async function Home() {
  const chain = await getChain();
  const network = await getNetworkId();
  const shielded = network === "midnight";
  // The film follows the network the visitor picked; pricing and links still
  // follow the settlement chain underneath it.
  const net = networkMeta(network);
  const film = FILMS[network];
  const tools = getToolsWithStats();
  const featured = tools.slice(0, 6);
  const totalCalls = tools.reduce((a, t) => a + t.stats.totalCalls, 0);
  const avgSuccess = tools.reduce((a, t) => a + t.stats.successRate, 0) / tools.length;

  return (
    <main>
        {/* ── hero ─────────────────────────────────────────────────────── */}
        <Container className="grid grid-cols-[minmax(0,1fr)] items-center gap-12 pb-14 pt-16 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:pt-24">
          <div className="animate-fade-up">
            <Eyebrow>the machine economy needs a market</Eyebrow>
            <h1 className="mt-4 text-[32px] font-medium leading-[1.05] tracking-[-0.03em] sm:text-[44px] lg:text-[52px] sm:tracking-[-0.04em]">
              The marketplace where
              <br />
              AI agents shop for tools.
            </h1>
            <p className="mt-5 max-w-[38ch] text-[15px] leading-relaxed text-fg-secondary">
              {shielded ? (
                <>
                  Developers publish a paid tool in 60 seconds. Autonomous agents
                  discover it and prove their right to call it on Midnight, in zero
                  knowledge. Payment settles in {chain.symbol} on {chain.name}, and
                  no observer learns which agent bought what.
                </>
              ) : (
                <>
                  Developers publish a paid tool in 60 seconds. Autonomous agents
                  discover it, pay per call with x402 on {chain.name}. No API keys,
                  no accounts. Every settlement is the review.
                </>
              )}
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button href="/agent" size="md">
                Watch an agent pay <Arrow />
              </Button>
              <Button href="/tools" variant="secondary" size="md">
                Browse the catalog
              </Button>
            </div>
            <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-2">
              <Stat value={compact(totalCalls)} label="paid calls" />
              <Divider />
              <Stat value={String(publishers.length)} label="publishers" />
              <Divider />
              <Stat value={pct(avgSuccess)} label="settled ok" />
              <Divider />
              <Stat value={usd(tools[0]?.primaryPrice ?? 0.002)} label="from / call" />
            </div>
          </div>

          <div
            className="animate-fade-up"
            style={{ animationDelay: "80ms" }}
          >
            <WireLog steps={heroTrace(chain)} dense />
            <p className="label mt-3 text-center">
              one paid tool call, start to finish
            </p>
          </div>
        </Container>

        {/* ── marquee ──────────────────────────────────────────────────── */}
        <Container className="py-6">
          <Marquee tools={tools} />
        </Container>

        {/* ── how it works ─────────────────────────────────────────────── */}
        <Container className="py-16">
          <Eyebrow>how it works</Eyebrow>
          <div className="mt-6 grid gap-px overflow-hidden rounded-[var(--radius-card)] border border-border bg-border sm:grid-cols-3">
            {steps(chain).map((s, i) => (
              <div key={s.title} className="bg-surface p-6">
                <span className="stat text-muted">0{i + 1}</span>
                <h3 className="mt-3 text-[17px] font-medium tracking-[-0.02em]">{s.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-fg-secondary">{s.body}</p>
              </div>
            ))}
          </div>
        </Container>

        {/* ── the demo film ────────────────────────────────────────────── */}
        <Container className="py-8">
          <div className="flex items-end justify-between">
            <div>
              <Eyebrow>watch it happen</Eyebrow>
              <h2 className="mt-3 text-[26px] font-medium tracking-[-0.03em]">
                {film.headline}
              </h2>
            </div>
            <span className="stat hidden text-muted sm:block">{film.length}</span>
          </div>
          <div className="relative mt-6 overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface shadow-[var(--shadow-card)]">
            {/* One film per chain, so what a visitor watches settles in the asset
                the rest of the page is quoting. The key remounts the element on a
                switch: without it the browser keeps playing the film it already
                buffered, and the src is only a redirect either way. */}
            <video
              key={network}
              controls
              playsInline
              preload="metadata"
              poster={film.poster}
              src={`/api/demo-video?chain=${network}`}
              className="block aspect-video w-full bg-surface"
            />
            <div className="pointer-events-none absolute right-2 top-2 sm:right-4 sm:top-4">
              <span className="label inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border border-success/25 bg-success-tint px-2.5 py-1 text-success backdrop-blur-md">
                <span className="inline-block h-1.5 w-1.5 animate-pulse-dot rounded-full bg-success" />
                recorded on {net.networkLabel.toLowerCase()}
              </span>
            </div>
          </div>
          <p className="stat mt-3 text-muted">
            a recorded run of the live demo on {net.networkLabel.toLowerCase()} ·
            everything in it is real and checkable, and the current settlements
            are in the{" "}
            <Link href="/dashboard" className="text-accent hover:underline">
              dashboard
            </Link>
          </p>
        </Container>

        {/* ── featured tools ───────────────────────────────────────────── */}
        <Container className="py-8">
          <div className="flex items-end justify-between">
            <div>
              <Eyebrow>the catalog</Eyebrow>
              <h2 className="mt-3 text-[26px] font-medium tracking-[-0.03em]">
                Tools your agent can buy
              </h2>
            </div>
            <Link
              href="/tools"
              className="press group hidden items-center gap-1.5 text-sm text-fg-secondary hover:text-fg sm:inline-flex"
            >
              All {tools.length} tools
              <Arrow className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((t, i) => (
              <ToolCard key={t.id} tool={t} index={i} />
            ))}
          </div>
        </Container>

        {/* ── the payment is the review ────────────────────────────────── */}
        <Container className="py-16">
          <div className="rounded-[var(--radius-card)] border border-border bg-surface p-8 sm:p-12">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)] lg:items-center">
              <div>
                <Eyebrow>reputation, not reviews</Eyebrow>
                <h2 className="mt-4 text-[28px] font-medium leading-tight tracking-[-0.03em]">
                  The payment is the review.
                </h2>
                <p className="mt-4 max-w-[46ch] text-[14px] leading-relaxed text-fg-secondary">
                  There are no star ratings to game. Every listing&apos;s
                  reputation is computed from settled on-chain payments: real
                  calls, distinct paying wallets, success rate. A tool goes
                  <span className="text-fg"> verified </span>
                  only after its first real settlement clears the facilitator.
                </p>
              </div>
              <div className="flex flex-col gap-2.5">
                {tools.slice(0, 3).map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center gap-3 rounded-[var(--radius-md)] border border-border bg-bg px-3.5 py-3"
                  >
                    <LogoTile monogram={t.monogram} color={t.color} size={34} />
                    <span className="flex-1 truncate text-[13px] font-medium">{t.name}</span>
                    <span className="stat text-success">{compact(t.stats.totalCalls)}</span>
                    <span className="stat text-muted">calls</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Container>

        {/* ── CTA ──────────────────────────────────────────────────────── */}
        <Container className="pb-8 pt-4">
          <div className="flex flex-col items-center gap-5 rounded-[var(--radius-card)] border border-border bg-fg px-8 py-14 text-center text-surface">
            <Eyebrow>
              <span className="text-surface/60">
                first tool market on {chain.id} x402
              </span>
            </Eyebrow>
            <h2 className="max-w-[20ch] text-[30px] font-medium leading-tight tracking-[-0.03em]">
              {chain.name} settles it. We built the market.
            </h2>
            <div className="mt-1 flex flex-wrap justify-center gap-3">
              <Link
                href="/agent"
                className="press inline-flex h-10 items-center gap-1.5 rounded-[var(--radius-sm)] bg-surface px-4 text-sm font-medium text-fg hover:bg-surface/90"
              >
                Run the agent demo <Arrow />
              </Link>
              <Link
                href="/publish"
                className="press inline-flex h-10 items-center rounded-[var(--radius-sm)] border border-surface/25 px-4 text-sm font-medium text-surface hover:bg-surface/10"
              >
                Publish a tool
              </Link>
            </div>
          </div>
        </Container>
    </main>
  );
}

const steps = (chain: ChainMeta) => [
  {
    title: "Publish a manifest",
    body: "Paste your endpoint, describe the inputs and outputs, set a price per call. One manifest becomes a listing, a discovery record, and an MCP tool.",
  },
  {
    title: "Agents discover it",
    body: "Agents search the catalog over MCP or HTTP, read your schema and price, and decide. No sign-up, no API key, no human in the loop.",
  },
  {
    title: "x402 settles it",
    body: `The agent signs a payment, the facilitator settles ${chain.symbol} on ${chain.name} and covers the network fee, and your earnings and the tool's reputation tick up with the receipt.`,
  },
];

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col">
      <span className="font-mono text-[17px] tracking-[-0.01em] text-fg">{value}</span>
      <span className="label mt-0.5">{label}</span>
    </div>
  );
}
function Divider() {
  return <span className="hidden h-8 w-px bg-border sm:block" />;
}
