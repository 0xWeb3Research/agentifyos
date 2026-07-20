// Domain types for AgentifyOS. A single Tool manifest drives the human listing
// page, the machine-readable discovery record, and the MCP tool definition.

export type Capability = "x402" | "mcp" | "rest" | "streaming" | "free-trial";
export type ToolStatus = "draft" | "unverified" | "verified";
export type SettlementStatus = "verified" | "settled" | "pending" | "failed";
export type Mode = "mock" | "real";

export interface Publisher {
  id: string;
  handle: string; // "@casper-labs"
  name: string;
  payTo: string; // 00 + account-hash hex
  monogram: string; // 1–2 chars for the fallback tile
  color: string; // tile tint
}

export interface PriceEvent {
  name: string; // "scrape"
  title: string; // "Scrape a page"
  usd: number; // 0.005
  freeTrial?: boolean; // first call free
}

export interface SchemaField {
  name: string;
  type: string; // "string" | "number" | "url" | "object" | ...
  description?: string;
  required?: boolean;
  example?: unknown;
}

export interface Tool {
  id: string;
  slug: string;
  name: string;
  tagline: string; // ≤ 500 chars; the machine-readable description
  category: string;
  tags: string[];
  capabilities: Capability[];
  publisherId: string;
  originUrl: string; // seller endpoint; internal handler for first-party tools
  handler?: string; // key into the tool handler registry
  input: SchemaField[];
  output: SchemaField[];
  outputExample: unknown;
  priceEvents: PriceEvent[];
  status: ToolStatus;
  createdAt: string; // ISO
  featured?: boolean; // interleaved accent slot in the grid
  monogram: string; // tile fallback
  color: string; // tile tint
}

export interface ToolStats {
  toolId: string;
  totalCalls: number;
  distinctBuyers: number;
  successRate: number; // 0..1
  revenueUsd: number;
  avgLatencyMs: number;
  last30dCalls: number;
  rating: number; // derived 0..5, ledger-only
}

export interface Settlement {
  id: string;
  toolId: string;
  toolSlug: string;
  toolName: string;
  eventName: string;
  payer: string; // agent account hash
  payerLabel: string; // short label
  amountUsd: number;
  amountAtomic: string;
  deployHash: string;
  network: string;
  status: SettlementStatus;
  latencyMs: number;
  mode: Mode;
  createdAt: string;
}

export interface Receipt {
  settlementId: string;
  tool: string;
  event: string;
  costUsd: number;
  payer: string;
  deployHash: string;
  resultHash: string;
  network: string;
  // "real" when the deploy hash is a genuine on-chain transaction (explorerUrl
  // resolves on testnet.cspr.live); "mock" when it settled in-process. Mock
  // receipts carry a null explorerUrl so a fabricated hash is never presented
  // as a verifiable on-chain link.
  mode: Mode;
  explorerUrl: string | null;
  budgetRemainingUsd: number | null;
  createdAt: string;
}

// A tool joined with its computed reputation: the shape most UI consumes.
export interface ToolWithStats extends Tool {
  publisher: Publisher;
  stats: ToolStats;
  primaryPrice: number; // headline price for the badge
}
