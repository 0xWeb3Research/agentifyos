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
import { ToolCard } from "@/components/tool-card";
import { CodeBlock, CopyInline } from "@/components/copy";
import { getToolBySlug, getToolsWithStats } from "@/lib/data";
import { compact, pct, shortHash, usd } from "@/lib/format";
import type { SchemaField } from "@/lib/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tool = getToolBySlug(slug);
  if (!tool) return {};
  return { title: tool.name, description: tool.tagline };
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

  const related = getToolsWithStats()
    .filter((t) => t.category === tool.category && t.slug !== slug)
    .slice(0, 3);

  const mcpConfig = JSON.stringify(
    { mcpServers: { agentifyos: { type: "http", url: "http://localhost:8402/api/mcp" } } },
    null,
    2,
  );
  const curlSnippet = `curl -s http://localhost:8402/api/t/${slug}   # → HTTP 402, then pay & retry`;

  return (
    <main>
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
          className="mt-10 grid gap-8 border-t border-border pt-10 lg:grid-cols-[1fr_360px]"
        >
          {/* left — main */}
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

          {/* right — sticky sidebar */}
          <aside className="flex flex-col gap-5 lg:sticky lg:top-20 lg:self-start">
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
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
                <span className="label">pay to</span>
                <CopyInline text={shortHash(publisher.payTo)} />
              </div>
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
