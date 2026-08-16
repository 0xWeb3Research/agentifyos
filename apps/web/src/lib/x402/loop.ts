import { DEFAULT_CHAIN, explorerTx, type ChainId } from "../chain";
import { MODE } from "../config";
import { getHandler } from "../tools/handlers";
import type { Receipt, Settlement, ToolWithStats } from "../types";
import { getFacilitator } from "./facilitator";
import { recordPaidCall } from "./settlement";
import { buildPayload, buildRequirements, make402, type AgentWallet } from "./payment";

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
  /** Which chain to settle on. Resolved per request by the caller. */
  on?: ChainId;
}): Promise<PaidCallResult> {
  const on = opts.on ?? DEFAULT_CHAIN;
  // MODE=real → sign with a real key and settle on the selected chain's testnet.
  if (MODE === "real") {
    if (on === "algorand") {
      const { executeAlgorandPaidCall } = await import("./algorand-loop");
      return executeAlgorandPaidCall(opts);
    }
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

  const req = buildRequirements(tool, event, resource, tool.publisher.payTo, on);
  step("402", "HTTP 402 Payment Required", true, make402(tool, event, resource, tool.publisher.payTo, on));

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
    explorer: settle.txHash ? explorerTx(settle.txHash, on) : undefined,
  });
  if (!settle.success) {
    step("error", `settlement failed: ${settle.errorReason}`, false);
    return { ...base, error: settle.errorReason };
  }

  // Payment cleared → run the tool.
  const result = await getHandler(tool.handler)(input);
  step("result", "200 OK: tool result delivered", true, result);

  // This path only runs in mock mode (real is delegated above), so the hash is a
  // deterministic pseudo-hash. recordPaidCall marks the receipt mock and emits
  // no explorer link rather than a URL that resolves to nothing.
  const { settlement, receipt } = await recordPaidCall({
    tool,
    event,
    payer: wallet.accountHash,
    amountAtomic: req.amount,
    txHash: settle.txHash,
    network: settle.network,
    mode: "mock",
    latencyMs: settle.latencyMs,
    result,
    on,
    budgetRemainingUsd:
      typeof opts.budgetRemainingUsd === "number"
        ? +(opts.budgetRemainingUsd - event.usd).toFixed(4)
        : null,
  });
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

const DEFAULT_URL = "https://algorand.co/blog";

// The regex below can match a malformed URL (e.g. bare "http://"); a raw
// `new URL(u).host` on task text would throw and 500 /api/agent/run.
function safeHost(u: string): string {
  try {
    return new URL(u).host || "the target page";
  } catch {
    return "the target page";
  }
}

export function planTask(task: string, tools: ToolWithStats[]): PlanStep[] {
  const t = task.toLowerCase();
  const has = (slug: string) => tools.some((x) => x.slug === slug);
  const plan: PlanStep[] = [];
  const urlMatch = task.match(/https?:\/\/[^\s"']+/);
  let url = DEFAULT_URL;
  if (urlMatch) {
    try {
      new URL(urlMatch[0]);
      url = urlMatch[0];
    } catch {
      /* matched string isn't a parseable URL: keep the default */
    }
  }

  if ((/price|market|algo|cspr|quote|trade/.test(t)) && has("algo-market-data"))
    plan.push({ slug: "algo-market-data", input: {}, reason: "task needs a live ALGO price to reason about" });
  if ((/scrape|fetch|read|article|blog|page|url/.test(t) || urlMatch) && has("page-scraper"))
    plan.push({ slug: "page-scraper", input: { url }, reason: `fetch readable content from ${safeHost(url)}` });
  if (/summar|tl;dr|digest|condense/.test(t) && has("text-summarizer"))
    plan.push({ slug: "text-summarizer", input: { text: "" }, reason: "summarize the fetched content" });
  if (/attest|notari|proof|verify|rwa|sign/.test(t) && has("rwa-attestor"))
    plan.push({ slug: "rwa-attestor", input: {}, reason: "notarize the result hash into an attestation" });

  // Default demo plan when nothing matched.
  if (plan.length === 0) {
    if (has("algo-market-data")) plan.push({ slug: "algo-market-data", input: {}, reason: "get a live ALGO price" });
    if (has("page-scraper")) plan.push({ slug: "page-scraper", input: { url }, reason: `scrape ${safeHost(url)}` });
    if (has("text-summarizer")) plan.push({ slug: "text-summarizer", input: { text: "" }, reason: "summarize it" });
    if (has("rwa-attestor")) plan.push({ slug: "rwa-attestor", input: {}, reason: "attest the summary" });
  }
  return plan;
}
