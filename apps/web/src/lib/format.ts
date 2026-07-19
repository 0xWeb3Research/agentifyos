import { CSPR_PRICE_USD, CSPR } from "./config";

export function usd(n: number): string {
  if (n === 0) return "$0";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  if (n < 1) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(2)}`;
}

const compactFmt = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});
export function compact(n: number): string {
  return compactFmt.format(n);
}

export function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export function shortHash(h: string, head = 6, tail = 4): string {
  if (!h) return "";
  if (h.length <= head + tail + 1) return h;
  return `${h.slice(0, head)}…${h.slice(-tail)}`;
}

// USD → WCSPR atomic units (9 decimals) at the illustrative CSPR price.
export function toAtomic(amountUsd: number): string {
  const decimals = Number(CSPR.asset.decimals);
  const cspr = amountUsd / CSPR_PRICE_USD;
  return BigInt(Math.round(cspr * 10 ** decimals)).toString();
}

export function relTime(iso: string, now = Date.now()): string {
  const then = new Date(iso).getTime();
  const s = Math.max(0, Math.round((now - then) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

export function stars(rating: number): string {
  return rating.toFixed(2);
}
