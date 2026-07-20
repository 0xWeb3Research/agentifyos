import { NextResponse } from "next/server";
import { MODE } from "@/lib/config";
import { toAtomic } from "@/lib/format";
import { getToolBySlug, recordSettlement } from "@/lib/data";
import { getHandler } from "@/lib/tools/handlers";
import { getFacilitator } from "@/lib/x402/facilitator";
import {
  buildRequirements,
  hashResult,
  make402,
  type ExactPayload,
} from "@/lib/x402/payment";
import type { Receipt, Settlement } from "@/lib/types";
// type-only: erased at runtime, so the Casper SDK is still lazily loaded below
import type { ExactCasperPayload } from "@/lib/x402/casper";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/security/ratelimit";

// The genuine HTTP 402 paid endpoint: the surface external agents (our CLI, the
// MCP server, anyone) actually use. GET it with no payment header and you get a
// 402 plus machine-readable PaymentRequirements; sign an authorization, retry
// with `PAYMENT-SIGNATURE`, and once it settles on Casper you get the tool result
// and an on-chain receipt.
//
// Real-mode settlement POSTs a signed transaction to the Casper RPC, so this
// segment opts out of Next's fetch caching and runs on the Node runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const maxDuration = 300;

const WCSPR =
  process.env.WCSPR_PACKAGE_HASH ||
  "3d80df21ba4ee4d66a2a1f60c32570dd5685e4b279f6538162a5fd1314847c1e";

const NO_STORE = {
  "Cache-Control": "no-store, private",
  "Access-Control-Expose-Headers": "PAYMENT-REQUIRED, PAYMENT-RESPONSE",
};

// Settlements label the payer by the first 8 hex chars of the account hash,
// with or without the "00" x402 address prefix.
function payerLabel(payer: string): string {
  return payer.replace(/^00/, "").slice(0, 8);
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  // Payment is the auth on this endpoint; the limit just blunts free 402 spam.
  const rl = rateLimit(`paid:${clientIp(req)}`, 30, 60_000);
  if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

  const { slug } = await params;
  const tool = getToolBySlug(slug);
  if (!tool) {
    return NextResponse.json({ error: "tool_not_found", slug }, { status: 404 });
  }

  const event = tool.priceEvents[0];
  const resource = req.url;
  const payTo = tool.publisher.payTo;
  const header = req.headers.get("payment-signature");
  const input = Object.fromEntries(new URL(req.url).searchParams.entries());

  // ══ REAL MODE: settle on Casper testnet ═══════════════════════════════════
  if (MODE === "real") {
    const casper = await import("@/lib/x402/casper");

    const requirements = {
      scheme: "exact" as const,
      network: casper.TESTNET.network,
      amount: toAtomic(event.usd),
      asset: WCSPR,
      payTo,
      maxTimeoutSeconds: 120,
      extra: { name: "Wrapped CSPR", version: "1", symbol: "WCSPR", decimals: "9" },
    };

    // No payment yet → advertise the real price.
    if (!header) {
      return NextResponse.json(
        {
          x402Version: 2,
          error: "payment_required",
          accepts: [{ ...requirements, resource, description: `${tool.name} · ${event.title}`, mimeType: "application/json" }],
        },
        { status: 402, headers: { "PAYMENT-REQUIRED": "true", ...NO_STORE } },
      );
    }

    let payload: ExactCasperPayload;
    try {
      payload = JSON.parse(Buffer.from(header, "base64").toString());
    } catch {
      return NextResponse.json({ error: "malformed_payment_signature" }, { status: 400, headers: NO_STORE });
    }

    const v = casper.verifyPayment(payload, requirements);
    if (!v.valid) {
      return NextResponse.json({ error: v.reason, payer: v.payer }, { status: 402, headers: NO_STORE });
    }

    // A transfer from a payer without the funds reverts on-chain but still burns
    // the facilitator's gas, so check the balance before submitting anything.
    try {
      const balance = await casper.getWcsprBalance(payload.authorization.from);
      if (BigInt(balance) < BigInt(requirements.amount)) {
        return NextResponse.json(
          { error: "insufficient_payer_balance", payer: v.payer },
          { status: 402, headers: NO_STORE },
        );
      }
    } catch {
      /* balance read failed: fall through, settleOnChain reports its own errors */
    }

    const facilitator = casper.loadRoleWallet("facilitator");
    const settle = await casper.settleOnChain(facilitator, payload, requirements);

    // Confirmation timed out: the node accepted the transfer and it MAY still
    // execute on-chain, moving the payer's WCSPR. Reporting a plain failure here
    // would invite the client to retry into a second charge, and would leave a
    // real payment with no ledger entry. Record a pending row keyed on the
    // deploy hash (reconcilable from chain state) and answer 202, not 402.
    if (settle.status === "pending") {
      const payer = payload.authorization.from;
      const pending: Settlement = {
        id: "stl_" + settle.deployHash.slice(0, 16),
        toolId: tool.id,
        toolSlug: tool.slug,
        toolName: tool.name,
        eventName: event.name,
        payer,
        payerLabel: payerLabel(payer),
        amountUsd: event.usd,
        amountAtomic: requirements.amount,
        deployHash: settle.deployHash,
        network: settle.network,
        status: "pending",
        latencyMs: 0,
        mode: "real",
        createdAt: new Date().toISOString(),
      };
      await recordSettlement(pending);
      return NextResponse.json(
        {
          status: "pending",
          reason: settle.reason,
          deployHash: settle.deployHash,
          explorerUrl: settle.explorerUrl,
        },
        { status: 202, headers: NO_STORE },
      );
    }
    if (!settle.success) {
      return NextResponse.json(
        { error: settle.reason, deployHash: settle.deployHash || undefined },
        { status: 402, headers: NO_STORE },
      );
    }

    const result = await getHandler(tool.handler)(input);
    const payer = payload.authorization.from;

    const settlement: Settlement = {
      id: "stl_" + settle.deployHash.slice(0, 16),
      toolId: tool.id,
      toolSlug: tool.slug,
      toolName: tool.name,
      eventName: event.name,
      payer,
      payerLabel: payerLabel(payer),
      amountUsd: event.usd,
      amountAtomic: requirements.amount,
      deployHash: settle.deployHash,
      network: settle.network,
      status: "settled",
      latencyMs: 0,
      mode: "real",
      createdAt: new Date().toISOString(),
    };
    await recordSettlement(settlement);

    const receipt: Receipt = {
      settlementId: settlement.id,
      tool: tool.slug,
      event: event.name,
      costUsd: event.usd,
      payer,
      deployHash: settle.deployHash,
      resultHash: hashResult(result),
      network: settle.network,
      mode: "real",
      explorerUrl: settle.explorerUrl,
      budgetRemainingUsd: null,
      createdAt: settlement.createdAt,
    };

    return NextResponse.json(
      { result, receipt },
      {
        status: 200,
        headers: {
          "PAYMENT-RESPONSE": Buffer.from(JSON.stringify(settle)).toString("base64"),
          ...NO_STORE,
        },
      },
    );
  }

  // ══ OFFLINE MODE: in-process facilitator (tests / no funds) ═══════════════
  if (!header) {
    return NextResponse.json(make402(tool, event, resource, payTo), {
      status: 402,
      headers: { "PAYMENT-REQUIRED": "true", ...NO_STORE },
    });
  }

  let payload: ExactPayload;
  try {
    payload = JSON.parse(Buffer.from(header, "base64").toString());
  } catch {
    return NextResponse.json({ error: "malformed_payment_signature" }, { status: 400, headers: NO_STORE });
  }
  const req2 = buildRequirements(tool, event, resource, payTo);
  const fac = getFacilitator();

  const verify = await fac.verify(payload, req2);
  if (!verify.isValid) {
    return NextResponse.json({ error: verify.invalidReason }, { status: 402, headers: NO_STORE });
  }

  const settle = await fac.settle(payload, req2);
  if (!settle.success) {
    return NextResponse.json({ error: settle.errorReason }, { status: 402, headers: NO_STORE });
  }

  const result = await getHandler(tool.handler)(input);
  const payer = payload.payload.authorization.from;

  const settlement: Settlement = {
    id: "stl_" + settle.deployHash.slice(0, 16),
    toolId: tool.id,
    toolSlug: tool.slug,
    toolName: tool.name,
    eventName: event.name,
    payer,
    payerLabel: payerLabel(payer),
    amountUsd: event.usd,
    amountAtomic: req2.amount,
    deployHash: settle.deployHash,
    network: settle.network,
    status: "settled",
    latencyMs: settle.latencyMs,
    mode: "mock",
    createdAt: new Date().toISOString(),
  };
  await recordSettlement(settlement);

  const receipt: Receipt = {
    settlementId: settlement.id,
    tool: tool.slug,
    event: event.name,
    costUsd: event.usd,
    payer,
    deployHash: settle.deployHash,
    resultHash: hashResult(result),
    network: settle.network,
    // Mock settlement: the deploy hash is a deterministic pseudo-hash, not a
    // real transaction, so DON'T hand back a testnet.cspr.live link that 404s.
    mode: "mock",
    explorerUrl: null,
    budgetRemainingUsd: null,
    createdAt: settlement.createdAt,
  };

  return NextResponse.json(
    { result, receipt },
    {
      status: 200,
      headers: {
        "PAYMENT-RESPONSE": Buffer.from(JSON.stringify(settle)).toString("base64"),
        ...NO_STORE,
      },
    },
  );
}
