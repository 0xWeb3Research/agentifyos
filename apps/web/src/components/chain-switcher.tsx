"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { NETWORK_IDS, networkMeta, type NetworkId } from "@/lib/chain";

// Writing the cookie from the browser (rather than posting to a route) keeps the
// switch to one round trip: set it, then ask the server to re-render. It is a
// display and settlement preference, not a credential, so it does not need to be
// httpOnly. SameSite=Lax stops another site from flipping which chain a visitor
// is about to pay on.
const COOKIE = "agentifyos-chain";
const ONE_YEAR = 60 * 60 * 24 * 365;

export interface ChainSwitcherProps {
  /** Which networks this deployment can actually use, from `chainReadiness()`. */
  ready: Record<NetworkId, boolean>;
  /** The selected network, resolved from the cookie on the server. */
  active: NetworkId;
  className?: string;
}

export function ChainSwitcher({ ready, active, className }: ChainSwitcherProps) {
  const activeMeta = networkMeta(active);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const root = useRef<HTMLDivElement>(null);

  // Close on an outside click or Escape. Without this the menu survives a
  // navigation tap on a phone and sits over the page.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function choose(id: NetworkId) {
    setOpen(false);
    if (id === active) return;
    document.cookie = `${COOKIE}=${id}; path=/; max-age=${ONE_YEAR}; SameSite=Lax`;
    // refresh() re-runs the server components, which re-read the cookie and
    // re-seed the chain provider. Everything downstream follows from that.
    startTransition(() => router.refresh());
  }

  return (
    <div ref={root} className={clsx("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Network: ${activeMeta.networkLabel}. Change it.`}
        className={clsx(
          "label press inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border px-2.5 py-1",
          "border-border bg-surface transition-colors hover:border-border-hover",
          pending && "opacity-60",
        )}
      >
        <span
          className={clsx(
            "inline-block h-1.5 w-1.5 rounded-full",
            ready[active] ? "animate-pulse-dot bg-success" : "bg-warn",
          )}
        />
        {activeMeta.networkLabel.toLowerCase()}
        <svg
          width="9"
          height="9"
          viewBox="0 0 10 10"
          aria-hidden="true"
          className={clsx("shrink-0 transition-transform", open && "rotate-180")}
        >
          <path d="M1 3.5 5 7l4-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 top-[calc(100%+6px)] z-50 w-[288px] overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface shadow-lg"
        >
          {/*
            Two sections, because these are two different kinds of thing. The
            settlement chains decide who gets paid. Midnight decides who gets to
            know. Listing them under one heading would imply Nightpass moves
            money, which it does not.
          */}
          {(["settlement", "access"] as const).map((role) => {
            const ids = NETWORK_IDS.filter((id) => networkMeta(id).role === role);
            if (ids.length === 0) return null;
            return (
              <div key={role}>
                <p className="border-b border-border px-3 py-2 text-[11px] uppercase tracking-[0.08em] text-muted">
                  {role === "settlement" ? "settle payments on" : "prove access on"}
                </p>
                {ids.map((id) => {
                  const meta = networkMeta(id);
                  const isActive = id === active;
                  return (
                    <button
                      key={id}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      onClick={() => choose(id)}
                      className={clsx(
                        "flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors",
                        isActive ? "bg-tint" : "hover:bg-tint",
                      )}
                    >
                      <span
                        className={clsx(
                          "mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full",
                          isActive ? "bg-success" : "bg-border-hover",
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline gap-2">
                          <span className="text-[14px] font-medium">{meta.networkLabel}</span>
                          {!ready[id] && (
                            <span className="text-[11px] text-warn">
                              {id === "midnight" ? "not deployed here" : "not configured here"}
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 block text-[12px] leading-snug text-fg-secondary">
                          {meta.symbol} · {meta.tagline}
                        </span>
                        <span className="mt-0.5 block font-mono text-[11px] text-muted">
                          {meta.ref.length > 34 ? meta.ref.slice(0, 34) + "…" : meta.ref}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
          <p className="border-t border-border px-3 py-2 text-[12px] leading-snug text-fg-secondary">
            {active === "midnight"
              ? "Nightpass proves an agent may call a tool without revealing which agent it is. Payment still settles on a chain above."
              : "Switching changes what every price is quoted in, where receipts resolve, and which signer moves the money."}
          </p>
        </div>
      )}
    </div>
  );
}
