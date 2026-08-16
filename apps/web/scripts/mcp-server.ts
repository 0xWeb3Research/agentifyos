#!/usr/bin/env -S npx tsx
// AgentifyOS MCP server (stdio).
//
// Gives any MCP client (Claude Desktop, Claude Code, Cursor) the ability to
// discover tools in the marketplace and PAY for them with x402. It holds its own
// key and performs the real 402 → sign → retry handshake, so a call from Claude
// produces a genuine on-chain settlement. Algorand by default; CHAIN=casper
// switches it to the Casper path.
//
// IMPORTANT: stdout is the JSON-RPC channel. All logging must go to stderr.
import "dotenv/config";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { DEFAULT_CHAIN as CHAIN, defaultChain as chain } from "../src/lib/chain";
import { searchTools } from "../src/lib/x402/client";

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

// TRUSTED local pricing for the spend cap. A 402 response's `extra.decimals` is
// server-supplied: a hostile marketplace could advertise 18 decimals to make an
// amount 10^9 times larger look like cents. So the conversion below uses
// constants this process owns, never anything read off the wire.
//
// On Algorand this is exact: USDC has 6 decimals and is a dollar. On Casper it
// still goes through an illustrative CSPR price.
const TRUSTED = CHAIN === "casper" ? { decimals: 9, usdPerUnit: 0.0231 } : { decimals: 6, usdPerUnit: 1 };
const trustedUsdOf = (atomicAmount: unknown) =>
  (Number(atomicAmount) / 10 ** TRUSTED.decimals) * TRUSTED.usdPerUnit;

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

interface PaidOutcome {
  ok: boolean;
  error?: string;
  result?: unknown;
  receipt?: {
    costUsd: number;
    txHash: string;
    explorerUrl: string | null;
    facilitatorReceiptUrl?: string | null;
    network: string;
  };
}

type StepFn = (s: { kind: string; label: string; detail?: unknown }) => void;

async function payForTool(url: string, capUsd: number, onStep: StepFn): Promise<PaidOutcome> {
  if (CHAIN === "casper") {
    const { loadWalletFromFile } = await import("../src/lib/x402/casper");
    const { fetchWithPayment } = await import("../src/lib/x402/client");
    const wallet = loadWalletFromFile(join(KEYS, `${KEY}.pem`));
    const out = await fetchWithPayment(url, wallet, { maxUsd: capUsd, onStep });
    return { ok: out.ok, error: out.error, result: out.result, receipt: out.receipt };
  }
  const { loadRoleAccount } = await import("../src/lib/x402/algorand");
  const { makePayClient, payAndFetch } = await import("../src/lib/x402/algorand-client");
  const account = loadRoleAccount(KEY === "treasury" ? "treasury" : "agent");
  const out = await payAndFetch(url, makePayClient(account), { maxUsd: capUsd, onStep });
  const body = out.body as { result?: unknown; receipt?: PaidOutcome["receipt"] } | null;
  return { ok: out.ok, error: out.error, result: body?.result, receipt: body?.receipt };
}

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
    inputSchema: { slug: z.string().describe("tool slug, e.g. 'algo-market-data'") },
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
      `with a price, this server signs a payment with its own key, and it settles on ` +
      `${chain.networkLabel}. Returns the tool's result plus a receipt with a verifiable ` +
      `${chain.txLabel}. Refuses anything over $${MAX_USD}. Takes ~10s.`,
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
    // The model picks the slug: a client-supplied maxUsd may only LOWER the
    // operator's cap, never raise it past AGENTIFYOS_MAX_USD.
    const capUsd =
      typeof maxUsd === "number" && Number.isFinite(maxUsd) && maxUsd > 0
        ? Math.min(maxUsd, MAX_USD)
        : MAX_USD;
    const qs = new URLSearchParams(input ?? {}).toString();
    const url = `${BASE}/api/t/${encodeURIComponent(slug)}${qs ? `?${qs}` : ""}`;
    log(`paying for ${slug} …`);

    // Settlement takes a few seconds; stream progress so the client doesn't look stuck.
    const token = extra._meta?.progressToken;
    let n = 0;
    let out: PaidOutcome;
    try {
      out = await payForTool(url, capUsd, (s) => {
        // Re-check the advertised price with TRUSTED decimals before anything
        // is signed; the payment client's own budget check reads decimals off
        // the 402 response, which the marketplace controls. The "402" step
        // fires before the sign step, so throwing here aborts the payment.
        if (s.kind === "402") {
          const req = s.detail as { amount?: string } | undefined;
          const priceUsd = trustedUsdOf(req?.amount);
          if (!(priceUsd <= capUsd)) {
            throw new Error(
              `price ~$${priceUsd.toFixed(4)} (at ${TRUSTED.decimals} decimals) exceeds cap $${capUsd}`,
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
            txHash: out.receipt.txHash,
            explorer: out.receipt.explorerUrl,
            facilitatorReceipt: out.receipt.facilitatorReceiptUrl ?? null,
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
      CHAIN === "casper"
        ? "On-chain CSPR and WCSPR balances for this server's Casper key. WCSPR is what " +
          "pays for tools; the agent needs no CSPR because the facilitator covers gas."
        : "On-chain ALGO and USDC balances for this server's Algorand account. USDC is " +
          "what pays for tools; no ALGO is spent, because the GoPlausible facilitator " +
          "sponsors the network fee.",
    inputSchema: {},
    annotations: { readOnlyHint: true },
  },
  async () => {
    try {
      if (CHAIN === "casper") {
        const { getCsprBalance, getWcsprBalance, loadWalletFromFile } = await import(
          "../src/lib/x402/casper"
        );
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
          network: chain.caip2,
        });
      }
      const { getBalances, loadRoleAccount, TESTNET } = await import("../src/lib/x402/algorand");
      const account = loadRoleAccount(KEY === "treasury" ? "treasury" : "agent");
      const b = await getBalances(account.addr);
      return json({
        address: account.addr,
        algo: (Number(b.algo) / 1e6).toFixed(4),
        usdc: b.optedIn ? (Number(b.usdc) / 10 ** TESTNET.decimals).toFixed(4) : null,
        optedIntoUsdc: b.optedIn,
        network: chain.caip2,
        explorer: `${chain.explorerBase}/account/${account.addr}`,
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
    description: `The marketplace's recent on-chain payments, each with a verifiable ${chain.txLabel}.`,
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
log(`ready · marketplace ${BASE}, chain ${chain.name}, key '${KEY}', cap $${MAX_USD}/call`);
