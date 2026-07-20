import { NextResponse } from "next/server";
import { getToolBySlug, searchTools } from "@/lib/data";
import { executePaidCall } from "@/lib/x402/loop";
import { makeWallet } from "@/lib/x402/payment";
import { SITE_URL } from "@/lib/site";
import { authorizeSpend } from "@/lib/security/authz";
import { resolveSpendBudget } from "@/lib/security/spend";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/security/ratelimit";

// A pragmatic MCP-style endpoint so an agent host (Claude, Cursor, …) can list
// AgentifyOS tools, read a manifest, and actually pay-and-call one over the full
// x402 loop, all in-process, no keys.
export const dynamic = "force-dynamic";

const TOOL_DEFS = [
  {
    name: "search_tools",
    description:
      "Search the AgentifyOS marketplace for paid tools by free-text query. Returns compact records with slug, price, and reputation.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string", description: "what the tool should do" } },
    },
  },
  {
    name: "get_tool",
    description:
      "Fetch the full manifest for one tool by slug: input/output schema, price events, publisher, and on-chain stats.",
    inputSchema: {
      type: "object",
      properties: { slug: { type: "string", description: "tool slug" } },
      required: ["slug"],
    },
  },
  {
    name: "call_tool",
    description:
      "Pay for and call a tool. Runs the x402 handshake (402 → sign → verify → settle on Casper) and returns the result plus a receipt and the wire trace.",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string", description: "tool slug" },
        input: { type: "object", description: "arguments for the tool" },
        budgetUsd: { type: "number", description: "optional spend cap in USD" },
      },
      required: ["slug"],
    },
  },
];

export async function GET() {
  return NextResponse.json({
    name: "agentifyos",
    description:
      "The marketplace where AI agents discover and pay for tools via x402 on Casper. Search the catalog, read a manifest, and pay-per-call over MCP.",
    tools: TOOL_DEFS,
    config: {
      mcpServers: {
        agentifyos: { type: "http", url: `${SITE_URL}/api/mcp` },
      },
    },
  });
}

export async function POST(req: Request) {
  // Light limit across all methods; the spending branch gets its own below.
  const rl = rateLimit(`mcp:${clientIp(req)}`, 60, 60_000);
  if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

  let body: { method?: string; params?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const method = body.method;
  const params = body.params ?? {};

  if (method === "tools/list") {
    return NextResponse.json({ tools: TOOL_DEFS });
  }

  if (method === "search_tools") {
    const query = String(params.query ?? "");
    const results = searchTools(query, {})
      .slice(0, 10)
      .map((t) => ({
        slug: t.slug,
        name: t.name,
        description: t.tagline,
        usd: t.priceEvents[0].usd,
        capabilities: t.capabilities,
        status: t.status,
      }));
    return NextResponse.json({ results });
  }

  if (method === "get_tool") {
    const slug = String(params.slug ?? "");
    const tool = getToolBySlug(slug);
    return NextResponse.json(tool ?? { error: "not_found" });
  }

  if (method === "call_tool") {
    // The only branch that spends money: gate it, and rate-limit it harder.
    const auth = authorizeSpend(req);
    if (!auth.allowed) {
      return NextResponse.json({ error: "unauthorized", reason: auth.reason }, { status: 401 });
    }
    const callRl = rateLimit(`mcp-call:${clientIp(req)}`, 10, 60_000);
    if (!callRl.ok) return tooManyRequests(callRl.retryAfterSec);

    const slug = String(params.slug ?? "");
    const tool = getToolBySlug(slug);
    if (!tool) return NextResponse.json({ error: "not_found" });

    const wallet = makeWallet("mcp-agent", "mcp-client");
    const r = await executePaidCall({
      tool,
      wallet,
      input: (params.input as Record<string, unknown>) ?? {},
      // Clamped to the server cap; omitting budgetUsd no longer disables it.
      budgetRemainingUsd: resolveSpendBudget(params.budgetUsd),
      baseUrl: new URL(req.url).origin,
    });
    return NextResponse.json({
      ok: r.ok,
      result: r.result,
      receipt: r.receipt,
      wireSteps: r.steps,
      error: r.error,
    });
  }

  return NextResponse.json({ error: "unknown_method" });
}
