import Link from "next/link";
import { clsx } from "clsx";
import { Arrow, Container, Eyebrow, LogoTile, StatusPill } from "@/components/ui";
import { CopyInline } from "@/components/copy";
import { LiveFeed } from "@/components/live-feed";
import { DEMO_PUBLISHER_ID, getPublisherDashboard } from "@/lib/data";
import { compact, pct, shortHash, usd } from "@/lib/format";
import { PLATFORM_FEE } from "@/lib/config";

export default function DashboardPage() {
  const d = getPublisherDashboard(DEMO_PUBLISHER_ID);
  const creatorPct = Math.round((1 - PLATFORM_FEE) * 100);
  const platformPct = Math.round(PLATFORM_FEE * 100);

  return (
    <main>
      {/* ── header + publisher identity ──────────────────────────────── */}
      <Container className="pb-6 pt-16 lg:pt-20">
        <div className="animate-fade-up">
          <Eyebrow>publisher dashboard</Eyebrow>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <LogoTile monogram={d.publisher.monogram} color={d.publisher.color} size={48} />
            <div className="min-w-0">
              <h1 className="text-[28px] font-medium leading-tight tracking-[-0.03em]">
                {d.publisher.name}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="stat text-muted">{d.publisher.handle}</span>
                <span className="hidden h-3 w-px bg-border sm:block" />
                <span className="label">pays to</span>
                <CopyInline text={shortHash(d.publisher.payTo)} />
              </div>
            </div>
          </div>
        </div>
      </Container>

      {/* ── KPI row ──────────────────────────────────────────────────── */}
      <Container className="pb-8">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-card)] border border-border bg-border sm:grid-cols-4">
          <Kpi value={usd(d.totalRevenueUsd)} label="total earnings" accent />
          <Kpi value={compact(d.totalCalls)} label="paid calls" />
          <Kpi value={String(d.tools.length)} label="live tools" />
          <Kpi value={`${creatorPct} / ${platformPct}`} label="creator / platform" />
        </div>
      </Container>

      {/* ── your tools ───────────────────────────────────────────────── */}
      <Container className="pb-10">
        <div className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <span className="label">your tools</span>
            <span className="stat text-muted">{d.tools.length}</span>
          </div>
          <div className="divide-y divide-border">
            {d.tools.map((t) => (
              <Link
                key={t.id}
                href={`/tools/${t.slug}`}
                className="group flex items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-tint"
              >
                <LogoTile monogram={t.monogram} color={t.color} size={34} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2.5">
                    <span className="truncate text-[14px] font-medium tracking-[-0.01em]">
                      {t.name}
                    </span>
                    <StatusPill status={t.status} />
                  </div>
                </div>
                <Col value={usd(t.primaryPrice)} unit="/ call" show />
                <Col value={compact(t.stats.totalCalls)} unit="calls" />
                <Col value={pct(t.stats.successRate)} unit="success" />
                <Col value={usd(t.stats.revenueUsd)} unit="earned" tone="success" show />
                <Arrow className="hidden text-muted group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-fg sm:block" />
              </Link>
            ))}
          </div>
        </div>
      </Container>

      {/* ── live settlement feed ─────────────────────────────────────── */}
      <Container className="pb-24">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <Eyebrow>the payment is the review</Eyebrow>
            <h2 className="mt-2 text-[20px] font-medium tracking-[-0.02em]">
              Settlements, as they clear
            </h2>
          </div>
        </div>
        <LiveFeed initial={d.settlements} />
      </Container>
    </main>
  );
}

// big mono number + micro label — the KPI cell, in the exemplar's hairline grid
function Kpi({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div className="bg-surface p-5 sm:p-6">
      <div
        className={clsx(
          "font-mono text-[24px] leading-none tracking-[-0.02em] tabular-nums",
          accent ? "text-success" : "text-fg",
        )}
      >
        {value}
      </div>
      <div className="label mt-2">{label}</div>
    </div>
  );
}

// a right-aligned mono metric column in the tools table
function Col({
  value,
  unit,
  tone,
  show,
}: {
  value: string;
  unit: string;
  tone?: "success";
  show?: boolean;
}) {
  return (
    <div className={clsx("w-[76px] flex-col items-end", show ? "flex" : "hidden sm:flex")}>
      <span className={clsx("stat tabular-nums", tone === "success" ? "text-success" : "text-fg")}>
        {value}
      </span>
      <span className="label mt-0.5">{unit}</span>
    </div>
  );
}
