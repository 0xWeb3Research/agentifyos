"use client";

import { useMemo, useState } from "react";
import { clsx } from "clsx";
import { ToolCard, isLive } from "@/components/tool-card";
import type { ToolWithStats } from "@/lib/types";

// Price ceilings for the quick filter — strict "less than" thresholds.
const PRICE_FILTERS: { label: string; max: number | null }[] = [
  { label: "Any price", max: null },
  { label: "< $0.005", max: 0.005 },
  { label: "< $0.01", max: 0.01 },
];

export function Catalog({
  tools,
  categories,
}: {
  tools: ToolWithStats[];
  categories: { name: string; count: number }[];
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [priceMax, setPriceMax] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const words = q ? q.split(/\s+/) : [];
    return tools.filter((t) => {
      if (category && t.category !== category) return false;
      if (priceMax !== null && t.primaryPrice >= priceMax) return false;
      if (!words.length) return true;
      const hay =
        `${t.name} ${t.tagline} ${t.tags.join(" ")} ${t.category}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [tools, query, category, priceMax]);

  // Callable tools first — "coming soon" listings sink to the bottom.
  const ordered = useMemo(
    () => [...filtered].sort((a, b) => Number(isLive(b)) - Number(isLive(a))),
    [filtered],
  );
  const liveCount = useMemo(() => filtered.filter(isLive).length, [filtered]);

  return (
    <div>
      {/* ── filter bar ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        {/* search + live result count */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <svg
              width="15"
              height="15"
              viewBox="0 0 15 15"
              fill="none"
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            >
              <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.3" />
              <path d="M10 10L13.5 13.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tools, tags, categories…"
              aria-label="Search tools"
              className="h-10 w-full rounded-[var(--radius-sm)] border border-border bg-surface pl-9 pr-3.5 text-[14px] text-fg placeholder:text-muted transition-colors duration-200 ease-[var(--ease-out)] hover:border-border-hover focus:border-fg focus-visible:outline-none"
            />
          </div>
          <span className="stat shrink-0 tabular-nums text-muted">
            {liveCount} live
            {filtered.length - liveCount > 0 && (
              <span className="text-muted"> · {filtered.length - liveCount} coming soon</span>
            )}
          </span>
        </div>

        {/* category pills */}
        <div className="flex flex-wrap items-center gap-2">
          <Pill active={category === null} onClick={() => setCategory(null)}>
            All
          </Pill>
          {categories.map((c) => (
            <Pill
              key={c.name}
              active={category === c.name}
              onClick={() => setCategory(category === c.name ? null : c.name)}
            >
              {c.name}
              <span
                className={clsx(
                  "font-mono text-[11px] tabular-nums",
                  category === c.name ? "text-surface/60" : "text-muted",
                )}
              >
                {c.count}
              </span>
            </Pill>
          ))}
        </div>

        {/* price pills */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="label mr-1">price</span>
          {PRICE_FILTERS.map((p) => (
            <Pill
              key={p.label}
              active={priceMax === p.max}
              onClick={() => setPriceMax(p.max)}
            >
              <span className={p.max === null ? "" : "font-mono text-[12px] tabular-nums"}>
                {p.label}
              </span>
            </Pill>
          ))}
        </div>
      </div>

      {/* ── results ────────────────────────────────────────────────── */}
      {ordered.length > 0 ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ordered.map((t, i) => (
            <ToolCard key={t.id} tool={t} index={i} />
          ))}
        </div>
      ) : (
        <div className="mt-8 flex flex-col items-center justify-center gap-1.5 rounded-[var(--radius-card)] border border-dashed border-border py-24 text-center">
          <p className="stat text-fg-secondary">No tools match. Try a broader search</p>
          <p className="label">adjust your filters or clear the search</p>
        </div>
      )}
    </div>
  );
}

// ── filter pill ───────────────────────────────────────────────────────────
function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        "press inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-pill)] border px-3 text-[13px] font-medium",
        "transition-colors duration-200 ease-[var(--ease-out)]",
        active
          ? "border-transparent bg-fg text-surface"
          : "border-border bg-surface text-fg-secondary hover:border-border-hover hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}
