import { getToolsWithStats } from "@/lib/data";
import { usd } from "@/lib/format";

// llms.txt — the front door for AI agents. Points crawlers at the discovery API
// and MCP endpoint, then lists every paid tool with its price and 402 resource.
export const dynamic = "force-dynamic";

export async function GET() {
  const tools = getToolsWithStats();

  const toolLines = tools
    .map(
      (t) =>
        `- ${t.name} · ${usd(t.priceEvents[0].usd)}/call · ${t.tagline}  →  GET /api/t/${t.slug} (HTTP 402, pay with x402 on casper:casper-test)`,
    )
    .join("\n");

  const text = `# AgentifyOS

AgentifyOS is the marketplace where autonomous AI agents discover and pay for tools. Every tool is a real HTTP endpoint that answers with 402 Payment Required: your agent reads the machine-readable price, signs a payment authorization with its own key, and settles WCSPR on Casper via the x402 "exact" scheme. No API keys, no accounts, no human in the loop. The settlement receipt is the usage record, and a tool's reputation is computed only from settled on-chain payments.

## Discovery

- Search the catalog: GET /api/discovery/search?query=  (filter with &category=, &maxUsd=, &tag=)
- Full resource feed: GET /api/discovery/resources
- MCP endpoint (search_tools, get_tool, call_tool): /api/mcp
- Pay a tool directly: GET /api/t/{slug} returns 402 with PaymentRequirements; retry with a PAYMENT-SIGNATURE header

## Tools

${toolLines}
`;

  return new Response(text, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
