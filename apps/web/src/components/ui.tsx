import Link from "next/link";
import { clsx } from "clsx";
import type { Capability, ToolStatus } from "@/lib/types";

// ── logo tile ─────────────────────────────────────────────────────────────
// Uniform rounded square that normalizes heterogeneous marks into one calm
// texture — the single highest-leverage move borrowed from designsystems.surf.
export function LogoTile({
  monogram,
  color,
  size = 44,
  className,
}: {
  monogram: string;
  color?: string;
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={clsx("tile shrink-0", className)}
      style={{ width: size, height: size, background: color ?? "var(--color-tint)" }}
    >
      <span
        className="font-mono text-fg/80"
        style={{ fontSize: Math.round(size * 0.42), lineHeight: 1 }}
      >
        {monogram}
      </span>
    </div>
  );
}

// ── capability chip ─────────────────────────────────────────────────────────
const CAP_LABEL: Record<Capability, string> = {
  x402: "x402",
  mcp: "MCP",
  rest: "REST",
  streaming: "STREAM",
  "free-trial": "FREE TRIAL",
};
export function Chip({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "muted" | "accent" | "success";
}) {
  return (
    <span
      className={clsx(
        "label inline-flex items-center rounded-[var(--radius-pill)] border px-2 py-[3px] leading-none",
        tone === "muted" && "border-border bg-tint text-fg-secondary",
        tone === "accent" && "border-transparent bg-accent-tint text-accent",
        tone === "success" && "border-transparent bg-success-tint text-success",
      )}
    >
      {children}
    </span>
  );
}
export function CapabilityChip({ cap }: { cap: Capability }) {
  return <Chip tone={cap === "free-trial" ? "success" : "muted"}>{CAP_LABEL[cap]}</Chip>;
}

// ── status pill ──────────────────────────────────────────────────────────────
export function StatusPill({ status }: { status: ToolStatus }) {
  const verified = status === "verified";
  return (
    <span className="label inline-flex items-center gap-1.5">
      <span
        className={clsx(
          "inline-block h-1.5 w-1.5 rounded-full",
          verified ? "bg-success" : "bg-muted",
        )}
      />
      {verified ? "verified" : status === "draft" ? "draft" : "unverified"}
    </span>
  );
}

// ── buttons ──────────────────────────────────────────────────────────────────
type BtnProps = {
  children: React.ReactNode;
  href?: string;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
  className?: string;
  type?: "button" | "submit";
  onClick?: () => void;
  disabled?: boolean;
};
function btnClass(variant: BtnProps["variant"], size: BtnProps["size"]) {
  return clsx(
    "press inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-sm)] font-medium transition-colors",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
    size === "sm" ? "h-8 px-3 text-[13px]" : "h-10 px-4 text-sm",
    variant === "primary" &&
      "bg-fg text-surface hover:bg-fg/90 disabled:opacity-40 disabled:pointer-events-none",
    variant === "secondary" &&
      "border border-border bg-surface text-fg hover:border-border-hover disabled:opacity-40",
    variant === "ghost" && "text-fg-secondary hover:text-fg hover:bg-tint",
  );
}
export function Button({
  children,
  href,
  variant = "primary",
  size = "md",
  className,
  type = "button",
  onClick,
  disabled,
}: BtnProps) {
  const cls = clsx(btnClass(variant, size), className);
  if (href)
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  return (
    <button type={type} className={cls} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

// ── arrow that nudges on hover (surf's link affordance) ──────────────────────
export function Arrow({ className }: { className?: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      className={clsx("transition-transform duration-200 ease-[var(--ease-out)]", className)}
      aria-hidden
    >
      <path d="M3 11L11 3M11 3H5M11 3V9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── section shell ────────────────────────────────────────────────────────────
export function Container({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={clsx("mx-auto w-full max-w-[1200px] px-4 sm:px-6", className)}>{children}</div>;
}

// ── mono eyebrow label ───────────────────────────────────────────────────────
export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <span className="label">{children}</span>;
}
