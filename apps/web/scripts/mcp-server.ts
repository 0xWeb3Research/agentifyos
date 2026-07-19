#!/usr/bin/env -S npx tsx
// AgentifyOS MCP server (stdio).
//
// Gives any MCP client — Claude Desktop, Claude Code, Cursor — the ability to
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
const BASE = process.env.AGENTIFYOS_URL || "http://localhost:8402";
const KEY = process.env.AGENTIFYOS_KEY || "agent";
const MAX_USD = Number(process.env.AGENTIFYOS_MAX_USD || "0.10");

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

// ── call_tool — this one spends real money ──────────────────────────────────
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
      maxUsd: z.number().optional().describe(`spend cap for this call (default ${MAX_USD})`),
    },
    // NOT readOnly: this moves real money, so hosts should confirm before running it.
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
  },
  async ({ slug, input, maxUsd }, extra) => {
    let wallet;
    try {
      wallet = loadWalletFromFile(join(KEYS, `${KEY}.pem`));
    } catch {
      return fail(`no Casper key at keys/${KEY}.pem — run 'pnpm casper:keygen' first.`);
    }
    const qs = new URLSearchParams(input ?? {}).toString();
    const url = `${BASE}/api/t/${slug}${qs ? `?${qs}` : ""}`;
    log(`paying for ${slug} …`);

    // Settlement takes ~15s; stream progress so the client doesn't look stuck.
    const token = extra._meta?.progressToken;
    let n = 0;
    const out = await fetchWithPayment(url, wallet, {
      maxUsd: maxUsd ?? MAX_USD,
      onStep: (s) => {
        log(`  ${s.kind}: ${s.label}`);
        if (token !== undefined) {
          void extra.sendNotification({
            method: "notifications/progress",
            params: { progressToken: token, progress: ++n, total: 4, message: s.label },
          });
        }
      },
    });
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
    description: "The marketplace's recent on-chain payments — each with a verifiable deploy hash.",
    inputSchema: { limit: z.number().optional().describe("how many (default 10)") },
    annotations: { readOnlyHint: true },
  },
  async ({ limit }) => {
    const res = await fetch(`${BASE}/api/settlements?limit=${limit ?? 10}`);
    const body = (await res.json()) as { settlements?: unknown[] };
    return json(body.settlements ?? []);
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
log(`ready — marketplace ${BASE}, key '${KEY}', cap $${MAX_USD}/call`);
