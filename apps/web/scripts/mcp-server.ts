#!/usr/bin/env -S npx tsx
// AgentifyOS MCP server (stdio).
//
// Gives any MCP client (Claude Desktop, Claude Code, Cursor) the ability to
// discover tools in the marketplace and PAY for them with x402 on Casper
// testnet. It holds its own Casper key and performs the real 402 → sign → retry
// handshake, so a call from Claude produces a genuine on-chain settlement.
//
// IMPORTANT: stdout is the JSON-RPC channel. All logging must go to stderr.
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getCsprBalance, getWcsprBalance, loadWalletFromFile } from "../src/lib/x402/casper";
import { fetchWithPayment, searchTools } from "../src/lib/x402/client";

const here = dirname(fileURLToPath(import.meta.url));
const KEYS = join(here, "..", "keys");
// Ships pointing at the hosted marketplace; set AGENTIFYOS_URL to
// http://localhost:8402 to run against a local dev server.
const BASE = process.env.AGENTIFYOS_URL || "https://agentifyos.xyz";
const KEY = process.env.AGENTIFYOS_KEY || "agent";
const MAX_USD = Number(process.env.AGENTIFYOS_MAX_USD || "0.10");
// NaN would pass every budget comparison and silently disable the cap. Refuse
// to start on a malformed value instead.
if (!Number.isFinite(MAX_USD) || MAX_USD <= 0) {
  console.error(`[agentifyos] AGENTIFYOS_MAX_USD must be a positive number, got: ${process.env.AGENTIFYOS_MAX_USD}`);
  process.exit(1);
}

// TRUSTED local pricing constants for the spend cap. The 402 response's
// extra.decimals is server-supplied: a hostile marketplace could advertise 18
// decimals to make a 10^9-times-larger WCSPR amount look like cents. WCSPR has
// 9 decimals. Hardcode that for the safety check.
const TRUSTED_DECIMALS = 9;
const CSPR_PRICE_USD = 0.0231;
const trustedUsdOf = (atomicAmount: unknown) =>
  (Number(atomicAmount) / 10 ** TRUSTED_DECIMALS) * CSPR_PRICE_USD;

// stdout is the JSON-RPC channel: any stray console.log corrupts the protocol.
// Redirect the noisy console methods to stderr before anything else can write.
console.log = console.info = console.debug = console.error;
const log = (...a: unknown[]) => console.error("[agentifyos]", ...a);
const json = (data: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
});
const fail = (message: string) => ({
  content: [{ type: "text" as const, text: message }],
  isError: true,
});

const server = new McpServer(
  { name: "agentifyos", version: "0.1.0" },
  { capabilities: { tools: {}, logging: {} } },
);

// ── search_tools ────────────────────────────────────────────────────────────
server.registerTool(
  "search_tools",
  {
    title: "Search the AgentifyOS marketplace",
    description:
      "Find paid tools an agent can buy. Returns each tool's slug, description, " +
      "price per call in USD, and input schema. Call this before call_tool.",
    inputSchema: { query: z.string().optional().describe("free-text search, e.g. 'price feed' or 'scrape'") },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  async ({ query }) => {
    const tools = await searchTools(BASE, query ?? "");
    return json(
      tools.map((t) => ({
        slug: String(t.resource ?? "").replace("/api/t/", ""),
        name: t.name,
        description: t.description,
        usdPerCall: (t.price as { usd?: number } | undefined)?.usd,
        input: t.input,
        status: t.status,
      })),
    );
  },
);

// ── get_tool ────────────────────────────────────────────────────────────────
server.registerTool(
  "get_tool",
  {
    title: "Inspect a tool",
    description: "Full details for one tool: price, input/output schema, example response, stats.",
    inputSchema: { slug: z.string().describe("tool slug, e.g. 'cspr-market-data'") },
    annotations: { readOnlyHint: true },
  },
  async ({ slug }) => {
    const tools = await searchTools(BASE, "");
    const tool = tools.find((t) => String(t.resource ?? "").endsWith(`/${slug}`));
    return tool ? json(tool) : fail(`tool not found: ${slug}`);
  },
);

// ── call_tool: this one spends real money ───────────────────────────────────
server.registerTool(
  "call_tool",
  {
    title: "Pay for and call a tool",
    description:
      "Calls a paid tool. This performs a REAL payment: the marketplace answers HTTP 402 " +
      "with a price, this server signs a Casper authorization with its own key, and the " +
      "payment settles on Casper testnet. Returns the tool's result plus an on-chain " +
      `receipt with a verifiable deploy hash. Refuses anything over $${MAX_USD}. Takes ~15s.`,
    inputSchema: {
      slug: z.string().describe("tool slug from search_tools"),
      input: z
        .record(z.string(), z.string())
        .optional()
        .describe("tool inputs as string key/values, e.g. { url: 'https://...' }"),
      maxUsd: z.number().optional().describe(`spend cap for this call; only lowers the server cap of $${MAX_USD}, never raises it`),
    },
    // NOT readOnly: this moves real money, so hosts should confirm before running it.
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
  },
  async ({ slug, input, maxUsd }, extra) => {
    let wallet;
    try {
      wallet = loadWalletFromFile(join(KEYS, `${KEY}.pem`));
    } catch {
      return fail(`no Casper key at keys/${KEY}.pem: run 'pnpm casper:keygen' first.`);
    }
    // The model picks the slug: a client-supplied maxUsd may only LOWER the
    // operator's cap, never raise it past AGENTIFYOS_MAX_USD.
    const capUsd =
      typeof maxUsd === "number" && Number.isFinite(maxUsd) && maxUsd > 0
        ? Math.min(maxUsd, MAX_USD)
        : MAX_USD;
    const qs = new URLSearchParams(input ?? {}).toString();
    const url = `${BASE}/api/t/${encodeURIComponent(slug)}${qs ? `?${qs}` : ""}`;
    log(`paying for ${slug} …`);

    // Settlement takes ~15s; stream progress so the client doesn't look stuck.
    const token = extra._meta?.progressToken;
    let n = 0;
    let out;
    try {
      out = await fetchWithPayment(url, wallet, {
        maxUsd: capUsd,
        onStep: (s) => {
          // Re-check the advertised price with TRUSTED decimals before anything
          // is signed; fetchWithPayment's own budget check reads decimals off
          // the 402 response, which the marketplace controls. The "402" step
          // fires before the sign step, so throwing here aborts the payment.
          if (s.kind === "402") {
            const req = s.detail as { amount?: string } | undefined;
            const priceUsd = trustedUsdOf(req?.amount);
            if (!(priceUsd <= capUsd)) {
              throw new Error(
                `price ~$${priceUsd.toFixed(4)} (at ${TRUSTED_DECIMALS} decimals) exceeds cap $${capUsd}`,
              );
            }
          }
          log(`  ${s.kind}: ${s.label}`);
          if (token !== undefined) {
            void extra.sendNotification({
              method: "notifications/progress",
              params: { progressToken: token, progress: ++n, total: 4, message: s.label },
            });
          }
        },
      });
    } catch (e) {
      return fail(`payment aborted: ${e instanceof Error ? e.message : String(e)}`);
    }
    if (extra.signal.aborted) return fail("cancelled by client");

    if (!out.ok) return fail(`payment failed: ${out.error}`);
    return json({
      result: out.result,
      paid: out.receipt
        ? {
            costUsd: out.receipt.costUsd,
            deployHash: out.receipt.deployHash,
            explorer: out.receipt.explorerUrl,
            network: out.receipt.network,
          }
        : null,
    });
  },
);

// ── get_balance ─────────────────────────────────────────────────────────────
server.registerTool(
  "get_balance",
  {
    title: "Check the agent wallet balance",
    description:
      "On-chain CSPR and WCSPR balances for this server's Casper key. WCSPR is what " +
      "pays for tools; the agent needs no CSPR because the facilitator covers gas.",
    inputSchema: {},
    annotations: { readOnlyHint: true },
  },
  async () => {
    try {
      const w = loadWalletFromFile(join(KEYS, `${KEY}.pem`));
      const [cspr, wcspr] = await Promise.all([
        getCsprBalance(w.publicKeyHex),
        getWcsprBalance(w.accountHash),
      ]);
      return json({
        publicKey: w.publicKeyHex,
        accountHash: w.accountHash,
        cspr: (Number(cspr) / 1e9).toFixed(4),
        wcspr: (Number(wcspr) / 1e9).toFixed(4),
        network: "casper:casper-test",
      });
    } catch (e) {
      return fail(`could not read balance: ${e instanceof Error ? e.message : String(e)}`);
    }
  },
);

// ── list_settlements ────────────────────────────────────────────────────────
server.registerTool(
  "list_settlements",
  {
    title: "Recent settlements",
    description: "The marketplace's recent on-chain payments, each with a verifiable deploy hash.",
    inputSchema: { limit: z.number().optional().describe("how many (default 10)") },
    annotations: { readOnlyHint: true },
  },
  async ({ limit }) => {
    const n = typeof limit === "number" && Number.isFinite(limit) ? Math.min(Math.max(Math.floor(limit), 1), 100) : 10;
    const res = await fetch(`${BASE}/api/settlements?limit=${n}`);
    const body = (await res.json()) as { settlements?: unknown[] };
    return json(body.settlements ?? []);
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
log(`ready · marketplace ${BASE}, key '${KEY}', cap $${MAX_USD}/call`);
