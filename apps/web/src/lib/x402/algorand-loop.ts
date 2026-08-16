// REAL paid-call path on Algorand: the agent calls the public paid endpoint over
// HTTP, gets a 402, signs a USDC transfer, and retries. Used when MODE=real and
// CHAIN=algorand. Server-only.
//
// Unlike the Casper path, which runs the handshake in-process, this goes over
// the wire to our own /api/t/[slug]. That is deliberate: the agent demo then
// exercises the same public endpoint an outside buyer would, with no privileged
// shortcut, and the settlement is recorded once, by the seller, rather than by
// both halves of a loop talking to itself.
import type { Receipt, ToolWithStats } from "../types";
import { makePayClient, payAndFetch, type PayStep } from "./algorand-client";
import { hasRoleAccount, loadRoleAccount } from "./algorand";
import type { PaidCallResult, StepKind, WireStep } from "./loop";

// The client emits a compact step vocabulary; the wire log speaks a slightly
// wider one. Verification happens inside the facilitator, so there is no
// separate "verify" step to show on this chain.
const STEP_KIND: Record<PayStep["kind"], StepKind> = {
  request: "request",
  "402": "402",
  sign: "sign",
  settle: "settle",
  result: "result",
  error: "error",
};

function toQuery(input: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined || v === null) continue;
    params.set(k, typeof v === "string" ? v : JSON.stringify(v));
  }
  const q = params.toString();
  return q ? `?${q}` : "";
}

// Authz, rate limiting, and the spend cap are enforced at the route boundary
// (api/agent/run, api/mcp); this is server-only and only reached through them.
export async function executeAlgorandPaidCall(opts: {
  tool: ToolWithStats;
  input: Record<string, unknown>;
  budgetRemainingUsd?: number | null;
  baseUrl: string;
}): Promise<PaidCallResult> {
  const { tool, input, baseUrl } = opts;
  const event = tool.priceEvents[0];
  const steps: WireStep[] = [];
  let seq = 0;
  const push = (kind: StepKind, label: string, ok = true, detail?: unknown, atMs = 0) =>
    steps.push({ seq: seq++, kind, label, ok, detail, atMs });

  const base = {
    ok: false as boolean,
    toolSlug: tool.slug,
    toolName: tool.name,
    eventName: event.name,
    costUsd: event.usd,
    steps,
  };

  if (typeof opts.budgetRemainingUsd === "number" && event.usd > opts.budgetRemainingUsd + 1e-9) {
    push("error", `budget exceeded: need ${event.usd}, have ${opts.budgetRemainingUsd}`, false);
    return { ...base, error: "budget_exceeded" };
  }

  if (!hasRoleAccount("agent")) {
    push("error", "real mode needs an agent key: run `pnpm algo:keygen`", false);
    return { ...base, error: "missing_keys" };
  }

  let client;
  try {
    client = makePayClient(loadRoleAccount("agent"));
  } catch (e) {
    push("error", `could not load the agent account: ${(e as Error).message}`, false);
    return { ...base, error: "missing_keys" };
  }

  const url = `${baseUrl}/api/t/${tool.slug}${toQuery(input)}`;
  const paid = await payAndFetch(url, client, {
    maxUsd: typeof opts.budgetRemainingUsd === "number" ? opts.budgetRemainingUsd : undefined,
    onStep: (s) => push(STEP_KIND[s.kind], s.label, s.ok, s.detail, s.atMs),
  });

  if (!paid.ok) {
    return { ...base, error: paid.error ?? "payment_failed" };
  }

  // The seller already recorded the settlement and minted the receipt; reuse it
  // rather than inventing a second one that could disagree.
  const body = paid.body as { result?: unknown; receipt?: Receipt } | null;
  const receipt = body?.receipt
    ? {
        ...body.receipt,
        budgetRemainingUsd:
          typeof opts.budgetRemainingUsd === "number"
            ? +(opts.budgetRemainingUsd - event.usd).toFixed(4)
            : null,
      }
    : undefined;
  if (receipt) push("receipt", `receipt issued: verifiable on Lora`, true, receipt);

  return { ...base, ok: true, result: body?.result, receipt };
}
