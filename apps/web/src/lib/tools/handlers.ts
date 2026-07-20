import { createHash, randomBytes } from "node:crypto";
import { CSPR_PRICE_USD } from "../config";
import { makeWallet, signBytes } from "../x402/payment";

// First-party tool handlers. Deterministic (no live network) so the demo runs
// reliably offline. A published third-party tool would instead proxy to its
// originUrl; these double as the reference implementation a publisher forks.

export type ToolHandler = (input: Record<string, unknown>) => Promise<unknown>;

function stableInt(seed: string, mod: number): number {
  return parseInt(createHash("sha256").update(seed).digest("hex").slice(0, 8), 16) % mod;
}

const pageScraper: ToolHandler = async (input) => {
  const url = String(input.url ?? "https://casper.network/blog/agentic-commerce");
  const host = (() => {
    try {
      return new URL(url).host;
    } catch {
      return "example.com";
    }
  })();
  const words = 380 + stableInt(url, 600);
  return {
    url,
    title: `${host} · extracted page`,
    markdown: `# ${host}\n\nAgentic commerce is the practice of letting autonomous software agents transact directly. On ${host}, the page describes how HTTP 402 turns any endpoint into a metered, pay-per-call service. Agents discover the resource, sign a payment authorization, and receive the content in a single round trip. No API keys, no accounts.\n\n- Machine-to-machine settlement in seconds\n- Wallet address doubles as identity\n- The payment record is the usage record`,
    wordCount: words,
    links: [`https://${host}/docs`, `https://${host}/pricing`],
    fetchedAt: new Date().toISOString(),
  };
};

const textSummarizer: ToolHandler = async (input) => {
  const text = String(input.text ?? "");
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const summary =
    sentences.slice(0, 2).join(" ") ||
    "A concise, structured summary of the supplied text.";
  const bullets = sentences.slice(0, 3).map((s) => s.replace(/^[-*]\s*/, "").slice(0, 90));
  return {
    summary,
    bullets: bullets.length ? bullets : ["Key point one", "Key point two", "Key point three"],
    sentenceCount: sentences.length,
    approxTokens: Math.ceil(text.length / 4),
  };
};

const csprMarketData: ToolHandler = async () => {
  const t = Date.now();
  const wobble = ((t / 3.6e6) % 1) * 0.004 - 0.002;
  const price = +(CSPR_PRICE_USD + wobble).toFixed(4);
  return {
    symbol: "CSPR",
    priceUsd: price,
    change24hPct: +(((wobble / CSPR_PRICE_USD) * 100) + 1.3).toFixed(2),
    volume24hUsd: 4_820_000 + stableInt(String(Math.floor(t / 6e4)), 900_000),
    liquidityUsd: 12_400_000,
    source: "aggregated-dex",
    updatedAt: new Date().toISOString(),
  };
};

// Notary key: seeded from NOTARY_SEED so anyone holding the secret can rotate
// or reproduce it. A hardcoded seed would let anyone recover the key from
// source and forge attestations; the random fallback keeps a NOTARY_SEED-less
// deploy unforgeable too, at the cost that attestations only verify against the
// notary key of the process that issued them (set NOTARY_SEED for stability).
const notary = makeWallet(
  process.env.NOTARY_SEED || randomBytes(32).toString("hex"),
  "AgentifyOS Notary",
);
const rwaAttestor: ToolHandler = async (input) => {
  const documentHash = String(input.documentHash ?? createHash("sha256").update("doc").digest("hex"));
  const attestedAt = new Date().toISOString();
  // Domain-separated preimage: deliberately NOT the payment Authorization
  // struct, so an attestation signature can never pass as a transfer.
  const preimage = createHash("sha256")
    .update(`AgentifyOS-Attestation-v1:${documentHash}:${attestedAt}`)
    .digest();
  return {
    attestationId: "att_" + createHash("sha256").update(documentHash + attestedAt).digest("hex").slice(0, 24),
    documentHash,
    notary: notary.publicKey,
    signature: signBytes(preimage, notary),
    standard: "AgentifyOS-Attestation-v1",
    attestedAt,
  };
};

export const HANDLERS: Record<string, ToolHandler> = {
  "page-scraper": pageScraper,
  "text-summarizer": textSummarizer,
  "cspr-market-data": csprMarketData,
  "rwa-attestor": rwaAttestor,
};

// Fallback for fixture listings with no first-party handler.
export const echoHandler: ToolHandler = async (input) => ({
  ok: true,
  received: input,
  note: "demo fixture endpoint",
  at: new Date().toISOString(),
});

export function getHandler(key?: string): ToolHandler {
  return (key && HANDLERS[key]) || echoHandler;
}
