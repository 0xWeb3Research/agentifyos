import type { Metadata } from "next";
import Link from "next/link";
import { CodeBlock } from "@/components/copy";
import { Arrow, Button, Chip, Container, Eyebrow } from "@/components/ui";
import { getToolsWithStats } from "@/lib/data";

export const metadata: Metadata = {
  title: "Developers",
  description:
    "Everything a machine needs: an HTTP 402 endpoint, a discovery API, an MCP server, llms.txt, and a CLI.",
};

const MCP_TOOLS = [
  { name: "search_tools", spends: false, desc: "Find tools by free text. Returns slug, price, and input schema." },
  { name: "get_tool", spends: false, desc: "Full detail for one tool — price, schemas, stats." },
  { name: "call_tool", spends: true, desc: "Pay for a tool and return its result plus an on-chain receipt." },
  { name: "get_balance", spends: false, desc: "This wallet's on-chain CSPR and WCSPR." },
  { name: "list_settlements", spends: false, desc: "Recent marketplace payments, each with a deploy hash." },
];

const ENDPOINTS = [
  { method: "GET", path: "/api/t/[slug]", desc: "The paid endpoint. Returns 402 with a price, then the result once paid." },
  { method: "GET", path: "/api/discovery/resources", desc: "The whole catalog, machine-readable." },
  { method: "GET", path: "/api/discovery/search?query=", desc: "Search it." },
  { method: "GET", path: "/api/settlements", desc: "Recent on-chain settlements." },
  { method: "POST", path: "/api/mcp", desc: "MCP over HTTP — search_tools, get_tool, call_tool." },
  { method: "GET", path: "/llms.txt", desc: "Agent-readable manifest of the whole marketplace." },
];

export default function DevelopersPage() {
  const tools = getToolsWithStats();
  const live = tools.filter((t) => t.handler);

  return (
    <main>
      <Container className="pb-10 pt-16">
        <Eyebrow>developers</Eyebrow>
        <h1 className="mt-4 max-w-[20ch] text-[36px] font-medium leading-[1.05] tracking-[-0.03em] sm:text-[44px]">
          Everything a machine needs.
        </h1>
        <p className="mt-5 max-w-[62ch] text-[15px] leading-relaxed text-fg-secondary">
          No API keys, no sign-up, no dashboard to click through. An agent discovers a
          tool, gets quoted a price over <span className="font-mono text-[14px]">HTTP 402</span>,
          signs a payment with its own key, and gets the result. Three ways in:
          plain HTTP, MCP, or the CLI.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Button href="/explain">
            How it works <Arrow />
          </Button>
          <Button href="/tools" variant="secondary">
            Browse {live.length} live tools
          </Button>
        </div>
      </Container>

      {/* ── 1. HTTP ───────────────────────────────────────────────────── */}
      <Container className="py-10">
        <div className="flex items-baseline gap-3">
          <span className="stat text-muted">01</span>
          <h2 className="text-[22px] font-medium tracking-[-0.02em]">Straight HTTP</h2>
        </div>
        <p className="mt-3 max-w-[68ch] text-[14px] leading-relaxed text-fg-secondary">
          Call any tool and you get a <span className="font-mono text-[13px]">402</span> quoting
          the price, the token, and who to pay. Sign that authorization, retry with a{" "}
          <span className="font-mono text-[13px]">PAYMENT-SIGNATURE</span> header, and the
          response carries your data plus a receipt.
        </p>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <CodeBlock
            label="1 — ask, and get quoted"
            code={`curl -i http://localhost:8402/api/t/cspr-market-data

HTTP/1.1 402 Payment Required
PAYMENT-REQUIRED: true

{
  "x402Version": 2,
  "error": "payment_required",
  "accepts": [{
    "scheme": "exact",
    "network": "casper:casper-test",
    "amount": "86580087",
    "asset": "3d80df21…4847c1e",
    "payTo": "00bd135e…2a3fee"
  }]
}`}
          />
          <CodeBlock
            label="2 — pay, and get the data"
            code={`curl http://localhost:8402/api/t/cspr-market-data \\
  -H "PAYMENT-SIGNATURE: $(base64_signed_payload)"

HTTP/1.1 200 OK
PAYMENT-RESPONSE: eyJzdWNjZXNzIjp0cnVlLC…

{
  "result": { "symbol": "CSPR", "priceUsd": 0.0244, … },
  "receipt": {
    "costUsd": 0.002,
    "deployHash": "e50c18e4…f5fa55",
    "explorerUrl": "https://testnet.cspr.live/deploy/e50c18e4…"
  }
}`}
          />
        </div>
      </Container>

      {/* ── 2. MCP ────────────────────────────────────────────────────── */}
      <Container className="py-10">
        <div className="flex items-baseline gap-3">
          <span className="stat text-muted">02</span>
          <h2 className="text-[22px] font-medium tracking-[-0.02em]">MCP server</h2>
        </div>
        <p className="mt-3 max-w-[68ch] text-[14px] leading-relaxed text-fg-secondary">
          Point Claude Desktop, Claude Code, or Cursor at the marketplace and it can buy
          tools on its own. The server holds its own Casper key and does the real 402
          handshake — a call from Claude produces a genuine on-chain settlement.
        </p>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1fr]">
          <CodeBlock
            label="claude code"
            code={`claude mcp add-json agentifyos '{
  "type": "stdio",
  "command": "pnpm",
  "args": ["--dir", "/path/to/agentifyos/apps/web", "mcp"],
  "env": {
    "AGENTIFYOS_URL": "http://localhost:8402",
    "AGENTIFYOS_MAX_USD": "0.10"
  }
}' --scope user`}
          />
          <CodeBlock
            label="claude desktop · claude_desktop_config.json"
            code={`{
  "mcpServers": {
    "agentifyos": {
      "command": "/absolute/path/to/node",
      "args": [
        "/path/to/apps/web/node_modules/.bin/tsx",
        "/path/to/apps/web/scripts/mcp-server.ts"
      ],
      "env": { "AGENTIFYOS_URL": "http://localhost:8402" }
    }
  }
}`}
          />
        </div>

        <div className="mt-5 overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <span className="label">tools it exposes</span>
            <span className="label text-muted">5</span>
          </div>
          <div className="divide-y divide-border">
            {MCP_TOOLS.map((t) => (
              <div key={t.name} className="flex flex-col gap-1.5 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
                <span className="stat w-[9.5rem] shrink-0 text-fg">{t.name}</span>
                <span className="flex-1 text-[13px] leading-snug text-fg-secondary">{t.desc}</span>
                {t.spends ? (
                  <Chip tone="accent">spends</Chip>
                ) : (
                  <Chip>read-only</Chip>
                )}
              </div>
            ))}
          </div>
        </div>
        <p className="mt-3 max-w-[68ch] text-[13px] leading-relaxed text-fg-secondary">
          Read-only tools are annotated so hosts can auto-approve them.{" "}
          <span className="font-mono text-[12px]">call_tool</span> deliberately is not — it
          moves real money, so your client should ask first.
        </p>
      </Container>

      {/* ── 3. CLI ────────────────────────────────────────────────────── */}
      <Container className="py-10">
        <div className="flex items-baseline gap-3">
          <span className="stat text-muted">03</span>
          <h2 className="text-[22px] font-medium tracking-[-0.02em]">CLI</h2>
        </div>
        <p className="mt-3 max-w-[68ch] text-[14px] leading-relaxed text-fg-secondary">
          Same thing from a terminal. It holds its own key and pays over the same public
          endpoint — nothing privileged.
        </p>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <CodeBlock
            label="commands"
            code={`pnpm agentify tools                 # the catalog
pnpm agentify search "price feed"   # search it
pnpm agentify call cspr-market-data # pay for a tool
pnpm agentify balance               # on-chain balances
pnpm agentify receipts              # recent settlements`}
          />
          <CodeBlock
            label="a real payment"
            code={`$ pnpm agentify call cspr-market-data

REQ   GET /api/t/cspr-market-data          +0ms
402   payment required — ~$0.0020         +50ms
SIG   signed EIP-712 as 0041611f2c09…     +58ms
PAID  settled — e50c18e49e666b66…      +11823ms

receipt
  cost      $0.0020
  deploy    e50c18e49e666b666b1cbe20…
  explorer  https://testnet.cspr.live/…`}
          />
        </div>
      </Container>

      {/* ── endpoints + llms.txt ──────────────────────────────────────── */}
      <Container className="py-10">
        <div className="flex items-baseline gap-3">
          <span className="stat text-muted">04</span>
          <h2 className="text-[22px] font-medium tracking-[-0.02em]">Endpoints</h2>
        </div>
        <div className="mt-6 overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface">
          <div className="divide-y divide-border">
            {ENDPOINTS.map((e) => (
              <div key={e.path} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
                <span className="stat w-14 shrink-0 text-muted">{e.method}</span>
                <a
                  href={e.method === "GET" ? e.path : undefined}
                  className="stat w-[16rem] shrink-0 truncate text-fg hover:text-accent"
                >
                  {e.path}
                </a>
                <span className="flex-1 text-[13px] leading-snug text-fg-secondary">{e.desc}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 rounded-[var(--radius-card)] border border-border bg-surface p-6">
          <Eyebrow>llms.txt</Eyebrow>
          <p className="mt-2.5 max-w-[64ch] text-[14px] leading-relaxed text-fg-secondary">
            A plain-text manifest of the whole marketplace, written for language models —
            every tool, its price, and how to call it. Point a crawler or an agent at{" "}
            <a href="/llms.txt" className="font-mono text-[13px] text-accent hover:underline">
              /llms.txt
            </a>{" "}
            and it can find its way in without reading a single HTML page.
          </p>
        </div>
      </Container>

      {/* ── publish ───────────────────────────────────────────────────── */}
      <Container className="pb-20 pt-6">
        <div className="flex flex-col items-center gap-5 rounded-[var(--radius-card)] border border-border bg-fg px-8 py-12 text-center text-surface">
          <Eyebrow>
            <span className="text-surface/60">selling, not buying?</span>
          </Eyebrow>
          <h2 className="max-w-[24ch] text-[26px] font-medium leading-tight tracking-[-0.03em]">
            Publish a tool and get paid per call.
          </h2>
          <p className="max-w-[52ch] text-[14px] leading-relaxed text-surface/70">
            One manifest becomes a listing, a discovery record, and an MCP tool. You keep
            80% of every settlement, paid straight to your own wallet.
          </p>
          <Link
            href="/publish"
            className="press mt-1 inline-flex h-10 items-center gap-1.5 rounded-[var(--radius-sm)] bg-surface px-4 text-sm font-medium text-fg hover:bg-surface/90"
          >
            Publish a tool <Arrow />
          </Link>
        </div>
      </Container>
    </main>
  );
}
