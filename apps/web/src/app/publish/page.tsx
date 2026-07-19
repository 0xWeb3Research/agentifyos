"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { Arrow, Button, Container, Eyebrow, StatusPill } from "@/components/ui";
import { CodeBlock } from "@/components/copy";
import { ToolCard } from "@/components/tool-card";
import { WalletConnect, type SessionInfo } from "@/components/wallet-connect";
import type { Capability, SchemaField, ToolWithStats } from "@/lib/types";

const CATEGORIES = ["Web Data", "AI", "DeFi", "RWA", "Identity", "Media"] as const;
const TYPES = ["string", "number", "url", "boolean", "object", "string[]"] as const;

const inputCls =
  "w-full rounded-[var(--radius-sm)] border border-border bg-surface px-3 py-2 text-[14px] text-fg " +
  "placeholder:text-muted transition-colors hover:border-border-hover focus:border-accent";
const selectCls = clsx(inputCls, "cursor-pointer appearance-none");

// A demo publisher — the "you" of the flow. No persistence: this page is a
// pure client sandbox where the listing takes shape as you type.
const DEMO_PUBLISHER = {
  id: "pub_you",
  handle: "@you",
  name: "You",
  payTo: "00…",
  monogram: "YO",
  color: "#EEF3FF",
};

type Row = { name: string; type: string };

export default function PublishPage() {
  const [name, setName] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [tagline, setTagline] = useState("");
  const [tagsRaw, setTagsRaw] = useState("");
  const [priceEvent, setPriceEvent] = useState("");
  const [priceUsd, setPriceUsd] = useState("0.005");
  const [freeTrial, setFreeTrial] = useState(false);
  const [inputs, setInputs] = useState<Row[]>([
    { name: "url", type: "url" },
    { name: "", type: "string" },
  ]);
  const [output, setOutput] = useState<Row>({ name: "result", type: "object" });
  const [published, setPublished] = useState(false);
  // Publishing is gated on proving you control a Casper account: the account
  // you sign in with becomes your payout address, so you can only list tools
  // that pay you.
  const [session, setSession] = useState<SessionInfo | null>(null);

  function setInputRow(i: number, key: keyof Row, val: string) {
    setInputs((prev) => prev.map((r, idx) => (idx === i ? { ...r, [key]: val } : r)));
  }

  // ── derive the live listing + manifest from form state ──────────────
  const tags = tagsRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const price = Number(priceUsd) || 0;
  const eventName = priceEvent.trim() || "call";
  const inputSchema: SchemaField[] = inputs
    .filter((r) => r.name.trim())
    .map((r) => ({ name: r.name.trim(), type: r.type }));
  const outputSchema: SchemaField[] = output.name.trim()
    ? [{ name: output.name.trim(), type: output.type }]
    : [];
  const capabilities: Capability[] = freeTrial ? ["x402", "mcp", "free-trial"] : ["x402", "mcp"];

  const preview: ToolWithStats = {
    id: "preview",
    slug: "preview",
    name: name.trim() || "Your tool",
    tagline: tagline.trim() || "Describe what your tool does. This becomes the machine-readable listing.",
    category,
    tags,
    capabilities,
    publisherId: DEMO_PUBLISHER.id,
    originUrl: endpoint.trim() || "https://",
    input: inputSchema,
    output: outputSchema,
    outputExample: {},
    priceEvents: [{ name: eventName, title: eventName, usd: price, freeTrial }],
    status: "unverified",
    createdAt: new Date().toISOString(),
    monogram: (name.trim().charAt(0) || "•").toUpperCase(),
    color: DEMO_PUBLISHER.color,
    publisher: DEMO_PUBLISHER,
    stats: {
      toolId: "preview",
      totalCalls: 0,
      distinctBuyers: 0,
      successRate: 0,
      revenueUsd: 0,
      avgLatencyMs: 0,
      last30dCalls: 0,
      rating: 0,
    },
    primaryPrice: price,
  };

  const manifest = {
    name: preview.name,
    description: preview.tagline,
    endpoint: preview.originUrl,
    price: {
      event: eventName,
      usd: price,
      network: "casper:casper-test",
      asset: "WCSPR",
      freeTrial,
    },
    input: inputSchema,
    output: outputSchema,
  };
  const manifestCode = JSON.stringify(manifest, null, 2);

  // ── success state ───────────────────────────────────────────────────
  if (published) {
    return (
      <main>
        <Container className="flex flex-col items-center pb-28 pt-20 text-center lg:pt-28">
          <div className="w-full max-w-[440px] animate-fade-up">
            <Eyebrow>publish a tool in 60 seconds</Eyebrow>
            <div className="mt-5 rounded-[var(--radius-card)] border border-border bg-surface p-8">
              <div className="flex items-center justify-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-success animate-pulse-dot" />
                <StatusPill status="unverified" />
              </div>
              <h1 className="mt-4 text-[24px] font-medium leading-tight tracking-[-0.03em]">
                Listing created · status: unverified
              </h1>
              <p className="mt-3 text-[14px] leading-relaxed text-fg-secondary">
                <span className="font-medium text-fg">{preview.name}</span> is live in the catalog.
                It flips to{" "}
                <span className="text-success">verified</span> the moment its first real x402
                settlement clears the facilitator. The payment is the review, so let an agent make
                the first one.
              </p>
              <div className="mt-6 flex justify-center">
                <Button href="/agent">
                  Send an agent to buy it <Arrow />
                </Button>
              </div>
            </div>
            <div className="mt-4 text-left">
              <ToolCard tool={preview} preview />
            </div>
          </div>
        </Container>
      </main>
    );
  }

  // ── the flow ────────────────────────────────────────────────────────
  return (
    <main>
      <Container className="pb-6 pt-16 lg:pt-20">
        <div className="animate-fade-up">
          <Eyebrow>publish a tool in 60 seconds</Eyebrow>
          <h1 className="mt-4 text-[32px] font-medium leading-[1.05] tracking-[-0.03em]">
            Publish a paid tool
          </h1>
          <p className="mt-3 max-w-[52ch] text-[14px] leading-relaxed text-fg-secondary">
            One manifest becomes a listing, a discovery record, and an MCP tool. Fill it in on the
            left, watch it take shape on the right, then let an agent settle the first call.
          </p>
        </div>
        <div
          className="animate-fade-up mt-6 flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-card)] border border-border bg-surface p-4 sm:p-5"
          style={{ animationDelay: "30ms" }}
        >
          <div className="min-w-0">
            <Eyebrow>{session ? "payouts go to" : "sign in to publish"}</Eyebrow>
            <p className="mt-1.5 max-w-[54ch] text-[13px] leading-relaxed text-fg-secondary">
              {session ? (
                <>
                  Every payment for this tool settles to{" "}
                  <span className="font-mono text-[12px] text-fg">
                    {session.address.slice(0, 14)}…{session.address.slice(-6)}
                  </span>
                  , the account you signed in with.
                </>
              ) : (
                <>
                  No email, no password. Sign a one-time message with your Casper Wallet to
                  prove the account is yours — it becomes your payout address. Signing moves
                  no funds and costs no gas.
                </>
              )}
            </p>
          </div>
          <WalletConnect onSession={setSession} />
        </div>
      </Container>

      <Container className="grid items-start gap-8 pb-24 lg:grid-cols-[1fr_400px]">
        {/* ── LEFT: the form ───────────────────────────────────────── */}
        <div className="animate-fade-up space-y-5" style={{ animationDelay: "40ms" }}>
          <Field label="tool name">
            <input
              className={inputCls}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Page Scraper"
            />
          </Field>

          <Field label="endpoint url">
            <input
              className={inputCls}
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="https://api.yourservice.com/scrape"
              inputMode="url"
            />
          </Field>

          <Field label="category">
            <select
              className={selectCls}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="tagline"
            hint={<span className="stat text-muted">{tagline.length}/500</span>}
          >
            <textarea
              className={clsx(inputCls, "min-h-[84px] resize-y leading-relaxed")}
              value={tagline}
              maxLength={500}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="Turn any URL into clean markdown with title, word count, and links. Built for RAG pipelines and agents that need readable page content in one call."
            />
          </Field>

          <Field label="tags" hint={<span className="label">comma-separated</span>}>
            <input
              className={inputCls}
              value={tagsRaw}
              onChange={(e) => setTagsRaw(e.target.value)}
              placeholder="scraping, markdown, rag, web"
            />
          </Field>

          {/* price */}
          <div className="rounded-[var(--radius-md)] border border-border p-4">
            <span className="label">price</span>
            <div className="mt-3 grid grid-cols-[1fr_130px] gap-3">
              <div>
                <span className="label">event</span>
                <input
                  className={clsx(inputCls, "mt-1.5")}
                  value={priceEvent}
                  onChange={(e) => setPriceEvent(e.target.value)}
                  placeholder="scrape"
                />
              </div>
              <div>
                <span className="label">usd / call</span>
                <input
                  className={clsx(inputCls, "mt-1.5 font-mono")}
                  type="number"
                  min="0"
                  step="0.001"
                  value={priceUsd}
                  onChange={(e) => setPriceUsd(e.target.value)}
                  placeholder="0.005"
                />
              </div>
            </div>
            <label className="press mt-3 flex w-fit cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 accent-fg"
                checked={freeTrial}
                onChange={(e) => setFreeTrial(e.target.checked)}
              />
              <span className="stat text-fg-secondary">first call free</span>
            </label>
          </div>

          {/* schema */}
          <div className="rounded-[var(--radius-md)] border border-border p-4">
            <span className="label">input schema</span>
            <div className="mt-3 space-y-2.5">
              {inputs.map((row, i) => (
                <div key={i} className="grid grid-cols-[1fr_130px] gap-3">
                  <input
                    className={inputCls}
                    value={row.name}
                    onChange={(e) => setInputRow(i, "name", e.target.value)}
                    placeholder="field name"
                  />
                  <select
                    className={selectCls}
                    value={row.type}
                    onChange={(e) => setInputRow(i, "type", e.target.value)}
                  >
                    {TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <span className="label mt-4 block">output</span>
            <div className="mt-3 grid grid-cols-[1fr_130px] gap-3">
              <input
                className={inputCls}
                value={output.name}
                onChange={(e) => setOutput((p) => ({ ...p, name: e.target.value }))}
                placeholder="field name"
              />
              <select
                className={selectCls}
                value={output.type}
                onChange={(e) => setOutput((p) => ({ ...p, type: e.target.value }))}
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <Button
            onClick={() => setPublished(true)}
            disabled={!session}
            className="w-full"
          >
            {session ? (
              <>
                Publish tool <Arrow />
              </>
            ) : (
              "Connect a wallet to publish"
            )}
          </Button>
          {!session && (
            <p className="stat text-center text-muted">
              publishing requires a signed-in Casper account
            </p>
          )}
        </div>

        {/* ── RIGHT: sticky live preview ───────────────────────────── */}
        <aside
          className="animate-fade-up lg:sticky lg:top-24 space-y-4"
          style={{ animationDelay: "80ms" }}
        >
          <span className="label">live preview</span>
          <ToolCard tool={preview} preview />
          <CodeBlock label="generated manifest" code={manifestCode} />
        </aside>
      </Container>
    </main>
  );
}

// label + optional right-aligned hint, above a control
function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="block">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="label">{label}</span>
        {hint}
      </div>
      {children}
    </div>
  );
}
