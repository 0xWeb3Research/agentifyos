"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { clsx } from "clsx";

/*
 * Drives a real agent on Midnight from the page.
 *
 * Every button here settles an actual transaction, so the component is mostly
 * about being honest when it cannot: the wallet takes minutes to sync from
 * cold, the daily allowance is finite, and one wallet signs one transaction at
 * a time. Each of those states says what it is rather than showing a dead
 * button.
 */

type Phase = "unconfigured" | "starting" | "syncing" | "ready" | "error";

type Agent = {
  phase: Phase;
  progress: number | null;
  message: string;
  network: string;
  contractAddress: string | null;
  queueDepth: number;
};

type Budget = { enabled: boolean; unit: string; spent: number; cap: number; remaining: number };

type Pass = { secretHex: string; nonceHex: string; slug: string; calls: number } | null;

type Entry = { action: string; label: string; value: string; txId: string; blockHeight: number };

const short = (s: string, keep = 14) => (s.length <= keep * 2 ? s : `${s.slice(0, keep)}…${s.slice(-6)}`);

export function NightpassRun({ onAudit }: { onAudit?: (p: { secretHex: string; nonceHex: string; slug: string; calls: number }) => void }) {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [budget, setBudget] = useState<Budget | null>(null);
  const [pass, setPass] = useState<Pass>(null);
  const [quota, setQuota] = useState(5);
  const [log, setLog] = useState<Entry[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/nightpass/run", { cache: "no-store" });
      const d = await r.json();
      setAgent(d.agent);
      setBudget(d.budget);
      setPass(d.pass ?? null);
      if (d.demo?.quota) setQuota(d.demo.quota);
    } catch {
      /* transient; the next poll tries again */
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Poll only while the wallet is warming up, then stop.
  useEffect(() => {
    const warming = agent?.phase === "starting" || agent?.phase === "syncing";
    if (warming && !poll.current) {
      poll.current = setInterval(() => void refresh(), 5000);
    }
    if (!warming && poll.current) {
      clearInterval(poll.current);
      poll.current = null;
    }
    return () => {
      if (poll.current) {
        clearInterval(poll.current);
        poll.current = null;
      }
    };
  }, [agent?.phase, refresh]);

  const run = useCallback(
    async (action: "issuePass" | "redeemCall" | "attest", label: string) => {
      setBusy(action);
      setErr(null);
      try {
        const r = await fetch("/api/nightpass/run", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.reason ?? d.error ?? `HTTP ${r.status}`);
        setLog((l) => [...l, { action, label, value: d.value, txId: d.txId, blockHeight: d.blockHeight }]);
        setAgent(d.agent);
        setBudget(d.budget);
        setPass(d.pass ?? null);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "the run failed");
      } finally {
        setBusy(null);
      }
    },
    [],
  );

  const ready = agent?.phase === "ready";
  const warming = agent?.phase === "starting" || agent?.phase === "syncing";
  const exhausted = budget ? budget.enabled && budget.remaining <= 0 : false;
  const callsLeft = pass ? quota - pass.calls : quota;

  const btn =
    "press rounded-[var(--radius-sm)] px-3 py-1.5 text-[13px] font-medium disabled:opacity-40 disabled:cursor-not-allowed";
  const primary = clsx(btn, "bg-fg text-surface hover:bg-fg/90");
  const secondary = clsx(btn, "border border-border bg-surface hover:border-border-hover");

  return (
    <div className="rounded-[var(--radius-md)] border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <span className="stat text-muted">00</span>
        <h3 className="text-[15px] font-medium tracking-[-0.01em]">Run one yourself, on Midnight</h3>
        <span className="label ml-auto text-muted">
          {agent?.network ?? "midnight"} · real transactions
        </span>
      </div>

      <p className="mt-3 text-[13px] leading-relaxed text-fg-secondary">
        These buttons drive a funded agent on the live network. You get your own
        pass secret, so the calls below are genuinely yours and you can audit
        them in step 3 afterwards. Proving happens on our server because a
        browser has no proof server, which is exactly why an agent proves
        locally in the real design.
      </p>

      {/* status ------------------------------------------------------------ */}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-y border-border py-2.5">
        <span className="label flex items-center gap-1.5">
          <span
            className={clsx(
              "inline-block h-1.5 w-1.5 rounded-full",
              ready ? "bg-success" : warming ? "animate-pulse-dot bg-warn" : "bg-error",
            )}
          />
          {agent?.phase ?? "checking"}
          {warming && agent?.progress !== null && agent?.progress !== undefined ? ` ${agent.progress}%` : ""}
        </span>
        {budget && (
          <span className="label text-muted">
            {budget.enabled
              ? `daily allowance ${budget.spent} / ${budget.cap} tx`
              : "daily allowance off"}
          </span>
        )}
        {pass && (
          <span className="label text-muted">
            your pass · {pass.calls} of {quota} calls spent
          </span>
        )}
        {agent && agent.queueDepth > 0 && (
          <span className="label text-muted">{agent.queueDepth} queued</span>
        )}
      </div>

      {warming && (
        <p className="mt-3 text-[13px] leading-relaxed text-fg-secondary">
          The wallet is syncing with Midnight. A cold start walks about 110,000
          index entries and takes ten to fifteen minutes, so this is genuinely
          working rather than stuck. Everything else on this page keeps working
          meanwhile.
        </p>
      )}
      {agent?.phase === "unconfigured" && (
        <p className="mt-3 text-[13px] leading-relaxed text-fg-secondary">
          No demo wallet is configured on this deployment, so the live run is
          off. The verification steps below still read the real contract.
        </p>
      )}
      {agent?.phase === "error" && (
        <p className="mt-3 text-[13px] leading-relaxed text-error">{agent.message}</p>
      )}
      {exhausted && (
        <p className="mt-3 text-[13px] leading-relaxed text-fg-secondary">
          Today&apos;s allowance is spent. It resets at midnight UTC, and the repo
          runs the same flow against your own wallet.
        </p>
      )}

      {/* actions ----------------------------------------------------------- */}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className={primary}
          disabled={!ready || busy !== null || exhausted || Boolean(pass)}
          onClick={() => run("issuePass", "pass commitment")}
        >
          {busy === "issuePass" ? "buying…" : "1. Buy a pass"}
        </button>
        <button
          type="button"
          className={secondary}
          disabled={!ready || busy !== null || exhausted || !pass || callsLeft <= 0}
          onClick={() => run("redeemCall", "call nullifier")}
        >
          {busy === "redeemCall" ? "spending…" : `2. Spend a call${pass ? ` (${callsLeft} left)` : ""}`}
        </button>
        <button
          type="button"
          className={secondary}
          disabled={!ready || busy !== null || exhausted || !pass || pass.calls === 0}
          onClick={() => run("attest", "audit tag")}
        >
          {busy === "attest" ? "attesting…" : "3. Attest to an auditor"}
        </button>
        {pass && pass.calls > 0 && onAudit && (
          <button type="button" className={secondary} onClick={() => onAudit(pass)}>
            Audit these calls below
          </button>
        )}
      </div>

      {err && <p className="mt-3 text-[13px] text-error">{err}</p>}

      {/* results ----------------------------------------------------------- */}
      {log.length > 0 && (
        <div className="mt-4">
          {log.map((e, i) => (
            <div key={`${e.txId}-${i}`} className="border-b border-border/60 py-2 last:border-0">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="label shrink-0 text-muted">{e.label}</span>
                <span className="min-w-0 break-all font-mono text-[11.5px] text-fg-secondary">
                  {e.value}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
                <span className="label shrink-0 text-muted">tx</span>
                <span className="min-w-0 break-all font-mono text-[11.5px] text-fg-secondary">
                  {short(e.txId, 20)}
                </span>
                <span className="label text-muted">block {e.blockHeight}</span>
              </div>
            </div>
          ))}
          <p className="mt-3 text-[13px] leading-relaxed text-fg-secondary">
            Those nullifiers came from one pass and share nothing. The contract
            counted the calls; it never recorded who made them.
          </p>
        </div>
      )}
    </div>
  );
}
