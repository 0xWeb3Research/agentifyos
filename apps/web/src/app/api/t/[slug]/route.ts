import { NextResponse } from "next/server";
import { MODE, explorerTx } from "@/lib/config";
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

// The genuine HTTP 402 paid endpoint — the surface external agents (our CLI, the
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

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
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

  // ══ REAL MODE — settle on Casper testnet ══════════════════════════════════
  if (MODE === "real") {
    const casper = await import("@/lib/x402/casper");
    const path = await import("node:path");

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
          accepts: [{ ...requirements, resource, description: `${tool.name} — ${event.title}`, mimeType: "application/json" }],
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

    const facilitator = casper.loadWalletFromFile(
      process.env.FACILITATOR_KEY_PEM
        ? path.resolve(process.cwd(), process.env.FACILITATOR_KEY_PEM)
        : path.join(process.cwd(), "keys", "facilitator.pem"),
    );
    const settle = await casper.settleOnChain(facilitator, payload, requirements);
    if (!settle.success) {
      return NextResponse.json({ error: settle.reason }, { status: 402, headers: NO_STORE });
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
      payerLabel: payer.slice(2, 10),
      amountUsd: event.usd,
      amountAtomic: requirements.amount,
      deployHash: settle.deployHash,
      network: settle.network,
      status: "settled",
      latencyMs: 0,
      mode: "real",
      createdAt: new Date().toISOString(),
    };
    recordSettlement(settlement);

    const receipt: Receipt = {
      settlementId: settlement.id,
      tool: tool.slug,
      event: event.name,
      costUsd: event.usd,
      payer,
      deployHash: settle.deployHash,
      resultHash: hashResult(result),
      network: settle.network,
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

  // ══ OFFLINE MODE — in-process facilitator (tests / no funds) ══════════════
  if (!header) {
    return NextResponse.json(make402(tool, event, resource, payTo), {
      status: 402,
      headers: { "PAYMENT-REQUIRED": "true", ...NO_STORE },
    });
  }

  const payload = JSON.parse(Buffer.from(header, "base64").toString()) as ExactPayload;
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
    payerLabel: payer.slice(0, 10),
    amountUsd: event.usd,
    amountAtomic: req2.amount,
    deployHash: settle.deployHash,
    network: settle.network,
    status: "settled",
    latencyMs: settle.latencyMs,
    mode: "mock",
    createdAt: new Date().toISOString(),
  };
  recordSettlement(settlement);

  const receipt: Receipt = {
    settlementId: settlement.id,
    tool: tool.slug,
    event: event.name,
    costUsd: event.usd,
    payer,
    deployHash: settle.deployHash,
    resultHash: hashResult(result),
    network: settle.network,
    explorerUrl: explorerTx(settle.deployHash),
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
