import { NextResponse } from "next/server";
import { MODE, resolvePayTo } from "@/lib/config";
import { getChainId } from "@/lib/chain-server";
import { getToolBySlug } from "@/lib/data";
import { getHandler } from "@/lib/tools/handlers";
import { getFacilitator } from "@/lib/x402/facilitator";
import { buildRequirements, make402, type ExactPayload } from "@/lib/x402/payment";
import { NO_STORE, recordPaidCall } from "@/lib/x402/settlement";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/security/ratelimit";

// The genuine HTTP 402 paid endpoint: the surface external agents (our CLI, the
// MCP server, anyone) actually use. GET it with no payment header and you get a
// 402 plus machine-readable PaymentRequirements; sign the payment, retry with
// `PAYMENT-SIGNATURE`, and once it settles on-chain you get the tool result and
// a receipt you can check on the explorer.
//
// Which chain settles is a deployment choice, not a protocol one: the handshake
// above is identical on Algorand and on Casper, so the two paths differ only in
// how a payment gets signed and broadcast.
//
// Real-mode settlement talks to a facilitator over HTTP and the AVM SDK reaches
// for Buffer, so this segment opts out of Next's fetch caching and runs on Node.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const maxDuration = 300;

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
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
  // The chain is per request, not per deployment: a reader who switched chains
  // in the UI gets quoted, and charged, on the chain they picked.
  const on = await getChainId();
  const payTo = resolvePayTo(tool.publisher.payTo, on);
  const input = Object.fromEntries(new URL(req.url).searchParams.entries());

  if (MODE === "real") {
    if (on === "algorand") {
      const { algorandPaidResponse } = await import("@/lib/x402/algorand-route");
      return algorandPaidResponse(req, tool, event, input);
    }
    const { casperPaidResponse } = await import("@/lib/x402/casper-route");
    return casperPaidResponse(req, tool, event, input, payTo);
  }

  // ══ OFFLINE MODE: in-process facilitator (tests / no funds) ═══════════════
  const header = req.headers.get("payment-signature");
  if (!header) {
    return NextResponse.json(make402(tool, event, resource, payTo, on), {
      status: 402,
      headers: { "PAYMENT-REQUIRED": "true", ...NO_STORE },
    });
  }

  let payload: ExactPayload;
  try {
    payload = JSON.parse(Buffer.from(header, "base64").toString());
  } catch {
    return NextResponse.json(
      { error: "malformed_payment_signature" },
      { status: 400, headers: NO_STORE },
    );
  }
  const requirements = buildRequirements(tool, event, resource, payTo, on);
  const fac = getFacilitator();

  const verify = await fac.verify(payload, requirements);
  if (!verify.isValid) {
    return NextResponse.json({ error: verify.invalidReason }, { status: 402, headers: NO_STORE });
  }

  const settle = await fac.settle(payload, requirements);
  if (!settle.success) {
    return NextResponse.json({ error: settle.errorReason }, { status: 402, headers: NO_STORE });
  }

  const result = await getHandler(tool.handler)(input);
  const { receipt } = await recordPaidCall({
    tool,
    event,
    payer: payload.payload.authorization.from,
    amountAtomic: requirements.amount,
    txHash: settle.txHash,
    network: settle.network,
    mode: "mock",
    latencyMs: settle.latencyMs,
    result,
    on,
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
