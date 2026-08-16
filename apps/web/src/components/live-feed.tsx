"use client";

import { useEffect, useState } from "react";
import { relTime, shortHash, usd } from "@/lib/format";
import { useChainLinks } from "./chain-context";
import type { Settlement } from "@/lib/types";

const KEEP = 12;

// The settlement ledger, live. Seeds from a server snapshot so the first paint
// is never empty, then polls the (uncached) API every 2s. New transactions at
// the top mount fresh DOM nodes, which animate in; settled DOM stays put.
export function LiveFeed({ initial }: { initial: Settlement[] }) {
  const { chain, explorerTx } = useChainLinks();
  const [rows, setRows] = useState<Settlement[]>(() => initial.slice(0, KEEP));

  useEffect(() => {
    let cancelled = false;
    // Polls can overlap (a slow fetch outliving the 2s interval) and resolve out
    // of order. Each tick takes a monotonically increasing ticket and aborts the
    // previous request; only the newest ticket may apply, so a stale response can
    // never overwrite a fresher ledger.
    let seq = 0;
    let ctrl: AbortController | null = null;
    const tick = async () => {
      ctrl?.abort();
      ctrl = new AbortController();
      const mine = ++seq;
      try {
        const res = await fetch("/api/settlements?limit=12", {
          cache: "no-store",
          signal: ctrl.signal,
        });
        if (!res.ok) return;
        const data = (await res.json()) as { settlements?: Settlement[] };
        if (!cancelled && mine === seq && Array.isArray(data.settlements)) {
          setRows(data.settlements.slice(0, KEEP));
        }
      } catch {
        /* transient poll failure or superseded request: keep the last good ledger */
      }
    };
    const id = setInterval(tick, 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
      ctrl?.abort();
    };
  }, []);

  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <span className="label">live settlements</span>
        <span className="stat flex items-center gap-1.5 text-muted">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-success animate-pulse-dot" />
          {rows.length} live
        </span>
      </div>

      <div className="divide-y divide-border">
        {rows.length === 0 && (
          <div className="px-4 py-8 text-center text-[13px] text-muted">
            waiting for settlements…
          </div>
        )}
        {rows.map((s) => (
          <div key={s.id} className="animate-feed-in flex items-center gap-3 px-4 py-2.5">
            <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-success animate-pulse-dot" />
            <span className="stat shrink-0 text-fg-secondary">{s.payerLabel}</span>
            <span className="min-w-0 flex-1 truncate text-[13px] text-fg">{s.toolName}</span>
            <span className="stat shrink-0 text-success">{usd(s.amountUsd)}</span>
            <span className="stat hidden shrink-0 text-muted sm:inline">{relTime(s.createdAt)}</span>
            {/* Only a real settlement has a transaction to look at. A seeded or
                mock row carries a deterministic pseudo-hash, and linking it to
                an explorer would present a fabricated hash as evidence. */}
            {s.mode === "real" ? (
              <a
                href={explorerTx(s.txHash)}
                target="_blank"
                rel="noreferrer"
                className="press stat hidden shrink-0 text-muted transition-colors hover:text-accent sm:inline"
                title={`View transaction on ${chain.explorerName}`}
              >
                {shortHash(s.txHash)}
              </a>
            ) : (
              <span
                className="stat hidden shrink-0 text-muted sm:inline"
                title="simulated settlement: no on-chain transaction"
              >
                {shortHash(s.txHash)}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
