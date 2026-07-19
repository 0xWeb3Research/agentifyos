import { explorerTx, MODE } from "../config";
import { recordSettlement } from "../data";
import { getHandler } from "../tools/handlers";
import type { Receipt, Settlement, ToolWithStats } from "../types";
import { getFacilitator } from "./facilitator";
import {
  buildPayload,
  buildRequirements,
  hashResult,
  make402,
  type AgentWallet,
} from "./payment";

export type StepKind =
  | "request"
  | "402"
  | "sign"
  | "verify"
  | "settle"
  | "result"
  | "receipt"
  | "error";

export interface WireStep {
  seq: number;
  kind: StepKind;
  label: string;
  detail?: unknown; // JSON rendered in the wire-log
  ok: boolean;
  atMs: number; // ms since call start
}

export interface PaidCallResult {
  ok: boolean;
  toolSlug: string;
  toolName: string;
  eventName: string;
  costUsd: number;
  steps: WireStep[];
  result?: unknown;
  receipt?: Receipt;
  settlement?: Settlement;
  error?: string;
}

// The full x402 handshake for one tool call, emitting a trace as it goes. Used
// in-process by the agent runner and wrapped by the HTTP paid route.
export async function executePaidCall(opts: {
  tool: ToolWithStats;
  wallet: AgentWallet;
  input: Record<string, unknown>;
  budgetRemainingUsd?: number | null;
  baseUrl: string;
}): Promise<PaidCallResult> {
  // MODE=real → sign with a real Casper key and settle on testnet.
  if (MODE === "real") {
    const { executeRealPaidCall } = await import("./real-loop");
    return executeRealPaidCall(opts);
  }

  const { tool, wallet, input, baseUrl } = opts;
  const event = tool.priceEvents[0];
  const resource = `${baseUrl}/api/t/${tool.slug}`;
  const start = Date.now();
  const steps: WireStep[] = [];
  let seq = 0;
  const step = (kind: StepKind, label: string, ok = true, detail?: unknown) =>
    steps.push({ seq: seq++, kind, label, ok, detail, atMs: Date.now() - start });

  const base = {
    ok: false as boolean,
    toolSlug: tool.slug,
    toolName: tool.name,
    eventName: event.name,
    costUsd: event.usd,
    steps,
  };

  // Budget gate (Apify's MAX_TOTAL_CHARGE_USD pattern).
  if (
    typeof opts.budgetRemainingUsd === "number" &&
    event.usd > opts.budgetRemainingUsd + 1e-9
  ) {
    step("error", `budget exceeded: need ${event.usd}, have ${opts.budgetRemainingUsd}`, false);
    return { ...base, error: "budget_exceeded" };
  }

  step("request", `GET ${tool.slug} · ${event.title}`, true, { method: "GET", resource, input });

  const req = buildRequirements(tool, event, resource, tool.publisher.payTo);
  step("402", "HTTP 402 Payment Required", true, make402(tool, event, resource, tool.publisher.payTo));

  const payload = buildPayload(wallet, req);
  step("sign", "signed EIP-712 authorization (Ed25519)", true, {
    "PAYMENT-SIGNATURE": {
      scheme: payload.scheme,
      network: payload.network,
      publicKey: payload.payload.publicKey,
      signature: payload.payload.signature,
      authorization: payload.payload.authorization,
    },
  });

  const fac = getFacilitator();
  const verify = await fac.verify(payload, req);
  step("verify", `facilitator /verify → ${verify.isValid ? "valid" : verify.invalidReason}`, verify.isValid, verify);
  if (!verify.isValid) {
    step("error", `payment rejected: ${verify.invalidReason}`, false);
    return { ...base, error: verify.invalidReason };
  }

  const settle = await fac.settle(payload, req);
  step("settle", `facilitator /settle → ${settle.success ? "settled" : settle.errorReason}`, settle.success, {
    ...settle,
    explorer: settle.deployHash ? explorerTx(settle.deployHash) : undefined,
  });
  if (!settle.success) {
    step("error", `settlement failed: ${settle.errorReason}`, false);
    return { ...base, error: settle.errorReason };
  }

  // Payment cleared → run the tool.
  const result = await getHandler(tool.handler)(input);
  const resultHash = hashResult(result);
  step("result", "200 OK — tool result delivered", true, result);

  const settlement: Settlement = {
    id: "stl_" + settle.deployHash.slice(0, 16),
    toolId: tool.id,
    toolSlug: tool.slug,
    toolName: tool.name,
    eventName: event.name,
    payer: wallet.accountHash,
    payerLabel: wallet.label,
    amountUsd: event.usd,
    amountAtomic: req.amount,
    deployHash: settle.deployHash,
    network: settle.network,
    status: "settled",
    latencyMs: settle.latencyMs,
    mode: fac.name.startsWith("real") ? "real" : "mock",
    createdAt: new Date().toISOString(),
  };
  recordSettlement(settlement);

  const receipt: Receipt = {
    settlementId: settlement.id,
    tool: tool.slug,
    event: event.name,
    costUsd: event.usd,
    payer: wallet.accountHash,
    deployHash: settle.deployHash,
    resultHash,
    network: settle.network,
    explorerUrl: explorerTx(settle.deployHash),
    budgetRemainingUsd:
      typeof opts.budgetRemainingUsd === "number"
        ? +(opts.budgetRemainingUsd - event.usd).toFixed(4)
        : null,
    createdAt: settlement.createdAt,
  };
  step("receipt", "receipt issued", true, receipt);

  return { ...base, ok: true, result, receipt, settlement };
}

// ── tiny deterministic task planner ────────────────────────────────────────────
// Maps a natural-language task to an ordered list of the live tools. Good enough
// to make the agent look like it reasons; the real value is the payment loop.
export interface PlanStep {
  slug: string;
  input: Record<string, unknown>;
  reason: string;
}

export function planTask(task: string, tools: ToolWithStats[]): PlanStep[] {
  const t = task.toLowerCase();
  const has = (slug: string) => tools.some((x) => x.slug === slug);
  const plan: PlanStep[] = [];
  const urlMatch = task.match(/https?:\/\/[^\s"']+/);
  const url = urlMatch?.[0] ?? "https://casper.network/blog/agentic-commerce";

  if ((/price|market|cspr|quote|trade/.test(t)) && has("cspr-market-data"))
    plan.push({ slug: "cspr-market-data", input: {}, reason: "task needs a live CSPR price to reason about" });
  if ((/scrape|fetch|read|article|blog|page|url/.test(t) || urlMatch) && has("page-scraper"))
    plan.push({ slug: "page-scraper", input: { url }, reason: `fetch readable content from ${new URL(url).host}` });
  if (/summar|tl;dr|digest|condense/.test(t) && has("text-summarizer"))
    plan.push({ slug: "text-summarizer", input: { text: "" }, reason: "summarize the fetched content" });
  if (/attest|notari|proof|verify|rwa|sign/.test(t) && has("rwa-attestor"))
    plan.push({ slug: "rwa-attestor", input: {}, reason: "notarize the result hash into an attestation" });

  // Default demo plan when nothing matched.
  if (plan.length === 0) {
    if (has("cspr-market-data")) plan.push({ slug: "cspr-market-data", input: {}, reason: "get a live CSPR price" });
    if (has("page-scraper")) plan.push({ slug: "page-scraper", input: { url }, reason: `scrape ${new URL(url).host}` });
    if (has("text-summarizer")) plan.push({ slug: "text-summarizer", input: { text: "" }, reason: "summarize it" });
    if (has("rwa-attestor")) plan.push({ slug: "rwa-attestor", input: {}, reason: "attest the summary" });
  }
  return plan;
}
