import type { Publisher, Settlement, Tool, ToolStats } from "./types";
import { makeWallet } from "./x402/payment";

// Deterministic PRNG so the seeded catalog is reproducible across renders.
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(0x402);

export const SEED_NOW = Date.now();

// ── publishers ───────────────────────────────────────────────────────────────
export const publishers: Publisher[] = [
  { id: "pub_casperlabs", handle: "@casper-labs", name: "Casper Labs", payTo: makeWallet("casper-labs", "Casper Labs").accountHash, monogram: "CL", color: "#EEF3FF" },
  { id: "pub_scrapeworks", handle: "@scrapeworks", name: "ScrapeWorks", payTo: makeWallet("scrapeworks", "ScrapeWorks").accountHash, monogram: "SW", color: "#F1F0FF" },
  { id: "pub_lexfor", handle: "@lexforge", name: "LexForge", payTo: makeWallet("lexforge", "LexForge").accountHash, monogram: "LF", color: "#FFF3EC" },
  { id: "pub_meridian", handle: "@meridian-data", name: "Meridian Data", payTo: makeWallet("meridian", "Meridian Data").accountHash, monogram: "MD", color: "#ECFBF1" },
  { id: "pub_northwind", handle: "@northwind", name: "Northwind Labs", payTo: makeWallet("northwind", "Northwind").accountHash, monogram: "NW", color: "#F4F4F5" },
  { id: "pub_verata", handle: "@verata", name: "Verata", payTo: makeWallet("verata", "Verata").accountHash, monogram: "VE", color: "#FFF0F3" },
];

function pub(id: string): string {
  return publishers.find((p) => p.id === id)!.id;
}

// ── tools ─────────────────────────────────────────────────────────────────────
// The first four carry live handlers and drive the agent demo. The rest are
// callable fixtures (echo handler) that fill out a believable marketplace grid.
export const tools: Tool[] = [
  {
    id: "tool_page_scraper",
    slug: "page-scraper",
    name: "Page Scraper",
    tagline: "Turn any URL into clean markdown with title, word count, and extracted links. Built for RAG pipelines and agents that need readable page content in one call.",
    category: "Web Data",
    tags: ["scraping", "markdown", "rag", "web"],
    capabilities: ["x402", "mcp", "rest", "free-trial"],
    publisherId: pub("pub_scrapeworks"),
    originUrl: "internal://page-scraper",
    handler: "page-scraper",
    input: [{ name: "url", type: "url", description: "Page to fetch", required: true, example: "https://casper.network/blog" }],
    output: [
      { name: "markdown", type: "string", description: "Clean page content" },
      { name: "title", type: "string" },
      { name: "wordCount", type: "number" },
      { name: "links", type: "string[]" },
    ],
    outputExample: { title: "casper.network · extracted page", wordCount: 512, markdown: "# casper.network …" },
    priceEvents: [{ name: "scrape", title: "Scrape a page", usd: 0.005, freeTrial: true }],
    status: "verified",
    createdAt: new Date(SEED_NOW - 41 * 864e5).toISOString(),
    featured: true,
    monogram: "▤",
    color: "#F1F0FF",
  },
  {
    id: "tool_text_summarizer",
    slug: "text-summarizer",
    name: "Text Summarizer",
    tagline: "Compress long text into a two-sentence summary plus structured bullets. Deterministic, fast, and priced per call. Ideal as a cheap reasoning step inside an agent loop.",
    category: "AI",
    tags: ["ai", "summarize", "nlp", "text"],
    capabilities: ["x402", "mcp", "rest"],
    publisherId: pub("pub_northwind"),
    originUrl: "internal://text-summarizer",
    handler: "text-summarizer",
    input: [{ name: "text", type: "string", description: "Text to summarize", required: true }],
    output: [
      { name: "summary", type: "string" },
      { name: "bullets", type: "string[]" },
      { name: "approxTokens", type: "number" },
    ],
    outputExample: { summary: "…", bullets: ["…", "…"], approxTokens: 240 },
    priceEvents: [{ name: "summarize", title: "Summarize text", usd: 0.01 }],
    status: "verified",
    createdAt: new Date(SEED_NOW - 33 * 864e5).toISOString(),
    monogram: "¶",
    color: "#F4F4F5",
  },
  {
    id: "tool_cspr_market",
    slug: "cspr-market-data",
    name: "CSPR Market Data",
    tagline: "Live CSPR price, 24h change, volume, and liquidity in one metered call. The price feed your DeFi agent quotes against before it trades.",
    category: "DeFi",
    tags: ["defi", "price", "cspr", "market-data"],
    capabilities: ["x402", "mcp", "rest", "streaming"],
    publisherId: pub("pub_meridian"),
    originUrl: "internal://cspr-market-data",
    handler: "cspr-market-data",
    input: [],
    output: [
      { name: "priceUsd", type: "number" },
      { name: "change24hPct", type: "number" },
      { name: "volume24hUsd", type: "number" },
      { name: "liquidityUsd", type: "number" },
    ],
    outputExample: { symbol: "CSPR", priceUsd: 0.0231, change24hPct: 1.3 },
    priceEvents: [{ name: "quote", title: "Price quote", usd: 0.002 }],
    status: "verified",
    createdAt: new Date(SEED_NOW - 28 * 864e5).toISOString(),
    monogram: "◈",
    color: "#ECFBF1",
  },
  {
    id: "tool_rwa_attestor",
    slug: "rwa-attestor",
    name: "RWA Attestor",
    tagline: "Notarize a document hash and get a signed on-chain-ready attestation record. Turns real-world asset proofs into verifiable, agent-consumable receipts.",
    category: "RWA",
    tags: ["rwa", "attestation", "notary", "compliance"],
    capabilities: ["x402", "mcp", "rest"],
    publisherId: pub("pub_verata"),
    originUrl: "internal://rwa-attestor",
    handler: "rwa-attestor",
    input: [{ name: "documentHash", type: "string", description: "sha256 of the document", required: true }],
    output: [
      { name: "attestationId", type: "string" },
      { name: "signature", type: "string" },
      { name: "notary", type: "string" },
    ],
    outputExample: { attestationId: "att_…", standard: "AgentifyOS-Attestation-v1" },
    priceEvents: [{ name: "attest", title: "Attest a document", usd: 0.02 }],
    status: "verified",
    createdAt: new Date(SEED_NOW - 19 * 864e5).toISOString(),
    monogram: "❖",
    color: "#FFF0F3",
  },
  // ── fixtures ──────────────────────────────────────────────────────────────
  ...fixture("web-search", "Web Search", "AI search and fetch across the open web, returning ranked passages ready to drop into a RAG context window.", "Web Data", ["search", "rag", "web"], "pub_scrapeworks", 0.008, "search", "⌕", "#F1F0FF", "verified"),
  ...fixture("pdf-extract", "PDF Extract", "Extract structured text, tables, and metadata from any PDF URL. Handles scanned documents with OCR fallback.", "Web Data", ["pdf", "ocr", "extract"], "pub_northwind", 0.012, "extract", "▦", "#F4F4F5", "verified"),
  ...fixture("wallet-risk", "Wallet Risk Score", "Score any Casper account for exposure and sanctions risk before your agent transacts with it.", "DeFi", ["defi", "risk", "compliance", "cspr"], "pub_meridian", 0.006, "score", "◇", "#ECFBF1", "verified"),
  ...fixture("token-price", "Token Price Oracle", "Cross-chain token prices with confidence intervals, updated every block. Quote before you swap.", "DeFi", ["defi", "price", "oracle"], "pub_meridian", 0.003, "quote", "◉", "#ECFBF1", "verified"),
  ...fixture("geocode", "Geocoder", "Turn a street address into precise latitude/longitude with a normalized address and confidence score.", "Web Data", ["geo", "maps", "address"], "pub_casperlabs", 0.004, "geocode", "◍", "#EEF3FF", "unverified"),
  ...fixture("sentiment", "Sentiment Engine", "Classify text sentiment and emotion with per-span scores. A cheap signal for trading and moderation agents.", "AI", ["ai", "nlp", "sentiment"], "pub_northwind", 0.005, "classify", "◐", "#F4F4F5", "verified"),
  ...fixture("translate", "Neural Translate", "Translate between 90 languages while preserving markdown and code fences intact.", "AI", ["ai", "translate", "i18n"], "pub_lexfor", 0.007, "translate", "文", "#FFF3EC", "verified"),
  ...fixture("rwa-registry", "RWA Registry Lookup", "Resolve a real-world asset identifier to its registry record, ownership chain, and current attestations.", "RWA", ["rwa", "registry", "lookup"], "pub_verata", 0.015, "lookup", "▣", "#FFF0F3", "unverified"),
  ...fixture("nft-metadata", "Casper NFT Metadata", "Fetch normalized metadata, media, and ownership for any Casper CEP-78 NFT by contract and token id.", "Web Data", ["nft", "cep-78", "cspr"], "pub_casperlabs", 0.002, "fetch", "◆", "#EEF3FF", "verified"),
  ...fixture("email-verify", "Email Verifier", "Check deliverability, MX records, and disposable-domain status for any email address in one call.", "Identity", ["identity", "email", "verify"], "pub_verata", 0.003, "verify", "✉", "#FFF0F3", "verified"),
];

function fixture(
  slug: string,
  name: string,
  tagline: string,
  category: string,
  tags: string[],
  publisherId: string,
  usd: number,
  event: string,
  monogram: string,
  color: string,
  status: "verified" | "unverified",
): [Tool] {
  return [
    {
      id: "tool_" + slug.replace(/-/g, "_"),
      slug,
      name,
      tagline,
      category,
      tags,
      capabilities: status === "verified" ? ["x402", "mcp", "rest"] : ["x402", "rest"],
      publisherId,
      originUrl: `https://tools.example/${slug}`,
      input: [{ name: "input", type: "string", description: "Primary input", required: true }],
      output: [{ name: "result", type: "object" }],
      outputExample: { ok: true },
      priceEvents: [{ name: event, title: name, usd }],
      status,
      createdAt: new Date(SEED_NOW - Math.floor(rnd() * 40 + 2) * 864e5).toISOString(),
      monogram,
      color,
    },
  ];
}

// ── stats (ledger-derived reputation) ──────────────────────────────────────────
export const stats: ToolStats[] = tools.map((t) => {
  const popular = t.status === "verified";
  const base = popular ? 400 + Math.floor(rnd() * 4200) : 5 + Math.floor(rnd() * 60);
  const buyers = Math.max(1, Math.floor(base * (0.18 + rnd() * 0.2)));
  const successRate = popular ? 0.972 + rnd() * 0.027 : 0.9 + rnd() * 0.08;
  const primary = t.priceEvents[0]?.usd ?? 0.005;
  return {
    toolId: t.id,
    totalCalls: base,
    distinctBuyers: buyers,
    successRate,
    revenueUsd: +(base * primary * 0.94).toFixed(2),
    avgLatencyMs: 1150 + Math.floor(rnd() * 480),
    last30dCalls: Math.floor(base * (0.3 + rnd() * 0.4)),
    rating: +(4.1 + successRate * 0.85).toFixed(2) > 5 ? 4.98 : +(4.1 + successRate * 0.85).toFixed(2),
  };
});

// ── settlement backlog (drives the live feed) ──────────────────────────────────
const AGENT_LABELS = ["agent-01f3", "rag-bot-9c", "trader-Δ", "scout-7b", "orin-2a", "kya-pilot", "atlas-6", "nomad-e4"];
function pseudoHash(seed: string): string {
  // FNV-1a — order-sensitive so "…:12" and "…:21" don't collide.
  let s = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    s ^= seed.charCodeAt(i);
    s = Math.imul(s, 0x01000193) >>> 0;
  }
  const r = mulberry32(s);
  let h = "";
  for (let i = 0; i < 64; i++) h += Math.floor(r() * 16).toString(16);
  return h;
}

export const settlementBacklog: Settlement[] = Array.from({ length: 48 }, (_, i) => {
  const t = tools[Math.floor(rnd() * 4)]; // feed skews to the live tools
  const ev = t.priceEvents[0];
  const ageSec = Math.floor(rnd() * 5400) + i * 40;
  const payer = "00" + pseudoHash(t.slug + i).slice(0, 62);
  return {
    id: "stl_" + i.toString(36).padStart(2, "0") + pseudoHash(t.slug + ":" + i).slice(0, 14),
    toolId: t.id,
    toolSlug: t.slug,
    toolName: t.name,
    eventName: ev.name,
    payer,
    payerLabel: AGENT_LABELS[Math.floor(rnd() * AGENT_LABELS.length)],
    amountUsd: ev.usd,
    amountAtomic: "0",
    deployHash: pseudoHash(t.slug + ":deploy:" + i),
    network: "casper:casper-test",
    status: "settled" as const,
    latencyMs: 1150 + Math.floor(rnd() * 480),
    mode: "mock" as const,
    createdAt: new Date(SEED_NOW - ageSec * 1000).toISOString(),
  };
}).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
