import type { Metadata } from "next";
import Link from "next/link";
import { Arrow, Button, Container, Eyebrow } from "@/components/ui";

export const metadata: Metadata = {
  title: "Not found",
  robots: { index: false, follow: false },
};

const LINKS = [
  { href: "/tools", label: "Browse the catalog", hint: "14 tools an agent can buy" },
  { href: "/agent", label: "Watch an agent pay", hint: "a real settlement, live" },
  { href: "/explain", label: "How it works", hint: "three diagrams, no jargon" },
];

export default function NotFound() {
  return (
    <main>
      <Container className="grid items-center gap-14 pb-24 pt-20 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="animate-fade-up">
          <Eyebrow>404 · not found</Eyebrow>
          <h1 className="mt-4 max-w-[16ch] text-[40px] font-medium leading-[1.05] tracking-[-0.04em] sm:text-[52px]">
            We only take 402s around here.
          </h1>
          <p className="mt-5 max-w-[46ch] text-[15px] leading-relaxed text-fg-secondary">
            This page doesn&apos;t exist. And unlike a{" "}
            <span className="font-mono text-[14px] text-fg">402</span>, it isn&apos;t
            something you can pay your way past. There&apos;s nothing here to buy.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button href="/">
              Back to the marketplace <Arrow />
            </Button>
            <Button href="/tools" variant="secondary">
              Browse tools
            </Button>
          </div>
        </div>

        {/* A wire-log that goes nowhere: the motif from the rest of the site,
            deliberately missing the price line that would make it payable. */}
        <div
          className="animate-fade-up overflow-hidden rounded-[var(--radius-md)] border border-border bg-surface"
          style={{ animationDelay: "80ms" }}
        >
          <div className="flex items-center justify-between border-b border-border px-3.5 py-2">
            <span className="label">x402 wire log</span>
            <span className="label text-muted">no route</span>
          </div>
          <div className="divide-y divide-border">
            <Row tag="REQ" tone="muted" label="GET the page you asked for" ms="+0ms" />
            <Row tag="404" tone="error" label="no such resource" ms="+2ms" />
            <div className="px-3.5 py-3">
              <div className="stat text-muted">
                no price advertised
                <br />nothing to sign
                <br />nothing settles
              </div>
            </div>
          </div>
        </div>
      </Container>

      <Container className="pb-24">
        <Eyebrow>try one of these instead</Eyebrow>
        <div className="mt-4 grid gap-px overflow-hidden rounded-[var(--radius-card)] border border-border bg-border sm:grid-cols-3">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="group bg-surface p-5 transition-colors duration-200 ease-[var(--ease-out)] hover:bg-tint"
            >
              <div className="flex items-center justify-between">
                <span className="text-[15px] font-medium tracking-[-0.01em]">{l.label}</span>
                <Arrow className="text-muted group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-fg" />
              </div>
              <p className="stat mt-1.5">{l.hint}</p>
            </Link>
          ))}
        </div>
      </Container>
    </main>
  );
}

function Row({
  tag,
  label,
  ms,
  tone,
}: {
  tag: string;
  label: string;
  ms: string;
  tone: "muted" | "error";
}) {
  return (
    <div className="flex items-center gap-2.5 px-3.5 py-2.5">
      <span
        className={`grid h-5 min-w-[34px] place-items-center rounded-[5px] font-mono text-[10px] font-medium text-surface ${
          tone === "error" ? "bg-error" : "bg-muted"
        }`}
      >
        {tag}
      </span>
      <span className="flex-1 truncate text-[13px]">{label}</span>
      <span className="stat text-muted">{ms}</span>
    </div>
  );
}
