import { Catalog } from "@/components/catalog";
import { Container, Eyebrow } from "@/components/ui";
import { getCategories, getToolsWithStats } from "@/lib/data";
import { compact } from "@/lib/format";

export default function ToolsPage() {
  const tools = getToolsWithStats();
  const categories = getCategories();
  const totalCalls = tools.reduce((a, t) => a + t.stats.totalCalls, 0);

  return (
    <main>
      {/* ── page header ──────────────────────────────────────────────── */}
      <Container className="pb-6 pt-16 lg:pt-20">
        <div className="animate-fade-up">
          <Eyebrow>the catalog</Eyebrow>
          <h1 className="mt-4 text-[32px] font-medium leading-[1.05] tracking-[-0.03em]">
            Every tool your agent can buy
          </h1>
          <p className="stat mt-3 text-muted">
            {tools.length} tools · {compact(totalCalls)} paid calls settled
          </p>
        </div>
      </Container>

      {/* ── filter bar + grid (client) ───────────────────────────────── */}
      <Container className="pb-20">
        <Catalog tools={tools} categories={categories} />
      </Container>
    </main>
  );
}
