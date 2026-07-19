import Link from "next/link";
import { clsx } from "clsx";
import { compact, pct, usd } from "@/lib/format";
import type { ToolWithStats } from "@/lib/types";
import { Arrow, CapabilityChip, Chip, LogoTile, StatusPill } from "./ui";

/** Only tools backed by a real handler can actually be called today. */
export function isLive(tool: Pick<ToolWithStats, "handler">): boolean {
  return !!tool.handler;
}

export function ToolCard({
  tool,
  index = 0,
  /** Render as a plain card (no navigation) — used by the publish preview. */
  preview = false,
}: {
  tool: ToolWithStats;
  index?: number;
  preview?: boolean;
}) {
  const featured = !!tool.featured;
  const live = isLive(tool);

  const body = (
    <>
      {featured && live && (
        <span className="label absolute right-4 top-4 text-accent">featured</span>
      )}

      <div className="flex items-start gap-3.5">
        <LogoTile
          monogram={tool.monogram}
          color={tool.color}
          size={44}
          className={clsx(!live && "opacity-60")}
        />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-medium leading-tight tracking-[-0.01em]">
            {tool.name || "Your tool"}
          </h3>
          <p className="mt-0.5 truncate text-[13px] text-muted">{tool.publisher.handle}</p>
        </div>
        {live ? (
          !featured && <StatusPill status={tool.status} />
        ) : (
          <Chip>soon</Chip>
        )}
      </div>

      <p className="mt-3.5 line-clamp-2 text-[13px] leading-relaxed text-fg-secondary">
        {tool.tagline}
      </p>

      {/* stat fingerprint at rest → capability chips on hover, same slot */}
      <div className="relative mt-4 h-6">
        <div className="stat absolute inset-0 flex items-center gap-2 transition-opacity duration-200 ease-[var(--ease-out)] group-hover:opacity-0">
          <span className={clsx(live ? "text-fg" : "text-muted")}>
            {usd(tool.primaryPrice)}
          </span>
          <span className="text-border-hover">·</span>
          {live ? (
            <>
              <span>{compact(tool.stats.totalCalls)} calls</span>
              <span className="text-border-hover">·</span>
              <span className="text-success">{pct(tool.stats.successRate)}</span>
            </>
          ) : (
            <span className="text-muted">not callable yet</span>
          )}
        </div>
        <div className="absolute inset-0 flex translate-y-1 items-center gap-1.5 opacity-0 transition-[opacity,transform] duration-200 ease-[var(--ease-out)] group-hover:translate-y-0 group-hover:opacity-100">
          {tool.capabilities.slice(0, 4).map((c) => (
            <CapabilityChip key={c} cap={c} />
          ))}
          {!preview && (
            <Arrow className="ml-auto text-fg group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          )}
        </div>
      </div>
    </>
  );

  const className = clsx(
    "group relative flex flex-col rounded-[var(--radius-card)] border bg-surface p-5",
    "transition-[transform,border-color,box-shadow] duration-200 ease-[var(--ease-out)]",
    !preview && "hover:-translate-y-0.5 hover:border-border-hover hover:shadow-[var(--shadow-hover)]",
    "animate-fade-up",
    featured && live ? "border-accent/25 bg-accent-tint/40" : "border-border",
    !live && "bg-surface/60",
  );
  const style = { animationDelay: `${Math.min(index, 12) * 35}ms` };

  // The publish preview isn't a real listing yet, so it must not navigate.
  if (preview) {
    return (
      <div className={className} style={style}>
        {body}
      </div>
    );
  }

  return (
    <Link href={`/tools/${tool.slug}`} className={className} style={style}>
      {body}
    </Link>
  );
}
