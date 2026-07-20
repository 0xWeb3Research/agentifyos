# AgentifyOS · build contracts (read before writing any file)

You are building ONE slice of a Next.js 16 (App Router) + React 19 + Tailwind v4 +
TypeScript marketplace where AI agents discover and pay for tools via x402 on Casper.
Repo: `/Users/sidharthp/Documents/Projects/x402-research/agentifyos`, web app in `apps/web`.

## Hard rules
- The dev server is ALREADY RUNNING at http://localhost:8402. Do **not** run
  `pnpm dev`, `pnpm build`, or `pnpm install`, and do **not** edit `package.json`,
  `globals.css`, `layout.tsx`, or any file under `src/lib` or `src/components`
  that you were not explicitly told to create.
- Only CREATE the files in your task. Nothing else.
- `<Nav/>` and `<Footer/>` are already in the root layout. Your pages return a
  `<main>` with `<Container>` sections. Never add Nav/Footer.
- Anything importing `node:crypto`, `@/lib/x402/*`, `@/lib/data`, `@/lib/seed`, or
  `@/lib/tools/*` is **server-only**. A `"use client"` file must NOT import them:
  fetch from an API route or take data as props from a server component. Importing
  **types** with `import type` from any module is always fine (types are erased).
- Self-check when done: from `apps/web`, run
  `pnpm exec tsc --noEmit 2>&1 | grep <your-file-path>`. Ignore errors in files a
  sibling agent is still writing; fix all errors in YOUR files.

## Read these first (style + API exemplars, do not modify)
`src/app/globals.css` · `src/app/page.tsx` (THE style exemplar, match it) ·
`src/components/ui.tsx` · `src/components/tool-card.tsx` · `src/components/wire-log.tsx` ·
`src/components/copy.tsx` · `src/lib/types.ts` · `src/lib/data.ts` ·
`src/lib/format.ts` · `src/lib/config.ts` · `src/lib/x402/loop.ts`

## Design law (judges score UX/Design, treat as required)
- Refined-light only. Utilities: `bg-bg` (#FAFAFA page), `bg-surface` (white cards),
  `text-fg` (#0A0A0A), `text-fg-secondary` (#666), `text-muted` (#999),
  `border-border` (8% black; hover `border-border-hover`), `bg-tint` (3% black),
  `text-accent`/`bg-accent-tint` (#2469FF, links/info), `text-success`/`bg-success-tint`
  (#008B37, settlements/earnings/verified), `text-error`.
- Radius: `rounded-[var(--radius-card)]` 16 (cards), `rounded-[var(--radius-md)]` 10,
  `rounded-[var(--radius-sm)]` 8 (buttons/inputs), `rounded-[var(--radius-pill)]` pills.
- **Geist Mono (`font-mono`) is the identity carrier**: every price, count, hash,
  wallet address, latency, HTTP status, timestamp renders in mono. Reuse the existing
  `.stat` class (13px mono) and `.label` class (11px uppercase mono muted).
- Hairline borders only; NO shadow at rest, `shadow-[var(--shadow-hover)]` only on hover.
- Semantic color <5% of surface. Primary buttons solid black via `<Button>`.
- Motion = Emil Kowalski: press via the `.press` class (scale .97); transitions
  160–240ms with `ease-[var(--ease-out)]`; entrance via `animate-fade-up` with a
  small staggered `animationDelay`. Never `transition: all`, never `scale(0)`.
  `prefers-reduced-motion` is already handled globally.
- Reuse primitives; do NOT recreate: from `@/components/ui` →
  `Container, Button, Chip, CapabilityChip, StatusPill, LogoTile, Arrow, Eyebrow`;
  `ToolCard` from `@/components/tool-card`; `WireLog` from `@/components/wire-log`;
  `CodeBlock, CopyInline` from `@/components/copy`.

## Data & logic API (import from `@/...`)
Server-only:
- `@/lib/data`: `getToolsWithStats(): ToolWithStats[]`, `getToolBySlug(slug): ToolWithStats|null`,
  `searchTools(query, {category?, maxUsd?, tag?}): ToolWithStats[]`, `getCategories(): {name,count}[]`,
  `getSettlements(limit=24): Settlement[]`, `recordSettlement(s)`,
  `getPublisherDashboard(pubId): {publisher, tools:ToolWithStats[], totalRevenueUsd, totalCalls, settlements:Settlement[]}`,
  `getPublisher(id)`, `DEMO_PUBLISHER_ID`.
- `@/lib/x402/loop`: `executePaidCall({tool:ToolWithStats, wallet:AgentWallet, input:Record<string,unknown>, budgetRemainingUsd?:number|null, baseUrl:string}): Promise<PaidCallResult>`;
  `planTask(task:string, tools:ToolWithStats[]): PlanStep[]`. Types: `WireStep{seq,kind:StepKind,label,detail?,ok,atMs}`,
  `PaidCallResult{ok,toolSlug,toolName,eventName,costUsd,steps:WireStep[],result?,receipt?,settlement?,error?}`,
  `PlanStep{slug,input,reason}`.
- `@/lib/x402/payment`: `makeWallet(seed, label): AgentWallet{seedHex,publicKey,accountHash,label}`,
  `buildRequirements(tool,event,resource,payTo)`, `make402(tool,event,resource,payTo)`,
  `buildPayload(wallet,req)`, `verifySignature(auth,sigHex,pubKeyHex): boolean`, `hashResult(x): string`.
  Types: `PaymentRequirements, ExactPayload, Authorization`.
- `@/lib/x402/facilitator`: `getFacilitator(): FacilitatorClient{name,supported(),verify(payload,req),settle(payload,req)}`, `__resetNonces()`.
- `@/lib/tools/handlers`: `getHandler(key?): (input)=>Promise<unknown>`, `HANDLERS`.

Isomorphic (safe in client too):
- `@/lib/format`: `usd(n)`, `compact(n)`, `pct(n /*0..1*/)`, `shortHash(h,head?,tail?)`, `relTime(iso)`, `toAtomic(usd)`.
- `@/lib/config`: `explorerTx(deployHash)`, `explorerAccount(hash)`, `CSPR{network,explorerBase,wcsprPackageHash,asset}`, `MODE`, `PLATFORM_FEE` (0.2), `CSPR_PRICE_USD`.
- `@/lib/types`: `ToolWithStats, Tool, ToolStats, Settlement, Receipt, Publisher, PriceEvent, SchemaField, Capability, ToolStatus`.

## Types (shape reference)
`ToolWithStats = Tool & { publisher: Publisher; stats: ToolStats; primaryPrice: number }`
`Tool { id, slug, name, tagline, category, tags:string[], capabilities:Capability[], publisherId, originUrl, handler?, input:SchemaField[], output:SchemaField[], outputExample, priceEvents:PriceEvent[], status:ToolStatus, createdAt, featured?, monogram, color }`
`Publisher { id, handle, name, payTo, monogram, color }`
`PriceEvent { name, title, usd, freeTrial? }`
`SchemaField { name, type, description?, required?, example? }`
`ToolStats { toolId, totalCalls, distinctBuyers, successRate, revenueUsd, avgLatencyMs, last30dCalls, rating }`
`Settlement { id, toolId, toolSlug, toolName, eventName, payer, payerLabel, amountUsd, amountAtomic, deployHash, network, status, latencyMs, mode, createdAt }`
`Receipt { settlementId, tool, event, costUsd, payer, deployHash, resultHash, network, explorerUrl, budgetRemainingUsd, createdAt }`

## Next 16 notes
- Dynamic route params are a Promise: `export default async function Page({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; }`.
- Route handlers: `export async function GET(req: Request) {}` / `POST`. Use `NextResponse.json(...)` or `new Response(...)`.
- Use `notFound()` from `next/navigation` for missing records.
