import type { Metadata } from "next";
import Link from "next/link";
import { clsx } from "clsx";
import { LiveFeed } from "@/components/live-feed";
import { Arrow, Button, Chip, Container, Eyebrow, LogoTile } from "@/components/ui";
import { PLATFORM_FEE, explorerTx } from "@/lib/config";
import { compact, relTime, shortHash, usd } from "@/lib/format";
import { getSeededSettlements, getToolsWithStats } from "@/lib/data";
import { earningsByTool, readRealSettlements, totalsOf } from "@/lib/store/ledger";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ sim?: string }>;
}) {
  const { sim } = await searchParams;
  const simulation = sim === "1";

  // Real mode reads only the durable ledger — payments that actually settled.
  const real = await readRealSettlements(200);
  const settlements = simulation ? getSeededSettlements(30) : real;
  const totals = totalsOf(settlements);
  const earnings = earningsByTool(settlements, PLATFORM_FEE);
  const tools = getToolsWithStats();

  return (
    <main>
      <Container className="pb-6 pt-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Eyebrow>{simulation ? "dashboard · simulation" : "dashboard · live"}</Eyebrow>
            <h1 className="mt-3 text-[30px] font-medium leading-tight tracking-[-0.03em] sm:text-[32px]">
              {simulation ? "Simulated marketplace" : "Real on-chain earnings"}
            </h1>
            <p className="mt-2 max-w-[62ch] text-[14px] leading-relaxed text-fg-secondary">
              {simulation
                ? "Seeded demo data — invented numbers showing what a busy marketplace would look like. None of this settled on-chain."
                : "Every figure below comes from a payment that actually settled on Casper testnet. Nothing here is simulated."}
            </p>
          </div>
          <SimToggle simulation={simulation} />
        </div>
      </Container>

      {!simulation && totals.count === 0 ? (
        <Container className="pb-24">
          <div className="flex flex-col items-center gap-5 rounded-[var(--radius-card)] border border-dashed border-border bg-surface px-6 py-16 text-center sm:px-8">
            <Eyebrow>no settlements yet</Eyebrow>
            <h2 className="max-w-[26ch] text-[22px] font-medium leading-tight tracking-[-0.03em] sm:text-[24px]">
              Nothing has been paid for yet.
            </h2>
            <p className="max-w-[52ch] text-[14px] leading-relaxed text-fg-secondary">
              This dashboard only shows real on-chain payments, so it stays empty until an
              agent actually buys something. Run the demo and it fills up — every row
              linking to a transaction on the block explorer.
            </p>
            <div className="mt-1 flex flex-wrap justify-center gap-3">
              <Button href="/agent">
                Run the agent demo <Arrow />
              </Button>
              <Button href="/dashboard?sim=1" variant="secondary">
                Show simulated data
              </Button>
            </div>
          </div>
        </Container>
      ) : (
        <>
          <Container className="pb-6">
            <div className="grid gap-px overflow-hidden rounded-[var(--radius-card)] border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
              <Kpi
                value={usd(totals.volumeUsd)}
                label={simulation ? "simulated volume" : "settled volume"}
                tone="success"
              />
              <Kpi value={compact(totals.count)} label="paid calls" />
              <Kpi value={String(totals.distinctPayers)} label="distinct payers" />
              <Kpi
                value={`${Math.round((1 - PLATFORM_FEE) * 100)} / ${Math.round(PLATFORM_FEE * 100)}`}
                label="creator / platform"
              />
            </div>
            {!simulation && totals.lastAt && (
              <p className="stat mt-3 text-muted">
                first settlement {relTime(totals.firstAt!)} · latest {relTime(totals.lastAt)} ·{" "}
                {totals.distinctTools} {totals.distinctTools === 1 ? "tool" : "tools"} sold
              </p>
            )}
          </Container>

          <Container className="pb-6">
            <div className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface">
              <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                <span className="label">earnings by tool</span>
                <span className="label text-muted">{earnings.length}</span>
              </div>
              <div className="divide-y divide-border">
                {earnings.map((e) => {
                  const tool = tools.find((t) => t.slug === e.toolSlug);
                  return (
                    <Link
                      key={e.toolSlug}
                      href={`/tools/${e.toolSlug}`}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 transition-colors duration-200 ease-[var(--ease-out)] hover:bg-tint"
                    >
                      <LogoTile monogram={tool?.monogram ?? "◦"} color={tool?.color} size={34} />
                      <span className="min-w-0 flex-1 truncate text-[14px] font-medium">
                        {e.toolName}
                      </span>
                      <span className="stat shrink-0 text-right">{e.calls} calls</span>
                      <span className="stat hidden shrink-0 text-right text-muted sm:block">
                        {usd(e.grossUsd)} gross
                      </span>
                      <span className="stat shrink-0 text-right text-success">
                        {usd(e.netUsd)} net
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </Container>

          <Container className="pb-6">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <Eyebrow>the payment is the review</Eyebrow>
                <h2 className="mt-2 text-[20px] font-medium tracking-[-0.02em]">
                  {simulation ? "Simulated settlements" : "Settlements, as they clear"}
                </h2>
              </div>
              {!simulation && (
                <span className="label hidden sm:block">every row verifiable on-chain</span>
              )}
            </div>
            <LiveFeed initial={settlements.slice(0, 12)} />
          </Container>

          {!simulation && settlements.length > 0 && (
            <Container className="pb-20">
              <div className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface">
                <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                  <span className="label">on-chain receipts</span>
                  <span className="label text-muted">{settlements.length}</span>
                </div>
                <div className="divide-y divide-border">
                  {settlements.slice(0, 25).map((s) => (
                    <div
                      key={s.id + s.deployHash}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5"
                    >
                      <span className="stat shrink-0 truncate text-muted">{s.payerLabel}</span>
                      <span className="min-w-0 flex-1 truncate text-[13px]">{s.toolName}</span>
                      <span className="stat shrink-0 text-success">{usd(s.amountUsd)}</span>
                      <span className="stat hidden shrink-0 text-muted sm:block">
                        {relTime(s.createdAt)}
                      </span>
                      <a
                        href={explorerTx(s.deployHash)}
                        target="_blank"
                        rel="noreferrer"
                        className="stat shrink-0 text-muted transition-colors hover:text-accent"
                      >
                        {shortHash(s.deployHash)} ↗
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            </Container>
          )}
        </>
      )}
    </main>
  );
}

function Kpi({ value, label, tone }: { value: string; label: string; tone?: "success" }) {
  return (
    <div className="bg-surface p-5">
      <div
        className={clsx(
          "font-mono text-[24px] leading-none tracking-[-0.02em] sm:text-[26px]",
          tone === "success" ? "text-success" : "text-fg",
        )}
      >
        {value}
      </div>
      <div className="label mt-2">{label}</div>
    </div>
  );
}

function SimToggle({ simulation }: { simulation: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="label">data</span>
      <div className="inline-flex rounded-[var(--radius-pill)] border border-border bg-surface p-0.5">
        <Link
          href="/dashboard"
          className={clsx(
            "press label rounded-[var(--radius-pill)] px-3 py-1.5 transition-colors",
            !simulation ? "bg-fg text-surface" : "text-fg-secondary hover:text-fg",
          )}
        >
          real
        </Link>
        <Link
          href="/dashboard?sim=1"
          className={clsx(
            "press label rounded-[var(--radius-pill)] px-3 py-1.5 transition-colors",
            simulation ? "bg-fg text-surface" : "text-fg-secondary hover:text-fg",
          )}
        >
          simulation
        </Link>
      </div>
      {simulation && <Chip tone="accent">demo data</Chip>}
    </div>
  );
}
