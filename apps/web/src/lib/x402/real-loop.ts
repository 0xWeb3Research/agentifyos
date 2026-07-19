// REAL paid-call path: the agent signs an EIP-712 authorization with its own
// Casper key and the facilitator settles it on Casper testnet by calling
// `transfer_with_authorization`. Used when MODE=real. Server-only.
import path from "node:path";
import { explorerTx } from "../config";
import { toAtomic } from "../format";
import { recordSettlement } from "../data";
import { getHandler } from "../tools/handlers";
import type { Receipt, Settlement, ToolWithStats } from "../types";
import { hashResult } from "./payment";
import type { PaidCallResult, StepKind, WireStep } from "./loop";

const WCSPR =
  process.env.WCSPR_PACKAGE_HASH ||
  "3d80df21ba4ee4d66a2a1f60c32570dd5685e4b279f6538162a5fd1314847c1e";

function keyPath(envVal: string | undefined, fallback: string): string {
  return envVal
    ? path.resolve(process.cwd(), envVal)
    : path.join(process.cwd(), "keys", fallback);
}

export async function executeRealPaidCall(opts: {
  tool: ToolWithStats;
  input: Record<string, unknown>;
  budgetRemainingUsd?: number | null;
  baseUrl: string;
}): Promise<PaidCallResult> {
  const { tool, input, baseUrl } = opts;
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

  if (typeof opts.budgetRemainingUsd === "number" && event.usd > opts.budgetRemainingUsd + 1e-9) {
    step("error", `budget exceeded: need ${event.usd}, have ${opts.budgetRemainingUsd}`, false);
    return { ...base, error: "budget_exceeded" };
  }

  const casper = await import("./casper");

  let agentW: Awaited<ReturnType<typeof casper.loadWalletFromFile>>;
  let facW: typeof agentW;
  try {
    agentW = casper.loadRoleWallet("agent");
    facW = casper.loadRoleWallet("facilitator");
  } catch (e) {
    step("error", "real mode needs keys: run `pnpm casper:keygen`", false, {
      error: (e as Error).message,
    });
    return { ...base, error: "missing_keys" };
  }

  const req = {
    scheme: "exact" as const,
    network: casper.TESTNET.network,
    amount: toAtomic(event.usd),
    asset: WCSPR,
    payTo: tool.publisher.payTo,
    maxTimeoutSeconds: 120,
    extra: { name: "Wrapped CSPR", version: "1", symbol: "WCSPR", decimals: "9" },
  };

  step("request", `GET ${tool.slug} · ${event.title}`, true, { method: "GET", resource, input });
  step("402", "HTTP 402 Payment Required", true, {
    x402Version: 2,
    error: "payment_required",
    accepts: [req],
  });

  const payload = casper.signPayment(agentW, req);
  step("sign", "agent signed EIP-712 authorization (real Ed25519)", true, {
    "PAYMENT-SIGNATURE": payload,
  });

  const v = casper.verifyPayment(payload, req);
  step("verify", `facilitator /verify → ${v.valid ? "valid" : v.reason}`, v.valid, v);
  if (!v.valid) {
    step("error", `payment rejected: ${v.reason}`, false);
    return { ...base, error: v.reason };
  }

  const settle = await casper.settleOnChain(facW, payload, req);
  step(
    "settle",
    settle.success
      ? `settled on Casper testnet · ${settle.deployHash.slice(0, 16)}…`
      : `settle failed: ${settle.reason}`,
    settle.success,
    settle,
  );
  if (!settle.success) {
    step("error", `settlement failed: ${settle.reason}`, false);
    return { ...base, error: settle.reason };
  }

  const result = await getHandler(tool.handler)(input);
  step("result", "200 OK: tool result delivered", true, result);

  const settlement: Settlement = {
    id: "stl_" + settle.deployHash.slice(0, 16),
    toolId: tool.id,
    toolSlug: tool.slug,
    toolName: tool.name,
    eventName: event.name,
    payer: agentW.address,
    payerLabel: agentW.accountHash.slice(0, 8),
    amountUsd: event.usd,
    amountAtomic: req.amount,
    deployHash: settle.deployHash,
    network: settle.network,
    status: "settled",
    latencyMs: Date.now() - start,
    mode: "real",
    createdAt: new Date().toISOString(),
  };
  await recordSettlement(settlement);

  const receipt: Receipt = {
    settlementId: settlement.id,
    tool: tool.slug,
    event: event.name,
    costUsd: event.usd,
    payer: agentW.address,
    deployHash: settle.deployHash,
    resultHash: hashResult(result),
    network: settle.network,
    explorerUrl: explorerTx(settle.deployHash),
    budgetRemainingUsd:
      typeof opts.budgetRemainingUsd === "number"
        ? +(opts.budgetRemainingUsd - event.usd).toFixed(4)
        : null,
    createdAt: settlement.createdAt,
  };
  step("receipt", "receipt issued: verifiable on testnet.cspr.live", true, receipt);

  return { ...base, ok: true, result, receipt, settlement };
}
