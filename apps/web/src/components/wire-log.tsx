import { clsx } from "clsx";
import type { StepKind, WireStep } from "@/lib/x402/loop";

const KIND_COLOR: Record<StepKind, string> = {
  request: "bg-muted",
  "402": "bg-warn",
  sign: "bg-accent",
  verify: "bg-accent",
  settle: "bg-success",
  result: "bg-success",
  receipt: "bg-success",
  error: "bg-error",
};

const KIND_LABEL: Record<StepKind, string> = {
  request: "REQ",
  "402": "402",
  sign: "SIG",
  verify: "VRF",
  settle: "STL",
  result: "200",
  receipt: "RCP",
  error: "ERR",
};

// The protocol wire-log — raw 402 → signature → verify → settle → receipt.
// The protocol IS the hero visual, so we show the actual JSON on the wire.
export function WireLog({
  steps,
  className,
  dense,
}: {
  steps: WireStep[];
  className?: string;
  dense?: boolean;
}) {
  return (
    <div
      className={clsx(
        "overflow-hidden rounded-[var(--radius-md)] border border-border bg-surface",
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-border px-3.5 py-2">
        <span className="label">x402 wire log</span>
        <span className="label text-muted">casper:casper-test</span>
      </div>
      <div className="divide-y divide-border">
        {steps.length === 0 && (
          <div className="px-3.5 py-6 text-center text-[13px] text-muted">
            waiting for the agent…
          </div>
        )}
        {steps.map((s) => (
          <div key={s.seq} className="animate-feed-in px-3.5 py-2.5">
            <div className="flex items-center gap-2.5">
              <span
                className={clsx(
                  "grid h-5 min-w-[34px] place-items-center rounded-[5px] font-mono text-[10px] font-medium text-surface",
                  KIND_COLOR[s.kind],
                )}
              >
                {KIND_LABEL[s.kind]}
              </span>
              <span
                className={clsx(
                  "flex-1 truncate text-[13px]",
                  s.kind === "error" ? "text-error" : "text-fg",
                )}
              >
                {s.label}
              </span>
              <span className="stat text-muted">+{s.atMs}ms</span>
            </div>
            {!dense && s.detail != null && (
              <pre className="mt-1.5 max-h-40 overflow-auto rounded-[6px] bg-tint px-2.5 py-2 font-mono text-[11px] leading-relaxed text-fg-secondary">
                {JSON.stringify(s.detail, null, 2)}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
