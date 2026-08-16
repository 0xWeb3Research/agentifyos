// The seller half of x402 on Algorand: answer 402 with a price, then verify and
// settle whatever the buyer signs. Server-only, reached from /api/t/[slug].
//
// Every protocol decision belongs to the SDK. We choose the price and the payee;
// @x402-avm/core builds the challenge, matches the submitted payment to it, and
// calls the GoPlausible facilitator to verify and settle. The facilitator
// simulates the transaction group before it broadcasts, so a payer without the
// USDC (or without an ASA opt-in) is rejected at verify and nothing is charged.
import { NextResponse } from "next/server";
import { ALGO_TREASURY_ADDRESS } from "../config";
import { toAtomic } from "../chain";
import { getHandler } from "../tools/handlers";
import type { PriceEvent, Tool } from "../types";
import {
  buildRequirements,
  buildPaymentRequired,
  decodePaymentHeader,
  discoveryFor,
  getResourceServer,
  payerOf,
  paymentRequiredHeaders,
  settlePayment,
  settlementHeaders,
  TESTNET,
  verifyPayment,
} from "./algorand";
import { NO_STORE, recordPaidCall } from "./settlement";

/** x402 v2 sends PAYMENT-SIGNATURE; v1 clients still send X-PAYMENT. */
function paymentHeaderOf(req: Request): string | null {
  return req.headers.get("payment-signature") ?? req.headers.get("x-payment");
}

export async function algorandPaidResponse(
  req: Request,
  tool: Tool,
  event: PriceEvent,
  input: Record<string, unknown>,
): Promise<Response> {
  const resource = req.url;
  const payTo = ALGO_TREASURY_ADDRESS;

  // An unset payee is a deployment mistake, not a client error. Saying so beats
  // quoting a price nobody can pay, or worse, quoting one payable to "".
  if (!payTo) {
    return NextResponse.json(
      {
        error: "receiver_not_configured",
        detail: "ALGO_TREASURY_ADDRESS is unset; see docs/ALGORAND.md",
      },
      { status: 503, headers: NO_STORE },
    );
  }

  const started = Date.now();
  const header = paymentHeaderOf(req);
  const resourceInfo = {
    url: resource,
    description: `${tool.name} · ${event.title}`,
    mimeType: "application/json",
  };

  // ── no payment yet: quote the price ───────────────────────────────────────
  if (!header) {
    let challenge;
    try {
      challenge = await buildPaymentRequired(payTo, event.usd, resourceInfo, discoveryFor(tool));
    } catch (e) {
      return facilitatorUnavailable(e);
    }
    return NextResponse.json(
      // v2 carries the challenge in the PAYMENT-REQUIRED header; the body
      // repeats it so `curl` and our own docs stay readable. SDK clients read
      // the header, so the body is a convenience, never the source of truth.
      { x402Version: challenge.x402Version, error: challenge.error, resource: challenge.resource, accepts: challenge.accepts, extensions: challenge.extensions },
      { status: 402, headers: { ...paymentRequiredHeaders(challenge), ...NO_STORE } },
    );
  }

  // ── a payment arrived: verify it, settle it, then do the work ─────────────
  const payload = decodePaymentHeader(header);
  if (!payload) {
    return NextResponse.json(
      { error: "malformed_payment_signature" },
      { status: 400, headers: NO_STORE },
    );
  }

  let requirements;
  try {
    const server = await getResourceServer();
    const available = await buildRequirements(payTo, event.usd);
    // The buyer must have paid for THIS resource at THIS price. Matching against
    // freshly built requirements is what stops a payment minted for a cheaper
    // listing from unlocking an expensive one.
    requirements = server.findMatchingRequirements(available, payload);
    if (!requirements) {
      return NextResponse.json(
        { error: "requirements_mismatch", expected: available[0] },
        { status: 402, headers: NO_STORE },
      );
    }
  } catch (e) {
    return facilitatorUnavailable(e);
  }

  const verified = await verifyPayment(payload, requirements);
  if (!verified.isValid) {
    return NextResponse.json(
      {
        error: verified.invalidReason || "invalid_payment",
        detail: verified.invalidMessage,
        payer: verified.payer || payerOf(payload),
      },
      { status: 402, headers: NO_STORE },
    );
  }

  const settle = await settlePayment(payload, requirements);
  if (!settle.success) {
    return NextResponse.json(
      { error: "settle_failed", detail: settle.reason, payer: settle.payer },
      { status: 402, headers: NO_STORE },
    );
  }

  const result = await getHandler(tool.handler)(input);
  const { receipt } = await recordPaidCall({
    tool,
    event,
    payer: settle.payer,
    amountAtomic: requirements.amount || toAtomic(event.usd, "algorand"),
    txHash: settle.txId,
    network: settle.network,
    mode: "real",
    latencyMs: Date.now() - started,
    result,
    on: "algorand",
  });

  return NextResponse.json(
    { result, receipt },
    {
      status: 200,
      headers: {
        ...(settle.raw ? settlementHeaders(settle.raw) : {}),
        ...NO_STORE,
      },
    },
  );
}

// The facilitator is a third-party dependency: when it is unreachable we cannot
// price a call, let alone settle one. That is a 503 on our side, not a payment
// failure on the client's, and the difference matters to a retrying agent.
function facilitatorUnavailable(e: unknown): Response {
  return NextResponse.json(
    {
      error: "facilitator_unavailable",
      detail: (e as Error).message,
      facilitator: TESTNET.facilitatorUrl,
    },
    { status: 503, headers: NO_STORE },
  );
}
