// The seller half of x402 on Casper, kept selectable with CHAIN=casper. The
// agent signs an EIP-712 authorization; our own facilitator key submits
// `transfer_with_authorization` on the WCSPR CEP-18 contract and pays the gas.
// Server-only, reached from /api/t/[slug].
import { NextResponse } from "next/server";
import { toAtomic } from "../chain";
import { getHandler } from "../tools/handlers";
import type { PriceEvent, Tool } from "../types";
import type { ExactCasperPayload } from "./casper";
import { NO_STORE, recordPaidCall } from "./settlement";

const WCSPR =
  process.env.WCSPR_PACKAGE_HASH ||
  "3d80df21ba4ee4d66a2a1f60c32570dd5685e4b279f6538162a5fd1314847c1e";

export async function casperPaidResponse(
  req: Request,
  tool: Tool,
  event: PriceEvent,
  input: Record<string, unknown>,
  payTo: string,
): Promise<Response> {
  const casper = await import("./casper");
  const resource = req.url;
  const header = req.headers.get("payment-signature");
  const started = Date.now();

  const requirements = {
    scheme: "exact" as const,
    network: casper.TESTNET.network,
    amount: toAtomic(event.usd, "casper"),
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
        accepts: [
          {
            ...requirements,
            resource,
            description: `${tool.name} · ${event.title}`,
            mimeType: "application/json",
          },
        ],
      },
      { status: 402, headers: { "PAYMENT-REQUIRED": "true", ...NO_STORE } },
    );
  }

  let payload: ExactCasperPayload;
  try {
    payload = JSON.parse(Buffer.from(header, "base64").toString());
  } catch {
    return NextResponse.json(
      { error: "malformed_payment_signature" },
      { status: 400, headers: NO_STORE },
    );
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

  let facilitator;
  try {
    facilitator = casper.loadRoleWallet("facilitator");
  } catch (e) {
    // No PEM on this deployment. Say so plainly: the payer did nothing wrong,
    // and telling them their payment failed would be a lie.
    return NextResponse.json(
      {
        error: "chain_not_configured",
        detail:
          "this deployment holds no Casper facilitator key. Switch back to Algorand, " +
          `or run it locally with CHAIN=casper (see docs/TESTNET.md). ${(e as Error).message}`,
      },
      { status: 503, headers: NO_STORE },
    );
  }
  const settle = await casper.settleOnChain(facilitator, payload, requirements);
  const payer = payload.authorization.from;

  // Confirmation timed out: the node accepted the transfer and it MAY still
  // execute on-chain, moving the payer's WCSPR. Reporting a plain failure here
  // would invite the client to retry into a second charge, and would leave a
  // real payment with no ledger entry. Record a pending row keyed on the
  // transaction hash (reconcilable from chain state) and answer 202, not 402.
  if (settle.status === "pending") {
    await recordPaidCall({
      tool,
      event,
      payer,
      amountAtomic: requirements.amount,
      txHash: settle.txHash,
      network: settle.network,
      mode: "real",
      status: "pending",
      on: "casper",
    });
    return NextResponse.json(
      {
        status: "pending",
        reason: settle.reason,
        txHash: settle.txHash,
        explorerUrl: settle.explorerUrl,
      },
      { status: 202, headers: NO_STORE },
    );
  }
  if (!settle.success) {
    return NextResponse.json(
      { error: settle.reason, txHash: settle.txHash || undefined },
      { status: 402, headers: NO_STORE },
    );
  }

  const result = await getHandler(tool.handler)(input);
  const { receipt } = await recordPaidCall({
    tool,
    event,
    payer,
    amountAtomic: requirements.amount,
    txHash: settle.txHash,
    network: settle.network,
    mode: "real",
    latencyMs: Date.now() - started,
    result,
    on: "casper",
  });

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
