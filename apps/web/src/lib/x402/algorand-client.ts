// The buying half of x402 on Algorand: take an HTTP 402, sign the USDC transfer
// it asks for, and retry. Server-only, because it holds the agent's key.
//
// The handshake is driven step by step rather than through
// `wrapFetchWithPayment` so the UI can show what actually happened on the wire.
// Every protocol operation still belongs to the SDK: `x402HTTPClient` decodes
// the challenge, the AVM `exact` scheme builds and signs the transaction group,
// and the SDK encodes the header. Nothing about the payment is hand-rolled here.
import { x402Client, x402HTTPClient } from "@x402-avm/core/client";
import { wrapFetchWithPayment } from "@x402-avm/fetch";
import { ExactAvmScheme } from "@x402-avm/avm/exact/client";
import { toClientAvmSigner } from "@x402-avm/avm";
import type { PaymentRequired, PaymentRequirements, SettleResponse } from "@x402-avm/core/types";
import { fromAtomic } from "../chain";
import { TESTNET, explorerTx, type AlgorandAccount } from "./algorand";

export interface AlgorandPayClient {
  address: string;
  core: x402Client;
  http: x402HTTPClient;
}

export function makePayClient(account: AlgorandAccount): AlgorandPayClient {
  const signer = toClientAvmSigner(account.privateKeyBase64);
  const core = new x402Client().register(TESTNET.network, new ExactAvmScheme(signer));
  return { address: account.addr, core, http: new x402HTTPClient(core) };
}

/**
 * A `fetch` that pays for whatever it is pointed at.
 *
 * This is the whole integration for anyone who does not need to watch the
 * handshake: three lines, and a 402 becomes a 200. `payAndFetch` below drives
 * the same client a step at a time instead, because the demo has to show its
 * work; both go through the same scheme, signer, and headers.
 *
 * ```ts
 * const pay = paymentEnabledFetch(loadRoleAccount("agent"));
 * const res = await pay("https://agentifyos.xyz/api/t/algo-market-data");
 * ```
 */
export function paymentEnabledFetch(
  account: AlgorandAccount,
  fetchImpl: typeof globalThis.fetch = fetch,
): (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> {
  return wrapFetchWithPayment(fetchImpl, makePayClient(account).core);
}

export type PayStepKind = "request" | "402" | "sign" | "settle" | "result" | "error";

export interface PayStep {
  kind: PayStepKind;
  label: string;
  detail?: unknown;
  ok: boolean;
  atMs: number;
}

export interface PayResult {
  ok: boolean;
  status: number;
  /** Parsed JSON body of the paid response. */
  body?: unknown;
  requirements?: PaymentRequirements;
  challenge?: PaymentRequired;
  settle?: SettleResponse;
  txId?: string;
  explorerUrl?: string;
  costUsd?: number;
  error?: string;
  steps: PayStep[];
}

export interface PayOptions {
  /** Refuse to pay more than this many dollars for one call. */
  maxUsd?: number;
  method?: string;
  headers?: Record<string, string>;
  body?: BodyInit;
  onStep?: (s: PayStep) => void;
  fetchImpl?: typeof fetch;
}

/**
 * Call a paid endpoint, paying if it answers 402.
 *
 * A non-402 first response is returned untouched: a free or cached resource is
 * not something to pay for.
 */
export async function payAndFetch(
  url: string,
  client: AlgorandPayClient,
  opts: PayOptions = {},
): Promise<PayResult> {
  const doFetch = opts.fetchImpl ?? fetch;
  const method = opts.method ?? "GET";
  const start = Date.now();
  const steps: PayStep[] = [];
  const step = (kind: PayStepKind, label: string, ok = true, detail?: unknown): PayStep => {
    const s: PayStep = { kind, label, ok, detail, atMs: Date.now() - start };
    steps.push(s);
    opts.onStep?.(s);
    return s;
  };
  const baseHeaders = { accept: "application/json", ...(opts.headers ?? {}) };

  step("request", `${method} ${url}`);
  // The resource is reached over the network, so it can simply be unreachable.
  // That is a failed call to report, not an exception to escape as a 500.
  let first: Response;
  try {
    first = await doFetch(url, { method, headers: baseHeaders, body: opts.body });
  } catch (e) {
    step("error", `could not reach ${url}: ${(e as Error).message}`, false);
    return { ok: false, status: 0, error: "resource_unreachable", steps };
  }

  if (first.status !== 402) {
    const body = await first.json().catch(() => null);
    return { ok: first.ok, status: first.status, body, steps };
  }

  // x402 v2 puts the challenge in the PAYMENT-REQUIRED header. The body is
  // passed too so a v1 server, which answers in the body, still parses.
  let challenge: PaymentRequired;
  try {
    const body = await first.json().catch(() => undefined);
    challenge = client.http.getPaymentRequiredResponse((n) => first.headers.get(n), body);
  } catch (e) {
    step("error", `402 without usable payment requirements: ${(e as Error).message}`, false);
    return { ok: false, status: 402, error: "no_payment_requirements", steps };
  }

  const requirements = challenge.accepts?.[0];
  if (!requirements) {
    step("error", "402 carried an empty accepts list", false);
    return { ok: false, status: 402, error: "no_payment_requirements", challenge, steps };
  }

  const costUsd = fromAtomic(requirements.amount, "algorand");
  step(
    "402",
    `payment required: ${requirements.amount} microUSDC (~$${costUsd.toFixed(4)}) → ${requirements.payTo.slice(0, 10)}…`,
    true,
    requirements,
  );

  if (typeof opts.maxUsd === "number" && costUsd > opts.maxUsd + 1e-9) {
    step("error", `price $${costUsd.toFixed(4)} exceeds budget $${opts.maxUsd}`, false);
    return { ok: false, status: 402, error: "over_budget", requirements, challenge, costUsd, steps };
  }

  let header: Record<string, string>;
  try {
    const payload = await client.http.createPaymentPayload(challenge);
    header = client.http.encodePaymentSignatureHeader(payload);
    const group = (payload.payload as { paymentGroup?: string[]; paymentIndex?: number }) ?? {};
    step(
      "sign",
      `signed a ${group.paymentGroup?.length ?? 0}-transaction group as ${client.address.slice(0, 10)}…`,
      true,
      {
        // The encoded transactions are the payment itself; anyone holding them
        // could settle it. Report the shape, never the bytes.
        paymentGroupSize: group.paymentGroup?.length ?? 0,
        paymentIndex: group.paymentIndex ?? 0,
        payer: client.address,
        feePayer: requirements.extra?.feePayer ?? null,
      },
    );
  } catch (e) {
    step("error", `could not build the payment: ${(e as Error).message}`, false);
    return { ok: false, status: 402, error: "payment_build_failed", requirements, challenge, costUsd, steps };
  }

  let paid: Response;
  try {
    paid = await doFetch(url, {
      method,
      headers: { ...baseHeaders, ...header },
      body: opts.body,
    });
  } catch (e) {
    // The payment was signed but never delivered, so nothing settled and the
    // buyer was not charged. Say that, rather than throwing.
    step("error", `could not deliver the payment: ${(e as Error).message}`, false);
    return { ok: false, status: 0, error: "resource_unreachable", requirements, challenge, costUsd, steps };
  }
  const body = (await paid.json().catch(() => null)) as { error?: string } | null;

  if (!paid.ok) {
    step("error", `payment rejected: ${body?.error ?? paid.status}`, false, body);
    return {
      ok: false,
      status: paid.status,
      body,
      error: body?.error ?? String(paid.status),
      requirements,
      challenge,
      costUsd,
      steps,
    };
  }

  let settle: SettleResponse | undefined;
  try {
    settle = client.http.getPaymentSettleResponse((n) => paid.headers.get(n));
  } catch {
    /* the resource answered 200 without a settlement header; the body receipt still stands */
  }
  const txId = settle?.transaction;
  step("settle", txId ? `settled on Algorand testnet · ${txId}` : "settled", true, settle);
  step("result", "200 OK: tool result delivered", true, body);

  return {
    ok: true,
    status: paid.status,
    body,
    requirements,
    challenge,
    settle,
    txId,
    explorerUrl: txId ? explorerTx(txId) : undefined,
    costUsd,
    steps,
  };
}
