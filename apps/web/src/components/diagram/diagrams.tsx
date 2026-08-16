"use client";

import type { Edge, Node } from "@xyflow/react";
import { ALGO, CSPR, type ChainMeta } from "@/lib/chain";
import { useChain } from "../chain-context";
import { Diagram } from "./flow";

const hairline = { stroke: "rgba(0,0,0,0.16)" };
const accent = { stroke: "#2469ff" };
const success = { stroke: "#008b37" };

// The three diagrams are built per chain rather than written once and hedged.
// The handshake is genuinely the same on both, but where the money comes from
// and who pays the fee are not, and a diagram trying to describe both at once
// would describe neither.

// ── 1. The payment handshake ────────────────────────────────────────────────
// Deliberately a single vertical run: a serpentine layout makes React Flow route
// the right-to-left edges straight through the nodes.
function payNodes(chain: ChainMeta): Node[] {
  const casper = chain.id === "casper";
  return [
    { id: "agent", type: "step", position: { x: 0, y: 0 }, data: { tag: "the buyer", label: "AI agent", caption: `holds a keypair + ${chain.symbol}, no API key, no sign-up`, noIn: true } },
    { id: "tool", type: "step", position: { x: 0, y: 150 }, data: { tag: "step 1", label: "Calls a paid tool", caption: "GET /api/t/page-scraper" } },
    { id: "402", type: "step", position: { x: 0, y: 300 }, data: { tag: "step 2", label: "HTTP 402", caption: "the price, and who to pay", tone: "warn" } },
    {
      id: "sign",
      type: "step",
      position: { x: 0, y: 450 },
      data: {
        tag: "step 3",
        label: "Agent signs",
        caption: casper
          ? "an EIP-712 authorization, signed\noff-chain and free"
          : `a ${chain.symbol} transfer, signed off-chain and free`,
        tone: "accent",
      },
    },
    {
      id: "fac",
      type: "step",
      position: { x: 0, y: 600 },
      data: {
        tag: "step 4",
        label: "Facilitator",
        caption: casper
          ? "verifies it, then submits the transfer\nand pays the gas"
          : "verifies it, then adds and signs\nthe fee transaction",
        tone: "accent",
      },
    },
    {
      id: "chain",
      type: "step",
      position: { x: 0, y: 750 },
      data: {
        tag: "step 5",
        label: chain.networkLabel,
        caption: casper
          ? `moves the ${chain.symbol} on the CEP-18 contract`
          : `moves the ${chain.symbol} in one atomic group`,
        tone: "chain",
      },
    },
    { id: "result", type: "step", position: { x: 0, y: 900 }, data: { tag: "step 6", label: "Result + receipt", caption: `data + a verifiable\n${chain.txLabel}`, tone: "success", noOut: true } },
    {
      id: "note",
      type: "note",
      position: { x: 300, y: 470 },
      data: {
        text: casper
          ? "The agent never pays gas. That is the whole trick: it signs an authorization, and the facilitator pays to submit it."
          : "The agent never pays a fee. That is the whole trick: it signs a transfer, and the facilitator funds the transaction that carries it.",
      },
    },
  ];
}

const payEdges: Edge[] = [
  { id: "e1", source: "agent", target: "tool", style: hairline },
  { id: "e2", source: "tool", target: "402", style: hairline },
  { id: "e3", source: "402", target: "sign", style: accent, animated: true },
  { id: "e4", source: "sign", target: "fac", style: accent, animated: true },
  { id: "e5", source: "fac", target: "chain", style: accent, animated: true },
  { id: "e6", source: "chain", target: "result", style: success, animated: true },
];

// ── 2. Where the money comes from ───────────────────────────────────────────
function moneyNodes(chain: ChainMeta): Node[] {
  if (chain.id === "casper") {
    return [
      { id: "faucet", type: "step", position: { x: 0, y: 0 }, data: { tag: "free", label: "Testnet faucet", caption: "5,000 CSPR, once per account", noIn: true } },
      { id: "optin", type: "step", position: { x: 0, y: 140 }, data: { tag: "one-time", label: "Wrap", caption: `CSPR into WCSPR 1:1 on\npackage ${CSPR.wcsprPackageHash.slice(0, 8)}…` } },
      { id: "treasury", type: "step", position: { x: 0, y: 290 }, data: { tag: "supply", label: "Treasury", caption: "holds WCSPR and funds agents with it" } },
      { id: "agent", type: "step", position: { x: 0, y: 430 }, data: { tag: "the buyer", label: "Agent account", caption: "spends WCSPR, holds zero CSPR", tone: "accent" } },
      { id: "pub", type: "step", position: { x: 0, y: 570 }, data: { tag: "revenue", label: "Publisher", caption: "receives WCSPR per call", tone: "success", noOut: true } },
      { id: "fac", type: "step", position: { x: -300, y: 430 }, data: { tag: "gas", label: "Facilitator", caption: "our key submits every settlement\nand pays the gas", tone: "accent", noIn: true, horizontal: true } },
      { id: "note", type: "note", position: { x: 300, y: 440 }, data: { text: "Casper has no fee sponsorship primitive, so we run the facilitator ourselves and fund it. The agent still holds no CSPR at all." } },
    ];
  }
  return [
    { id: "faucet", type: "step", position: { x: 0, y: 0 }, data: { tag: "free", label: "Two testnet faucets", caption: "ALGO from Lora,\nUSDC from Circle", noIn: true } },
    { id: "optin", type: "step", position: { x: 0, y: 140 }, data: { tag: "one-time", label: "ASA opt-in", caption: `every receiving account opts into\nUSDC ${ALGO.assetId}` } },
    { id: "treasury", type: "step", position: { x: 0, y: 290 }, data: { tag: "supply", label: "Treasury", caption: "holds USDC and funds agents with it" } },
    { id: "agent", type: "step", position: { x: 0, y: 430 }, data: { tag: "the buyer", label: "Agent account", caption: "spends USDC, pays no network fees", tone: "accent" } },
    { id: "pub", type: "step", position: { x: 0, y: 570 }, data: { tag: "revenue", label: "Publisher", caption: "receives USDC per call", tone: "success", noOut: true } },
    { id: "fac", type: "step", position: { x: -300, y: 430 }, data: { tag: "fees", label: "Facilitator", caption: "GoPlausible signs and funds\nthe fee transaction", tone: "accent", noIn: true, horizontal: true } },
    { id: "note", type: "note", position: { x: 300, y: 440 }, data: { text: "An account still locks about 0.2 ALGO of minimum balance: 0.1 for the account, 0.1 for the USDC opt-in. Locked, not spent." } },
  ];
}

const moneyEdges: Edge[] = [
  { id: "m1", source: "faucet", target: "optin", style: hairline },
  { id: "m2", source: "optin", target: "treasury", style: hairline },
  { id: "m3", source: "treasury", target: "agent", style: hairline },
  { id: "m4", source: "fac", target: "agent", style: accent },
  { id: "m5", source: "agent", target: "pub", style: success, animated: true },
];

// ── 3. What talks to what ───────────────────────────────────────────────────
function sysNodes(chain: ChainMeta): Node[] {
  return [
    { id: "human", type: "step", position: { x: 0, y: 0 }, data: { tag: "humans", label: "Marketplace web", caption: "catalog · publish · dashboard", noIn: true } },
    { id: "cli", type: "step", position: { x: 250, y: 0 }, data: { tag: "terminal", label: "agentify CLI", caption: "its own key, real 402 client", noIn: true } },
    { id: "mcp", type: "step", position: { x: 500, y: 0 }, data: { tag: "ai clients", label: "MCP server", caption: "Claude Desktop · Cursor", noIn: true } },
    { id: "api", type: "step", position: { x: 250, y: 155 }, data: { tag: "the surface", label: "HTTP 402 endpoint", caption: "/api/t/[slug] + discovery + llms.txt", tone: "accent" } },
    { id: "engine", type: "step", position: { x: 250, y: 310 }, data: { tag: "the engine", label: "x402 core", caption: "sign · verify · settle · receipts" } },
    {
      id: "chain",
      type: "step",
      position: { x: 250, y: 465 },
      data: {
        tag: "on-chain",
        label: `${chain.symbol} settlement`,
        caption: `${chain.networkLabel} · ${chain.feePayer}`,
        tone: "chain",
        noOut: true,
      },
    },
    { id: "note", type: "note", position: { x: 545, y: 320 }, data: { text: "The CLI and MCP server are ordinary x402 clients: they hold their own keys and pay over HTTP, exactly like any third-party agent would." } },
  ];
}

const sysEdges: Edge[] = [
  { id: "s1", source: "human", target: "api", style: hairline },
  { id: "s2", source: "cli", target: "api", style: hairline },
  { id: "s3", source: "mcp", target: "api", style: hairline },
  { id: "s4", source: "api", target: "engine", style: accent, animated: true },
  { id: "s5", source: "engine", target: "chain", style: accent, animated: true },
];

export function PaymentDiagram() {
  return <Diagram nodes={payNodes(useChain())} edges={payEdges} height={1180} />;
}

export function MoneyDiagram() {
  return <Diagram nodes={moneyNodes(useChain())} edges={moneyEdges} height={820} />;
}

export function SystemDiagram() {
  return <Diagram nodes={sysNodes(useChain())} edges={sysEdges} height={680} />;
}
