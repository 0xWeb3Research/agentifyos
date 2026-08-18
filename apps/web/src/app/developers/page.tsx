import type { Metadata } from "next";
import Link from "next/link";
import { CodeBlock } from "@/components/copy";
import { Arrow, Button, Chip, Container, Eyebrow } from "@/components/ui";
import { ALGO, ALGO_TREASURY_ADDRESS, explorerTx } from "@/lib/config";
import { getChain } from "@/lib/chain-server";
// config re-exports most of chain.ts, but not these two.
import { facilitatorReceipt, toAtomic } from "@/lib/chain";
import { getToolsWithStats } from "@/lib/data";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Developers",
  description:
    "Everything a machine needs: an HTTP 402 endpoint, a discovery API, an MCP server, llms.txt, and a CLI.",
  alternates: { canonical: "/developers" },
};

const MCP_TOOLS = [
  { name: "search_tools", spends: false, desc: "Find tools by free text. Returns slug, price, and input schema." },
  { name: "get_tool", spends: false, desc: "Full detail for one tool: price, schemas, stats." },
  { name: "call_tool", spends: true, desc: "Pay for a tool and return its result plus an on-chain receipt." },
  { name: "get_balance", spends: false, desc: "This account's on-chain balances." },
  { name: "list_settlements", spends: false, desc: "Recent marketplace payments, each with a verifiable transaction." },
];

const ENDPOINTS = [
  { method: "GET", path: "/api/t/[slug]", desc: "The paid endpoint. Returns 402 with a price, then the result once paid." },
  { method: "GET", path: "/api/discovery/resources", desc: "The whole catalog, machine-readable." },
  { method: "GET", path: "/api/discovery/search?query=", desc: "Search it." },
  { method: "GET", path: "/api/settlements", desc: "Recent on-chain settlements." },
  { method: "POST", path: "/api/mcp", desc: "MCP over HTTP: search_tools, get_tool, call_tool." },
  { method: "GET", path: "/llms.txt", desc: "Agent-readable manifest of the whole marketplace." },
];

export default async function DevelopersPage() {
  const chain = await getChain();
  const tools = getToolsWithStats();
  const live = tools.filter((t) => t.handler);
  // Elide rather than invent: the payTo in the sample is this instance's real
  // receiving account when one is configured, and an obvious placeholder when
  // it isn't. No sample hash is ever passed off as a settled transaction.
  const payToSample = ALGO_TREASURY_ADDRESS
    ? `${ALGO_TREASURY_ADDRESS.slice(0, 8)}…${ALGO_TREASURY_ADDRESS.slice(-6)}`
    : "<treasury address>";
  const facReceiptLine = facilitatorReceipt("…")
    ? `,\n    "facilitatorReceiptUrl": "${facilitatorReceipt("…")}"`
    : "";

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
          the price, the asset, and who to pay. Sign that transfer, retry with a{" "}
          <span className="font-mono text-[13px]">PAYMENT-SIGNATURE</span> header, and the
          response carries your data plus a receipt. Prices are exact dollars:{" "}
          {chain.symbol} has {chain.decimals} decimals, so $0.002 is{" "}
          <span className="font-mono text-[13px]">{toAtomic(0.002)}</span> atomic units
          and nothing is converted.
        </p>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <CodeBlock
            label="1 · ask, and get quoted"
            code={`curl -i ${SITE_URL}/api/t/algo-market-data

HTTP/1.1 402 Payment Required
PAYMENT-REQUIRED: true

{
  "x402Version": 2,
  "error": "payment_required",
  "accepts": [{
    "scheme": "exact",
    "network": "${chain.caip2}",
    "amount": "${toAtomic(0.002)}",
    "asset": "${chain.assetRef}",
    "payTo": "${payToSample}"
  }]
}`}
          />
          <CodeBlock
            label="2 · pay, and get the data"
            code={`curl ${SITE_URL}/api/t/algo-market-data \\
  -H "PAYMENT-SIGNATURE: $(base64_signed_payload)"

HTTP/1.1 200 OK
PAYMENT-RESPONSE: eyJzdWNjZXNzIjp0cnVlLC…

{
  "result": { "symbol": "CSPR", "priceUsd": 0.0244, … },
  "receipt": {
    "costUsd": 0.002,
    "txHash": "…",
    "explorerUrl": "${explorerTx("…")}"${facReceiptLine}
  }
}`}
          />
        </div>
        <p className="mt-4 max-w-[68ch] text-[13px] leading-relaxed text-fg-secondary">
          You sign one thing: a {chain.symbol} transfer inside a two-transaction
          atomic group. The facilitator adds and signs the second transaction, the
          one that pays the network fee, then submits the group. A buying agent
          therefore spends only {chain.symbol}. It still needs an account, and an
          Algorand account locks about 0.2 ALGO of minimum balance once it has
          opted into the {chain.symbol} ASA, but that balance is locked, never spent.
        </p>
      </Container>

      {/* ── 2. MCP ────────────────────────────────────────────────────── */}
      <Container className="py-10">
        <div className="flex items-baseline gap-3">
          <span className="stat text-muted">02</span>
          <h2 className="text-[22px] font-medium tracking-[-0.02em]">MCP server</h2>
        </div>
        <p className="mt-3 max-w-[68ch] text-[14px] leading-relaxed text-fg-secondary">
          Point Claude Desktop, Claude Code, or Cursor at the marketplace and it can buy
          tools on its own. The server holds its own {chain.name} account and does the
          real 402 handshake. A call from Claude produces a genuine on-chain settlement.
        </p>

        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <CodeBlock
            label="claude code"
            code={`claude mcp add-json agentifyos '{
  "type": "stdio",
  "command": "pnpm",
  "args": ["--dir", "/path/to/agentifyos/apps/web", "mcp"],
  "env": {
    "AGENTIFYOS_URL": "${SITE_URL}",
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
      "env": { "AGENTIFYOS_URL": "${SITE_URL}" }
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
          <span className="font-mono text-[12px]">call_tool</span> deliberately is not. It
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
          endpoint, nothing privileged. Client and server both sit on{" "}
          <span className="font-mono text-[13px]">@x402-avm/core</span>,{" "}
          <span className="font-mono text-[13px]">/avm</span>,{" "}
          <span className="font-mono text-[13px]">/fetch</span>,{" "}
          <span className="font-mono text-[13px]">/extensions</span>, and{" "}
          <span className="font-mono text-[13px]">algosdk</span>.
        </p>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <CodeBlock
            label="commands"
            code={`pnpm agentify tools                 # the catalog
pnpm agentify search "price feed"   # search it
pnpm agentify call algo-market-data # pay for a tool
pnpm agentify balance               # on-chain balances
pnpm agentify receipts              # recent settlements`}
          />
          <CodeBlock
            label="a real payment"
            code={`$ pnpm agentify call algo-market-data

REQ   GET /api/t/algo-market-data
402   payment required: $0.0020 in ${chain.symbol}
SIG   signed the ${chain.symbol} transfer
GRP   facilitator added the fee transaction
PAID  settled · atomic group submitted

receipt
  cost      $0.0020
  tx        …
  explorer  ${chain.explorerBase}/…`}
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
          <Eyebrow>the Bazaar</Eyebrow>
          <p className="mt-2.5 max-w-[64ch] text-[14px] leading-relaxed text-fg-secondary">
            Discovery is not only ours. GoPlausible runs a public registry of x402
            resources, and a listing appears in it by itself once one payment for it
            has settled. So an agent that has never heard of AgentifyOS can still find
            these tools at{" "}
            <a
              href={`${ALGO.facilitatorUrl}/discovery/resources`}
              target="_blank"
              rel="noreferrer"
              className="break-all font-mono text-[13px] text-accent hover:underline"
            >
              facilitator.goplausible.xyz/discovery/resources
            </a>
            .
          </p>
        </div>

        <div className="mt-5 rounded-[var(--radius-card)] border border-border bg-surface p-6">
          <Eyebrow>llms.txt</Eyebrow>
          <p className="mt-2.5 max-w-[64ch] text-[14px] leading-relaxed text-fg-secondary">
            A plain-text manifest of the whole marketplace, written for language models:
            every tool, its price, and how to call it. Point a crawler or an agent at{" "}
            <a href="/llms.txt" className="break-all font-mono text-[13px] text-accent hover:underline">
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
