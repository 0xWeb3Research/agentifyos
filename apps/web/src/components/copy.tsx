"use client";

import { useState } from "react";
import { clsx } from "clsx";

// Copyable code block with a press-responsive copy button. Used for MCP config
// snippets, curl examples, and generated manifests.
export function CodeBlock({
  code,
  label,
  className,
}: {
  code: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard unavailable */
    }
  }
  return (
    <div
      className={clsx(
        "overflow-hidden rounded-[var(--radius-md)] border border-border bg-surface",
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-border px-3.5 py-2">
        <span className="label">{label ?? "snippet"}</span>
        <button
          type="button"
          onClick={copy}
          className="press label rounded-[6px] px-2 py-1 text-fg-secondary transition-colors hover:bg-tint hover:text-fg"
        >
          {copied ? "copied" : "copy"}
        </button>
      </div>
      <pre className="overflow-x-auto px-3.5 py-3 font-mono text-[12px] leading-relaxed text-fg-secondary">
        {code}
      </pre>
    </div>
  );
}

export function CopyInline({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch {
          /* noop */
        }
      }}
      className={clsx(
        "press inline-flex items-center gap-1.5 font-mono text-[12px] text-fg-secondary transition-colors hover:text-fg",
        className,
      )}
      title="Copy"
    >
      {text}
      <span className="label">{copied ? "✓" : "⧉"}</span>
    </button>
  );
}
