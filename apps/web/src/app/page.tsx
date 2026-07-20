import type { Metadata } from "next";
import Link from "next/link";
import { Marquee } from "@/components/marquee";
import { WireLog } from "@/components/wire-log";
import { ToolCard } from "@/components/tool-card";
import { Arrow, Button, Container, Eyebrow, LogoTile } from "@/components/ui";
import { getToolsWithStats } from "@/lib/data";
import { publishers } from "@/lib/seed";
import { compact, pct, usd } from "@/lib/format";
import type { WireStep } from "@/lib/x402/loop";

// Title and description come from the layout defaults, which are written for
// this page — only the canonical is page-specific.
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

// A representative wire trace for the hero (no side effects at render time).
const HERO_TRACE: WireStep[] = [
  { seq: 0, kind: "request", label: "GET cspr-market-data · Price quote", ok: true, atMs: 0 },
  { seq: 1, kind: "402", label: "HTTP 402: pay 0.002 in WCSPR to continue", ok: true, atMs: 4 },
  { seq: 2, kind: "sign", label: "agent signs authorization with its own key", ok: true, atMs: 9 },
  { seq: 3, kind: "verify", label: "facilitator /verify → valid", ok: true, atMs: 118 },
  { seq: 4, kind: "settle", label: "facilitator /settle → settled on casper", ok: true, atMs: 1_284 },
  { seq: 5, kind: "result", label: "200 OK: CSPR $0.0231, +1.3% 24h", ok: true, atMs: 1_291 },
  { seq: 6, kind: "receipt", label: "receipt + deploy hash → testnet.cspr.live", ok: true, atMs: 1_293 },
];

export default function Home() {
  const tools = getToolsWithStats();
  const featured = tools.slice(0, 6);
  const totalCalls = tools.reduce((a, t) => a + t.stats.totalCalls, 0);
  const avgSuccess = tools.reduce((a, t) => a + t.stats.successRate, 0) / tools.length;

  return (
    <main>
        {/* ── hero ─────────────────────────────────────────────────────── */}
        <Container className="grid items-center gap-12 pb-14 pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:pt-24">
          <div className="animate-fade-up">
            <Eyebrow>the machine economy needs a market</Eyebrow>
            <h1 className="mt-4 text-[32px] font-medium leading-[1.05] tracking-[-0.03em] sm:text-[44px] lg:text-[52px] sm:tracking-[-0.04em]">
              The marketplace where
              <br />
              AI agents shop for tools.
            </h1>
            <p className="mt-5 max-w-[38ch] text-[15px] leading-relaxed text-fg-secondary">
              Developers publish a paid tool in 60 seconds. Autonomous agents
              discover it, pay per call with x402 on Casper. No API keys, no
              accounts. Every settlement is the review.
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
            <WireLog steps={HERO_TRACE} dense />
            <p className="label mt-3 text-center">
              one paid tool call, start to finish · ~1.3s
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
            {STEPS.map((s, i) => (
              <div key={s.title} className="bg-surface p-6">
                <span className="stat text-muted">0{i + 1}</span>
                <h3 className="mt-3 text-[17px] font-medium tracking-[-0.02em]">{s.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-fg-secondary">{s.body}</p>
              </div>
            ))}
          </div>
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
            <div className="grid gap-8 lg:grid-cols-[1fr_0.8fr] lg:items-center">
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
              <span className="text-surface/60">first tool market on casper x402</span>
            </Eyebrow>
            <h2 className="max-w-[20ch] text-[30px] font-medium leading-tight tracking-[-0.03em]">
              Casper built the rails. We built the market.
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

const STEPS = [
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
    body: "The agent signs a payment, the facilitator settles WCSPR on Casper, and your earnings and the tool's reputation tick up with the receipt.",
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
