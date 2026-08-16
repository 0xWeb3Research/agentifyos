import { ALGO } from "@/lib/config";
import { getChain } from "@/lib/chain-server";
import { getToolsWithStats } from "@/lib/data";
import { listDocs } from "@/lib/docs";
import { usd } from "@/lib/format";
import { abs } from "@/lib/site";

// llms.txt: the front door for AI agents. Points crawlers at the discovery API
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
    purpose: "Watch an agent run a real payment against the active chain's testnet.",
  },
  {
    path: "/roadmap",
    title: "Roadmap",
    purpose: "What is shipped, what is next, and what is out of scope.",
  },
  {
    path: "/whitepaper.pdf",
    title: "Whitepaper",
    purpose: "The full paper: market thesis, architecture, economics, and the long-term launch plan.",
  },
];

export async function GET() {
  const chain = await getChain();
  const CHAIN = chain.id;
  const tools = getToolsWithStats();
  const docs = await listDocs();

  const toolLines = tools
    .map(
      (t) =>
        `- ${t.name} · ${usd(t.priceEvents[0].usd)}/call · ${t.tagline}  →  GET ${abs(`/api/t/${t.slug}`)} (HTTP 402, pay with x402 on ${chain.caip2})`,
    )
    .join("\n");

  const docLines = docs
    .map((d) => `- [${d.title}](${abs(`/docs/${d.slug}`)}): ${d.summary}`)
    .join("\n");

  const pageLines = PAGES.map(
    (p) => `- [${p.title}](${abs(p.path)}): ${p.purpose}`,
  ).join("\n");

  const settlement =
    CHAIN === "algorand"
      ? `## Settlement

- Chain: ${chain.networkLabel}, CAIP-2 \`${chain.caip2}\`
- Asset: ${chain.symbol} (${chain.assetName}), ASA ${chain.assetRef}, ${chain.decimals} decimals. Prices are exact dollars: $0.005 is 5000 atomic units, nothing is converted.
- Facilitator: GoPlausible, ${ALGO.facilitatorUrl}. It verifies, settles, and sponsors the network fee.
- Mechanics: the buyer signs a ${chain.symbol} transfer inside a two-transaction atomic group; the facilitator adds and signs the fee-payer transaction and submits the group. A buying agent therefore pays no network fees and spends only ${chain.symbol}. It still needs an Algorand account, which locks about 0.2 ALGO of minimum balance (0.1 base, 0.1 for the ${chain.symbol} opt-in). That balance is locked, never spent.
- Opt-in: every account that receives ${chain.symbol} must opt into ASA ${chain.assetRef} first.
- Explorer: ${chain.explorerName}, ${chain.explorerBase}. Transactions at /transaction/{txid}, accounts at /account/{address}, the asset at /asset/${chain.assetRef}.
- Public registry: GoPlausible's Bazaar lists a resource automatically once a payment for it has settled: ${ALGO.facilitatorUrl}/discovery/resources
`
      : `## Settlement

- Chain: ${chain.networkLabel}, CAIP-2 \`${chain.caip2}\`
- Asset: ${chain.symbol} (${chain.assetName}), ${chain.decimals} decimals. The facilitator pays the gas.
- Explorer: ${chain.explorerName}, ${chain.explorerBase}
`;

  const text = `# AgentifyOS

AgentifyOS is the marketplace where autonomous AI agents discover and pay for tools. Every tool is a real HTTP endpoint that answers with 402 Payment Required: your agent reads the machine-readable price, signs a payment with its own key, and settles ${chain.symbol} on ${chain.name} via the x402 "exact" scheme. No API keys, no accounts, no human in the loop. The settlement receipt is the usage record, and a tool's reputation is computed only from settled on-chain payments.

${settlement}
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
