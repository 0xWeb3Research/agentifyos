"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Arrow, Button, Chip, Container, Eyebrow } from "@/components/ui";
import { WireLog } from "@/components/wire-log";
import { WalletConnect, type SessionInfo } from "@/components/wallet-connect";
import { explorerTx } from "@/lib/config";
import { compact, shortHash, usd } from "@/lib/format";
import type { WireStep } from "@/lib/x402/loop";
import type { Receipt } from "@/lib/types";

// ── the agent runner demo ─────────────────────────────────────────────────────
// The client asks the server to run a task, then replays the returned trace
// progressively, one wire step at a time, so a batch response feels like a
// live agent discovering tools and paying for them, call by call.

// The budget the client REQUESTS. The server clamps it to its own cap and
// reports the granted figure back in `budgetUsd`. That value drives the meter.
const BUDGET = 0.1;

// Each tool call is a REAL Casper settlement that waits for on-chain finality
// (~12s), so the default keeps a browser run comfortably short. The four-tool
// "Full run" takes ~100s. Reliable via `pnpm casper:pay` / the API, but long
// enough that a browser request can be cut off before it returns.
const FULL_TASK =
  "You have 0.1 WCSPR. Get the live CSPR price, scrape https://casper.network/blog/agentic-commerce, summarize it, and attest the summary.";

const DEFAULT_TASK = "Get the live CSPR price, then attest the quote on-chain.";

const PRESETS: { label: string; task: string }[] = [
  { label: "Price + attest", task: DEFAULT_TASK },
  {
    label: "Scrape + summarize",
    task: "Scrape https://casper.network/blog/agentic-commerce and summarize the article.",
  },
  { label: "Full run (~100s)", task: FULL_TASK },
];

// When arriving via ?tool=<slug>, prefill a task that features that tool.
const TOOL_TASKS: Record<string, string> = {
  "cspr-market-data": "Get the live CSPR price, then attest the quote on-chain.",
  "page-scraper": "Scrape https://casper.network/blog/agentic-commerce and summarize it.",
  "text-summarizer":
    "Scrape https://casper.network/blog/agentic-commerce, then summarize the article.",
  "rwa-attestor":
    "Get the live CSPR price and notarize the result as an on-chain attestation.",
};

// Per-kind reveal cadence: the on-chain settle gets the longest beat.
const STAGGER: Record<string, number> = {
  request: 130,
  "402": 150,
  sign: 160,
  verify: 200,
  settle: 300,
  result: 160,
  receipt: 190,
  error: 160,
};

type RunStep = {
  reason: string;
  slug: string;
  toolName: string;
  ok: boolean;
  costUsd: number;
  wireSteps: WireStep[];
  result?: unknown;
  receipt?: Receipt;
  error?: string;
};

type RunResponse = {
  ok: boolean;
  task: string;
  wallet: { accountHash: string; publicKey: string; label: string };
  budgetUsd: number;
  budgetRemainingUsd: number;
  totalCostUsd: number;
  steps: RunStep[];
};

type Completed = { step: RunStep; settled: boolean };

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export default function AgentPage() {
  return (
    <main>
      <Container className="pt-16 pb-6 sm:pt-20">
        <div className="animate-fade-up">
          <Eyebrow>live demo · casper testnet</Eyebrow>
          <h1 className="mt-4 max-w-[22ch] text-[32px] font-medium leading-[1.05] tracking-[-0.03em]">
            Watch an agent pay its way
          </h1>
          <p className="mt-3 font-mono text-[13px] leading-relaxed text-fg-secondary">
            one task, four paid tools. Every call metered, signed, and settled on-chain via x402.
          </p>
          <div className="mt-5 flex flex-wrap items-start gap-2.5 rounded-[var(--radius-md)] border border-border bg-surface px-4 py-3">
            <Chip tone="success">open demo</Chip>
            <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-fg-secondary">
              Run it now — no wallet needed. Payments settle from a shared testnet
              wallet under a daily budget, so the run is real but bounded. To use
              your own session instead of the shared budget,{" "}
              <span className="text-fg">sign in with Casper</span>{" "}
              when prompted. It&apos;s testnet — no real money anywhere.
            </p>
          </div>
        </div>
      </Container>
      <Suspense fallback={null}>
        <AgentRunner />
      </Suspense>
    </main>
  );
}

function AgentRunner() {
  const params = useSearchParams();
  const toolParam = params.get("tool");

  const [task, setTask] = useState<string>(
    () => (toolParam && TOOL_TASKS[toolParam]) || DEFAULT_TASK,
  );
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [wireSteps, setWireSteps] = useState<WireStep[]>([]);
  const [completed, setCompleted] = useState<Completed[]>([]);
  const [budget, setBudget] = useState(BUDGET);
  // What the server actually granted after clamping: the meter's denominator.
  const [budgetCap, setBudgetCap] = useState(BUDGET);
  const [wallet, setWallet] = useState<RunResponse["wallet"] | null>(null);
  const [totals, setTotals] = useState<{ totalCostUsd: number; budgetRemainingUsd: number } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);

  const cancelled = useRef(false);
  const wireRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => void (cancelled.current = true), []);

  // Keep the streaming wire log pinned to its latest event.
  useEffect(() => {
    const el = wireRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [wireSteps]);

  const run = useCallback(async () => {
    if (running) return;
    cancelled.current = false;
    setRunning(true);
    setDone(false);
    setError(null);
    setWireSteps([]);
    setCompleted([]);
    setBudget(BUDGET);
    setBudgetCap(BUDGET);
    setTotals(null);

    let data: RunResponse;
    try {
      const res = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ task, budgetUsd: BUDGET }),
      });
      // Non-200s carry a JSON body saying why (401 auth required in real mode,
      // 429 rate limited). Surface the server's reason, don't guess connectivity.
      const body = (await res.json().catch(() => null)) as
        | (RunResponse & { error?: string; reason?: string; retryAfterSec?: number })
        | null;
      if (!res.ok || !body || !Array.isArray(body.steps)) {
        if (res.status === 401) {
          setNeedsAuth(true);
          setError(
            body?.reason ?? "authentication required: sign in with your Casper wallet first.",
          );
        } else if (res.status === 429) {
          setError(
            `rate limited: try again in ${body?.retryAfterSec ? `${body.retryAfterSec}s` : "a moment"}.`,
          );
        } else {
          setError(
            body?.reason ??
              body?.error ??
              (res.ok
                ? "the agent runner returned an unexpected response."
                : `the agent runner returned HTTP ${res.status}.`),
          );
        }
        setRunning(false);
        return;
      }
      data = body;
    } catch {
      setError("could not reach the agent runner. Is the dev server up?");
      setRunning(false);
      return;
    }
    if (cancelled.current) return;
    setWallet(data.wallet);

    // The server clamps the requested budget to its own cap. Render the budget
    // it reports back, not the value we asked for.
    const granted = typeof data.budgetUsd === "number" && data.budgetUsd >= 0
      ? data.budgetUsd
      : BUDGET;
    setBudgetCap(granted);
    setBudget(granted);

    // Replay the trace: announce each thought, stream its wire steps, then land
    // the receipt and tick the budget down, one tool at a time.
    const acc: WireStep[] = [];
    let seq = 0;

    for (let i = 0; i < data.steps.length; i++) {
      const step = data.steps[i];
      setCompleted((prev) => [...prev, { step, settled: false }]);
      await sleep(150);
      if (cancelled.current) return;

      for (const ws of step.wireSteps) {
        acc.push({ ...ws, seq: seq++ });
        setWireSteps(acc.slice());
        await sleep(STAGGER[ws.kind] ?? 170);
        if (cancelled.current) return;
      }

      setCompleted((prev) => prev.map((c, idx) => (idx === i ? { ...c, settled: true } : c)));
      if (step.ok) setBudget((b) => +(b - step.costUsd).toFixed(4));
      await sleep(240);
      if (cancelled.current) return;
      if (!step.ok) break;
    }

    setTotals({ totalCostUsd: data.totalCostUsd, budgetRemainingUsd: data.budgetRemainingUsd });
    setDone(true);
    setRunning(false);
  }, [task, running]);

  const settledCount = completed.filter((c) => c.settled && c.step.ok).length;

  return (
    <>
      {/* ── control panel ─────────────────────────────────────────────── */}
      <Container className="pb-6">
        <div
          className="animate-fade-up rounded-[var(--radius-card)] border border-border bg-surface p-5 sm:p-6"
          style={{ animationDelay: "60ms" }}
        >
          <div className="mb-3 flex items-center justify-between gap-4">
            <Eyebrow>the task</Eyebrow>
            <div className="flex items-center gap-2">
              <span className="label">agent</span>
              <span className="font-mono text-[12px] text-fg">{wallet?.label ?? "atlas-01"}</span>
              {wallet && (
                <span className="font-mono text-[12px] text-muted">
                  {shortHash(wallet.accountHash)}
                </span>
              )}
            </div>
          </div>

          <textarea
            value={task}
            onChange={(e) => setTask(e.target.value)}
            rows={3}
            spellCheck={false}
            disabled={running}
            placeholder="Describe a task for the agent…"
            className="w-full resize-none rounded-[var(--radius-md)] border border-border bg-bg px-3.5 py-3 text-[14px] leading-relaxed text-fg outline-none transition-colors placeholder:text-muted focus:border-border-hover disabled:opacity-60"
          />

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="label mr-1">presets</span>
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setTask(p.task)}
                disabled={running}
                className="press rounded-[var(--radius-pill)] border border-border bg-tint px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.05em] text-fg-secondary transition-colors hover:border-border-hover hover:text-fg disabled:opacity-50"
              >
                {p.label}
              </button>
            ))}

            <div className="ml-auto flex items-center gap-4">
              <div className="min-w-[132px]">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="label">budget</span>
                  <span className="font-mono text-[13px] tabular-nums text-fg">
                    {budget.toFixed(3)}
                    <span className="text-muted"> WCSPR</span>
                  </span>
                </div>
                <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-tint">
                  <div
                    className="h-full rounded-full bg-success transition-[width] duration-500 ease-[var(--ease-out)]"
                    style={{
                      width: `${budgetCap > 0 ? Math.max(0, (budget / budgetCap) * 100) : 0}%`,
                    }}
                  />
                </div>
              </div>
              <Button onClick={run} disabled={running}>
                {running ? "Running…" : "Run agent"}
                {!running && <Arrow />}
              </Button>
            </div>
          </div>

          {error && (
            <div className="mt-3 flex flex-col gap-3">
              <div className="inline-flex items-start gap-2 self-start rounded-[var(--radius-sm)] border border-error/30 bg-error-tint px-3 py-1.5 text-[13px] text-error">
                <span className="mt-[2px] font-mono text-[11px] uppercase tracking-[0.05em]">error</span>
                <span className="min-w-0">{error}</span>
              </div>

              {/* An auth error is only useful if you can act on it from here. */}
              {needsAuth && (
                <div className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-border bg-surface p-4">
                  <p className="text-[13px] leading-relaxed text-fg-secondary">
                    This demo spends real WCSPR from the server&apos;s wallet, so it
                    asks who you are first. Signing costs nothing and moves no funds
                    from your account.
                  </p>
                  <WalletConnect
                    onSession={(s: SessionInfo | null) => {
                      if (s) {
                        setNeedsAuth(false);
                        setError(null);
                      }
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </Container>

      {/* ── two-column result ─────────────────────────────────────────── */}
      <Container className="pb-16">
        <div className="grid gap-6 lg:grid-cols-2">
          {/* LEFT: reasoning + receipts */}
          <div className="animate-fade-up" style={{ animationDelay: "120ms" }}>
            <div className="mb-3 flex items-center justify-between">
              <Eyebrow>agent trace</Eyebrow>
              {settledCount > 0 && <Chip tone="success">{compact(settledCount)} settled</Chip>}
            </div>
            {completed.length === 0 ? (
              <div className="rounded-[var(--radius-card)] border border-dashed border-border bg-surface/50 px-5 py-12 text-center text-[13px] text-muted">
                {running
                  ? "the agent is planning…"
                  : "run the agent to watch it reason, call tools, and pay per call."}
              </div>
            ) : (
              <ol className="relative space-y-4">
                {completed.map(({ step, settled }, i) => (
                  <StepItem
                    key={i}
                    step={step}
                    settled={settled}
                    index={i}
                    isLast={i === completed.length - 1}
                  />
                ))}
              </ol>
            )}
          </div>

          {/* RIGHT: live wire log */}
          <div
            className="animate-fade-up lg:sticky lg:top-6 lg:self-start"
            style={{ animationDelay: "160ms" }}
          >
            <div className="mb-3 flex items-center justify-between">
              <Eyebrow>x402 on the wire</Eyebrow>
              <span className="label text-muted">{compact(wireSteps.length)} events</span>
            </div>
            <div ref={wireRef} className="max-h-[72vh] overflow-y-auto rounded-[var(--radius-md)]">
              <WireLog steps={wireSteps} />
            </div>
          </div>
        </div>
      </Container>

      {/* ── final summary bar ─────────────────────────────────────────── */}
      {done && totals && (
        <Container className="pb-20">
          <div className="animate-fade-up flex flex-col items-start justify-between gap-5 rounded-[var(--radius-card)] border border-border bg-fg px-6 py-6 text-surface sm:flex-row sm:items-center">
            <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
              <SummaryStat value={usd(totals.totalCostUsd)} label="total paid" />
              <span className="hidden h-8 w-px bg-surface/15 sm:block" />
              <SummaryStat value={String(settledCount)} label="settlements" />
              <span className="hidden h-8 w-px bg-surface/15 sm:block" />
              <SummaryStat
                value={`${totals.budgetRemainingUsd.toFixed(3)} WCSPR`}
                label="left in wallet"
              />
            </div>
            <p className="font-mono text-[13px] text-surface/70">the payment is the review.</p>
          </div>
        </Container>
      )}
    </>
  );
}

// ── one planned step: the agent's thought, its call, and the receipt ──────────
function StepItem({
  step,
  settled,
  index,
  isLast,
}: {
  step: RunStep;
  settled: boolean;
  index: number;
  isLast: boolean;
}) {
  const num = String(index + 1).padStart(2, "0");
  return (
    <li className="relative animate-fade-up pl-9">
      <span className="absolute left-0 top-0 grid h-6 w-6 place-items-center rounded-full border border-border bg-surface font-mono text-[11px] tabular-nums text-fg-secondary">
        {num}
      </span>
      {!isLast && (
        <span className="absolute -bottom-4 left-[11.5px] top-7 w-px bg-border" aria-hidden />
      )}
      <div className="pb-1">
        <p className="text-[13.5px] leading-snug text-fg">{step.reason}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <span className="font-mono text-[12px] text-fg-secondary">{step.slug}</span>
          {!settled ? (
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.05em] text-accent">
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse-dot" />
              signing &amp; settling
            </span>
          ) : step.ok && step.receipt ? (
            <ReceiptChip receipt={step.receipt} costUsd={step.costUsd} />
          ) : (
            <ErrorChip
              message={
                step.error === "budget_exceeded"
                  ? "budget exceeded: agent stopped to stay in wallet"
                  : step.error ?? "call failed"
              }
            />
          )}
        </div>
        {settled && step.ok && (
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-fg-secondary">
            {summarizeResult(step.slug, step.result)}
          </p>
        )}
      </div>
    </li>
  );
}

function ReceiptChip({ receipt, costUsd }: { receipt: Receipt; costUsd: number }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-[var(--radius-sm)] border border-border bg-bg px-2.5 py-1">
      <span className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.05em] text-success">
        <CheckIcon />
        settled
      </span>
      <span className="font-mono text-[12px] font-medium tabular-nums text-fg">{usd(costUsd)}</span>
      <a
        href={explorerTx(receipt.deployHash)}
        target="_blank"
        rel="noopener noreferrer"
        className="press group inline-flex items-center gap-1 font-mono text-[12px] text-accent hover:underline"
      >
        {shortHash(receipt.deployHash)}
        <Arrow className="opacity-60 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </a>
    </span>
  );
}

function ErrorChip({ message }: { message: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-error/25 bg-error-tint px-2.5 py-1 text-[12px] text-error">
      <span className="font-mono text-[11px] uppercase tracking-[0.05em]">failed</span>
      {message}
    </span>
  );
}

function SummaryStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-mono text-[18px] tabular-nums tracking-[-0.01em] text-surface">
        {value}
      </span>
      <span className="font-mono text-[11px] uppercase tracking-[0.05em] text-surface/50">
        {label}
      </span>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path
        d="M2.5 6.5L5 9L9.5 3.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// A one-line, human summary of a tool's JSON result for the receipt row.
function summarizeResult(slug: string, result: unknown): string {
  const r = (result ?? {}) as Record<string, unknown>;
  if (slug === "cspr-market-data") {
    const p = Number(r.priceUsd);
    const c = Number(r.change24hPct);
    if (!Number.isNaN(p)) {
      return `CSPR $${p.toFixed(4)} · ${c >= 0 ? "+" : ""}${c.toFixed(2)}% 24h`;
    }
  }
  if (slug === "page-scraper") {
    const wc = Number(r.wordCount);
    const title = String(r.title ?? "page");
    return `${title} · ${Number.isNaN(wc) ? "?" : wc} words extracted`;
  }
  if (slug === "text-summarizer") {
    const s = String(r.summary ?? "");
    if (s) return s.length > 120 ? s.slice(0, 117) + "…" : s;
    return `${Number(r.sentenceCount) || 0} sentences condensed`;
  }
  if (slug === "rwa-attestor") {
    const id = String(r.attestationId ?? "");
    return id ? `attestation ${shortHash(id, 8, 4)} signed by notary` : "attestation issued";
  }
  return "result delivered";
}
