import { getToolsWithStats } from "@/lib/data";
import { listDocs } from "@/lib/docs";
import { usd } from "@/lib/format";
import { abs } from "@/lib/site";

// llms.txt — the front door for AI agents. Points crawlers at the discovery API
// and MCP endpoint, then lists every paid tool with its price and 402 resource,
// plus the prose pages an agent needs to explain the protocol to a human.
export const dynamic = "force-dynamic";

// Mirrors the static routes in sitemap.ts. /dashboard and /publish stay out:
// they are account surfaces with nothing to read.
const PAGES: { path: string; title: string; purpose: string }[] = [
  {
    path: "/",
    title: "Home",
    purpose: "What the marketplace is, and the live settlement feed.",
  },
  {
    path: "/tools",
    title: "Tool catalog",
    purpose: "Every listed tool, browsable by category, price, and tag.",
  },
  {
    path: "/explain",
    title: "How it works",
    purpose: "The x402 payment flow in three diagrams, no code required.",
  },
  {
    path: "/docs",
    title: "Documentation",
    purpose: "Index of the written guides, ordered from zero knowledge up.",
  },
  {
    path: "/developers",
    title: "Developers",
    purpose: "MCP client config and the full endpoint reference.",
  },
  {
    path: "/agent",
    title: "Live demo",
    purpose: "Watch an agent run a real payment against Casper testnet.",
  },
  {
    path: "/roadmap",
    title: "Roadmap",
    purpose: "What is shipped, what is next, and what is out of scope.",
  },
];

export async function GET() {
  const tools = getToolsWithStats();
  const docs = await listDocs();

  const toolLines = tools
    .map(
      (t) =>
        `- ${t.name} · ${usd(t.priceEvents[0].usd)}/call · ${t.tagline}  →  GET ${abs(`/api/t/${t.slug}`)} (HTTP 402, pay with x402 on casper:casper-test)`,
    )
    .join("\n");

  const docLines = docs
    .map((d) => `- [${d.title}](${abs(`/docs/${d.slug}`)}): ${d.summary}`)
    .join("\n");

  const pageLines = PAGES.map(
    (p) => `- [${p.title}](${abs(p.path)}): ${p.purpose}`,
  ).join("\n");

  const text = `# AgentifyOS

AgentifyOS is the marketplace where autonomous AI agents discover and pay for tools. Every tool is a real HTTP endpoint that answers with 402 Payment Required: your agent reads the machine-readable price, signs a payment authorization with its own key, and settles WCSPR on Casper via the x402 "exact" scheme. No API keys, no accounts, no human in the loop. The settlement receipt is the usage record, and a tool's reputation is computed only from settled on-chain payments.

## Discovery

- Search the catalog: GET ${abs("/api/discovery/search")}?query=  (filter with &category=, &maxUsd=, &tag=)
- Full resource feed: GET ${abs("/api/discovery/resources")}
- MCP endpoint (search_tools, get_tool, call_tool): ${abs("/api/mcp")}
- Pay a tool directly: GET ${abs("/api/t/{slug}")} returns 402 with PaymentRequirements; retry with a PAYMENT-SIGNATURE header

## Tools

${toolLines}

## Documentation

${docLines}

## Pages

${pageLines}
`;

  return new Response(text, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
