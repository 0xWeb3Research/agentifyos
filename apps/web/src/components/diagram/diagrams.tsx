"use client";

import type { Edge, Node } from "@xyflow/react";
import { Diagram } from "./flow";

const hairline = { stroke: "rgba(0,0,0,0.16)" };
const accent = { stroke: "#2469ff" };
const success = { stroke: "#008b37" };

// ── 1. The payment handshake ────────────────────────────────────────────────
// Deliberately a single vertical run: a serpentine layout makes React Flow route
// the right-to-left edges straight through the nodes.
const payNodes: Node[] = [
  { id: "agent", type: "step", position: { x: 0, y: 0 }, data: { tag: "the buyer", label: "AI agent", caption: "holds a keypair + WCSPR, no CSPR, no account", noIn: true } },
  { id: "tool", type: "step", position: { x: 0, y: 120 }, data: { tag: "step 1", label: "Calls a paid tool", caption: "GET /api/t/page-scraper" } },
  { id: "402", type: "step", position: { x: 0, y: 240 }, data: { tag: "step 2", label: "HTTP 402", caption: "the price, the token, and who to pay", tone: "warn" } },
  { id: "sign", type: "step", position: { x: 0, y: 360 }, data: { tag: "step 3", label: "Agent signs", caption: "EIP-712 authorization, off-chain and free", tone: "accent" } },
  { id: "fac", type: "step", position: { x: 0, y: 480 }, data: { tag: "step 4", label: "Facilitator", caption: "verifies the signature, then pays the gas", tone: "accent" } },
  { id: "chain", type: "step", position: { x: 0, y: 600 }, data: { tag: "step 5", label: "Casper testnet", caption: "transfer_with_authorization moves the WCSPR", tone: "chain" } },
  { id: "result", type: "step", position: { x: 0, y: 720 }, data: { tag: "step 6", label: "Result + receipt", caption: "data, plus a deploy hash you can open on cspr.live", tone: "success", noOut: true } },
  { id: "note", type: "note", position: { x: 300, y: 400 }, data: { text: "The agent never touches gas. That is the whole trick: it signs a message, and someone else pays the fee." } },
];

const payEdges: Edge[] = [
  { id: "e1", source: "agent", target: "tool", style: hairline },
  { id: "e2", source: "tool", target: "402", style: hairline },
  { id: "e3", source: "402", target: "sign", style: accent, animated: true },
  { id: "e4", source: "sign", target: "fac", style: accent, animated: true },
  { id: "e5", source: "fac", target: "chain", style: accent, animated: true },
  { id: "e6", source: "chain", target: "result", style: success, animated: true },
];

// ── 2. Where the money comes from ───────────────────────────────────────────
const moneyNodes: Node[] = [
  { id: "faucet", type: "step", position: { x: 0, y: 0 }, data: { tag: "free", label: "Testnet faucet", caption: "5,000 CSPR, once per account", noIn: true } },
  { id: "wallet", type: "step", position: { x: 0, y: 124 }, data: { tag: "you", label: "Casper Wallet", caption: "the only browser wallet involved" } },
  { id: "fac", type: "step", position: { x: -260, y: 258 }, data: { tag: "gas", label: "Facilitator", caption: "~4 CSPR per settlement", tone: "accent", noOut: true } },
  { id: "treasury", type: "step", position: { x: 260, y: 258 }, data: { tag: "supply", label: "Treasury", caption: "wraps CSPR → WCSPR 1:1" } },
  { id: "wcspr", type: "step", position: { x: 260, y: 382 }, data: { tag: "the currency", label: "WCSPR", caption: "the CEP-18 token tools are priced in", tone: "chain" } },
  { id: "agent", type: "step", position: { x: 260, y: 506 }, data: { tag: "the buyer", label: "Agent wallet", caption: "spends WCSPR, holds zero CSPR", tone: "accent" } },
  { id: "pub", type: "step", position: { x: 260, y: 630 }, data: { tag: "revenue", label: "Publisher", caption: "receives WCSPR per call", tone: "success", noOut: true } },
];

const moneyEdges: Edge[] = [
  { id: "m1", source: "faucet", target: "wallet", style: hairline },
  { id: "m2", source: "wallet", target: "fac", style: hairline },
  { id: "m3", source: "wallet", target: "treasury", style: hairline },
  { id: "m4", source: "treasury", target: "wcspr", style: hairline },
  { id: "m5", source: "wcspr", target: "agent", style: hairline },
  { id: "m6", source: "agent", target: "pub", style: success, animated: true },
];

// ── 3. What talks to what ───────────────────────────────────────────────────
const sysNodes: Node[] = [
  { id: "human", type: "step", position: { x: 0, y: 0 }, data: { tag: "humans", label: "Marketplace web", caption: "catalog · publish · dashboard", noIn: true } },
  { id: "cli", type: "step", position: { x: 250, y: 0 }, data: { tag: "terminal", label: "agentify CLI", caption: "its own key, real 402 client", noIn: true } },
  { id: "mcp", type: "step", position: { x: 500, y: 0 }, data: { tag: "ai clients", label: "MCP server", caption: "Claude Desktop · Cursor", noIn: true } },
  { id: "api", type: "step", position: { x: 250, y: 155 }, data: { tag: "the surface", label: "HTTP 402 endpoint", caption: "/api/t/[slug] + discovery + llms.txt", tone: "accent" } },
  { id: "engine", type: "step", position: { x: 250, y: 310 }, data: { tag: "the engine", label: "x402 core", caption: "sign · verify · settle · receipts" } },
  { id: "chain", type: "step", position: { x: 250, y: 465 }, data: { tag: "on-chain", label: "WCSPR contract", caption: "Casper testnet · CEP-18", tone: "chain", noOut: true } },
  { id: "note", type: "note", position: { x: 545, y: 320 }, data: { text: "The CLI and MCP server are ordinary x402 clients: they hold their own keys and pay over HTTP, exactly like any third-party agent would." } },
];

const sysEdges: Edge[] = [
  { id: "s1", source: "human", target: "api", style: hairline },
  { id: "s2", source: "cli", target: "api", style: hairline },
  { id: "s3", source: "mcp", target: "api", style: hairline },
  { id: "s4", source: "api", target: "engine", style: accent, animated: true },
  { id: "s5", source: "engine", target: "chain", style: accent, animated: true },
];

export const PaymentDiagram = () => <Diagram nodes={payNodes} edges={payEdges} height={940} />;
export const MoneyDiagram = () => <Diagram nodes={moneyNodes} edges={moneyEdges} height={860} />;
export const SystemDiagram = () => <Diagram nodes={sysNodes} edges={sysEdges} height={680} />;
