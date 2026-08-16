// What every paid call produces once the money has moved: a ledger row and a
// receipt. Shared by both settlement chains so a receipt means the same thing
// whichever one is active, and so the ledger has exactly one writer.
import { DEFAULT_CHAIN, explorerTx, facilitatorReceipt, type ChainId } from "../chain";
import { recordSettlement } from "../data";
import type { Mode, PriceEvent, Receipt, Settlement, SettlementStatus, Tool } from "../types";
import { hashResult } from "./payment";

export const NO_STORE = {
  "Cache-Control": "no-store, private",
  // x402 puts the challenge and the settlement proof in headers, so a browser
  // client that cannot read them cannot complete the protocol.
  "Access-Control-Expose-Headers": "PAYMENT-REQUIRED, PAYMENT-RESPONSE",
} as const;

/**
 * A short, stable handle for a payer, for the live feed and the dashboard.
 *
 * Casper addresses travel with a "00" x402 prefix that carries no information;
 * Algorand addresses are base32 and readable from the front.
 */
export function payerLabel(payer: string, on: ChainId = DEFAULT_CHAIN): string {
  return on === "casper" ? payer.replace(/^00/, "").slice(0, 8) : payer.slice(0, 8);
}

export interface PaidCallRecord {
  tool: Tool;
  event: PriceEvent;
  payer: string;
  amountAtomic: string;
  txHash: string;
  network: string;
  mode: Mode;
  status?: SettlementStatus;
  latencyMs?: number;
  /** Omitted for a pending settlement, which has delivered nothing yet. */
  result?: unknown;
  budgetRemainingUsd?: number | null;
  on?: ChainId;
}

/**
 * Write the settlement to the ledger and mint the receipt for it.
 *
 * `explorerUrl` is null unless the transaction is genuinely on-chain. A mock
 * settlement carries a deterministic pseudo-hash, and handing that back as an
 * explorer link would present a fabricated hash as verifiable evidence.
 */
export async function recordPaidCall(
  rec: PaidCallRecord,
): Promise<{ settlement: Settlement; receipt: Receipt }> {
  const on = rec.on ?? DEFAULT_CHAIN;
  const status: SettlementStatus = rec.status ?? "settled";
  const createdAt = new Date().toISOString();
  const real = rec.mode === "real";

  const settlement: Settlement = {
    id: "stl_" + rec.txHash.slice(0, 16),
    toolId: rec.tool.id,
    toolSlug: rec.tool.slug,
    toolName: rec.tool.name,
    eventName: rec.event.name,
    payer: rec.payer,
    payerLabel: payerLabel(rec.payer, on),
    amountUsd: rec.event.usd,
    amountAtomic: rec.amountAtomic,
    txHash: rec.txHash,
    network: rec.network,
    status,
    latencyMs: rec.latencyMs ?? 0,
    mode: rec.mode,
    createdAt,
  };
  await recordSettlement(settlement);

  const receipt: Receipt = {
    settlementId: settlement.id,
    tool: rec.tool.slug,
    event: rec.event.name,
    costUsd: rec.event.usd,
    payer: rec.payer,
    txHash: rec.txHash,
    resultHash: rec.result === undefined ? "" : hashResult(rec.result),
    network: rec.network,
    mode: rec.mode,
    explorerUrl: real ? explorerTx(rec.txHash, on) : null,
    facilitatorReceiptUrl: real ? facilitatorReceipt(rec.txHash, on) : null,
    budgetRemainingUsd: rec.budgetRemainingUsd ?? null,
    createdAt,
  };

  return { settlement, receipt };
}
