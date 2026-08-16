import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  Arrow,
  Button,
  CapabilityChip,
  Chip,
  Container,
  Eyebrow,
  LogoTile,
  StatusPill,
} from "@/components/ui";
import { ToolCard, isLive } from "@/components/tool-card";
import { CodeBlock, CopyRow } from "@/components/copy";
import { JsonLd } from "@/components/json-ld";
import { resolvePayTo } from "@/lib/config";
import { getChain } from "@/lib/chain-server";
import { defaultChain } from "@/lib/chain";
import { getToolBySlug, getToolsWithStats } from "@/lib/data";
import { compact, pct, usd } from "@/lib/format";
import { SITE_URL, abs } from "@/lib/site";
import type { SchemaField, ToolWithStats } from "@/lib/types";

// A listing is a product an agent can buy, so describe it as one. Deliberately
// no aggregateRating: the seeded stats are generated per process, and emitting
// them as review data would be publishing ratings that nobody gave.
function toolGraph(tool: ToolWithStats) {
  return [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "@id": `${abs(`/tools/${tool.slug}`)}#tool`,
      name: tool.name,
      description: tool.tagline,
      url: abs(`/tools/${tool.slug}`),
      applicationCategory: tool.category,
      keywords: tool.tags.join(", "),
      provider: { "@type": "Organization", name: tool.publisher.name },
      isPartOf: { "@id": `${SITE_URL}/#website` },
      offers: {
        "@type": "Offer",
        price: tool.primaryPrice,
        priceCurrency: "USD",
        // Priced in USD and settled in USDC, so the two are the same number.
        description: `${usd(tool.primaryPrice)} per call, settled with x402 on ${defaultChain.name}`,
        availability: isLive(tool)
          ? "https://schema.org/InStock"
          : "https://schema.org/PreOrder",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Tools", item: abs("/tools") },
        { "@type": "ListItem", position: 2, name: tool.name, item: abs(`/tools/${tool.slug}`) },
      ],
    },
  ];
}

export function generateStaticParams() {
  return getToolsWithStats().map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tool = getToolBySlug(slug);
  if (!tool) return { title: "Tool not found", robots: { index: false, follow: false } };
  const title = `${tool.name} · ${usd(tool.primaryPrice)} per call`;
  return {
    title: tool.name,
    description: tool.tagline,
    keywords: [...tool.tags, tool.category, "x402", "pay per call"],
    alternates: { canonical: `/tools/${tool.slug}` },
    openGraph: {
      title,
      description: tool.tagline,
      url: abs(`/tools/${tool.slug}`),
      type: "website",
    },
    twitter: { card: "summary_large_image", title, description: tool.tagline },
  };
}

export default async function ToolDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tool = getToolBySlug(slug);
  if (!tool) notFound();

  const { stats, publisher } = tool;
  const chain = await getChain();
  const payTo = resolvePayTo(publisher.payTo, chain.id);

  const related = getToolsWithStats()
    .filter((t) => t.category === tool.category && t.slug !== slug)
    .slice(0, 3);

  const mcpConfig = JSON.stringify(
    { mcpServers: { agentifyos: { type: "http", url: `${SITE_URL}/api/mcp` } } },
    null,
    2,
  );
  const curlSnippet = `curl -s ${SITE_URL}/api/t/${slug}   # → HTTP 402, then pay & retry`;

  return (
    <main>
      <JsonLd data={toolGraph(tool)} />
      <Container className="py-10">
        {/* ── back link ─────────────────────────────────────────────── */}
        <Link
          href="/tools"
          className="press label inline-flex items-center gap-1.5 transition-colors hover:text-fg"
        >
          ← All tools
        </Link>

        {/* ── hero ──────────────────────────────────────────────────── */}
        <div className="mt-6 animate-fade-up">
          <div className="flex items-start gap-4">
            <LogoTile monogram={tool.monogram} color={tool.color} size={56} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h1 className="text-[28px] font-medium leading-none tracking-[-0.03em]">
                  {tool.name}
                </h1>
                <StatusPill status={tool.status} />
              </div>
              <p className="mt-1.5 text-[13px] text-muted">{publisher.handle}</p>
            </div>
          </div>

          {/* inline mono stat row */}
          <div className="stat mt-5 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>
              Price <span className="text-fg">{usd(tool.primaryPrice)}</span>
            </span>
            <Dot />
            <span>{compact(stats.totalCalls)} calls</span>
            <Dot />
            <span className="text-success">{pct(stats.successRate)} ok</span>
            <Dot />
            <span>★ {stats.rating}</span>
            <Dot />
            <span>~{stats.avgLatencyMs}ms</span>
          </div>

          <p className="mt-5 max-w-[60ch] text-[15px] leading-relaxed text-fg-secondary">
            {tool.tagline}
          </p>

          <div className="mt-5 flex flex-wrap gap-1.5">
            {tool.capabilities.map((c) => (
              <CapabilityChip key={c} cap={c} />
            ))}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button href={`/agent?tool=${slug}`}>
              Try it with an agent <Arrow />
            </Button>
            <Button variant="secondary" href="#integrate">
              View schema
            </Button>
          </div>
        </div>

        {/* ── two columns ───────────────────────────────────────────── */}
        <div
          className="mt-10 grid min-w-0 gap-8 border-t border-border pt-10 lg:grid-cols-[minmax(0,1fr)_360px]"
        >
          {/* left: main */}
          <div className="min-w-0 space-y-10">
            <section>
              <Eyebrow>input</Eyebrow>
              <div className="mt-3">
                <SchemaList fields={tool.input} emptyText="No input required." />
              </div>
            </section>

            <section>
              <Eyebrow>output</Eyebrow>
              <div className="mt-3">
                <SchemaList fields={tool.output} emptyText="No output." />
              </div>
            </section>

            <section>
              <Eyebrow>example response</Eyebrow>
              <div className="mt-3">
                <CodeBlock
                  label="200 OK"
                  code={JSON.stringify(tool.outputExample, null, 2)}
                />
              </div>
            </section>
          </div>

          {/* right: sticky sidebar */}
          <aside className="flex min-w-0 flex-col gap-5 lg:sticky lg:top-20 lg:self-start">
            {/* pricing card */}
            <div className="rounded-[var(--radius-card)] border border-border bg-surface p-5">
              <Eyebrow>pricing</Eyebrow>
              <div className="mt-3 divide-y divide-border">
                {tool.priceEvents.map((e) => (
                  <div
                    key={e.name}
                    className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-[13px]">{e.title}</span>
                      {e.freeTrial && <Chip tone="success">FREE TRIAL</Chip>}
                    </div>
                    <span className="stat shrink-0 text-fg">{usd(e.usd)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* publisher card */}
            <div className="rounded-[var(--radius-card)] border border-border bg-surface p-5">
              <Eyebrow>publisher</Eyebrow>
              <div className="mt-3 flex items-center gap-3">
                <LogoTile
                  monogram={publisher.monogram}
                  color={publisher.color}
                  size={40}
                />
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-medium">{publisher.name}</p>
                  <p className="truncate text-[13px] text-muted">{publisher.handle}</p>
                </div>
              </div>
              {/* CopyRow copies the FULL payTo value and truncates only visually.
                  Piping shortHash() into a copy affordance would put an unusable,
                  ellipsized value on the clipboard. Show the account this listing's
                  payments ACTUALLY land in: on Algorand a receiver has to be opted
                  into the USDC ASA, so today that is the one marketplace treasury. */}
              <div className="mt-3 border-t border-border pt-0.5">
                <CopyRow
                  label="pay to"
                  value={payTo || "not configured"}
                  mono={Boolean(payTo)}
                />
              </div>
              {chain.id !== "casper" && (
                <p className="mt-2 text-[12px] leading-relaxed text-fg-secondary">
                  Payments settle into the marketplace treasury for now. Per-publisher
                  payout accounts need a USDC opt-in per seller, which is on the{" "}
                  <Link href="/roadmap" className="text-accent hover:underline">
                    roadmap
                  </Link>
                  .
                </p>
              )}
            </div>

            {/* integrate block */}
            <div
              id="integrate"
              className="scroll-mt-20 rounded-[var(--radius-card)] border border-border bg-surface p-5"
            >
              <Eyebrow>integrate</Eyebrow>
              <div className="mt-3 space-y-3">
                <CodeBlock label="MCP config" code={mcpConfig} />
                <CodeBlock label="curl" code={curlSnippet} />
              </div>
            </div>
          </aside>
        </div>
      </Container>

      {/* ── related tools ─────────────────────────────────────────────── */}
      {related.length > 0 && (
        <Container className="border-t border-border py-12">
          <Eyebrow>more in {tool.category}</Eyebrow>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {related.map((t, i) => (
              <ToolCard key={t.id} tool={t} index={i} />
            ))}
          </div>
        </Container>
      )}
    </main>
  );
}

// ── helpers ────────────────────────────────────────────────────────────────
function Dot() {
  return <span className="text-border-hover">·</span>;
}

function SchemaList({
  fields,
  emptyText,
}: {
  fields: SchemaField[];
  emptyText: string;
}) {
  if (fields.length === 0)
    return <p className="text-[13px] text-fg-secondary">{emptyText}</p>;
  return (
    <div className="border-t border-border">
      {fields.map((f) => (
        <SchemaRow key={f.name} field={f} />
      ))}
    </div>
  );
}

function SchemaRow({ field }: { field: SchemaField }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border py-3 sm:flex-row sm:items-baseline sm:gap-4">
      <div className="flex items-center gap-2 sm:w-44 sm:shrink-0">
        <span className="font-mono text-[13px] text-fg">{field.name}</span>
        <Chip>{field.type}</Chip>
        {field.required && <span className="label">required</span>}
      </div>
      {field.description ? (
        <p className="text-[13px] leading-relaxed text-fg-secondary">
          {field.description}
        </p>
      ) : null}
    </div>
  );
}
