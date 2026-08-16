// Real Algorand testnet integration, no mocks. Builds x402 v2 payment
// requirements, verifies a submitted payment, and settles it through the hosted
// GoPlausible facilitator, which broadcasts the atomic group and sponsors the
// network fee. Server-only.
//
// The protocol work is done by the official SDK, not by hand:
//   @x402-avm/core   the transport-agnostic resource server + header codecs
//   @x402-avm/avm    the AVM `exact` scheme (ASA transfer in an atomic group)
//   @x402-avm/fetch  the client wrapper the CLI and agent runner pay with
//
// Settlement mechanics: the client signs an ASA transfer of USDC to `payTo` and
// hands it over inside `paymentGroup`. The facilitator prepends its own fee
// transaction, groups them atomically, submits, and returns the transaction id.
// The payer therefore needs USDC and an ASA opt-in, but no ALGO whatsoever.
import algosdk from "algosdk";
import { HTTPFacilitatorClient, x402ResourceServer } from "@x402-avm/core/server";
import { ExactAvmScheme } from "@x402-avm/avm/exact/server";
import {
  decodePaymentSignatureHeader,
  encodePaymentRequiredHeader,
  encodePaymentResponseHeader,
} from "@x402-avm/core/http";
import type { ResourceConfig } from "@x402-avm/core/server";
import type {
  PaymentPayload,
  PaymentRequired,
  PaymentRequirements,
  ResourceInfo,
  ResourceServerExtension,
  SettleResponse,
  VerifyResponse,
} from "@x402-avm/core/types";
import { bazaarResourceServerExtension, declareDiscoveryExtension } from "@x402-avm/extensions";
import { ALGO, toAtomic } from "../chain";
import type { Tool } from "../types";

export const TESTNET = {
  network: ALGO.network,
  chainName: ALGO.chainName,
  algodUrl: ALGO.algod,
  explorerBase: ALGO.explorerBase,
  facilitatorUrl: ALGO.facilitatorUrl,
  assetId: ALGO.assetId,
  decimals: Number(ALGO.asset.decimals),
} as const;

export type RoleKey = "treasury" | "agent";

// ── the x402 resource server ────────────────────────────────────────────────
// initialize() fetches GET {facilitator}/supported, which is where the fee
// sponsor's address comes from. Requirements built before that call would omit
// `extra.feePayer`, and the client would then build a group with no fee payer
// and a payer holding zero ALGO, so the whole point would quietly break. The
// promise is memoized, and a failed init is discarded so the next request
// retries instead of caching a dead server.
let serverPromise: Promise<x402ResourceServer> | null = null;

export function getResourceServer(): Promise<x402ResourceServer> {
  if (!serverPromise) {
    serverPromise = (async () => {
      const facilitator = new HTTPFacilitatorClient({ url: TESTNET.facilitatorUrl });
      const server = new x402ResourceServer(facilitator)
        .register(TESTNET.network, new ExactAvmScheme())
        // Bazaar is how a listing becomes discoverable beyond our own catalog:
        // the 402 carries a machine-readable call signature, the payer echoes it
        // back, and the facilitator catalogs the resource when the payment
        // settles. Publishing to the public Bazaar is a side effect of being
        // paid, so there is nothing to register and nothing to keep in sync.
        .registerExtension(bazaarResourceServerExtension as ResourceServerExtension);
      await server.initialize();
      if (!server.getSupportedKind(2, TESTNET.network, "exact")) {
        throw new Error(
          `facilitator ${TESTNET.facilitatorUrl} does not advertise exact/${TESTNET.network}`,
        );
      }
      return server;
    })().catch((e) => {
      serverPromise = null;
      throw e;
    });
  }
  return serverPromise;
}

/** The fee-sponsoring address the facilitator advertises for this network. */
export async function facilitatorFeePayer(): Promise<string | null> {
  const kind = (await getResourceServer()).getSupportedKind(2, TESTNET.network, "exact");
  const feePayer = kind?.extra?.feePayer;
  return typeof feePayer === "string" ? feePayer : null;
}

// ── building the 402 ────────────────────────────────────────────────────────

/**
 * What one paid call costs, as the resource server wants it.
 *
 * The price is passed as an explicit AssetAmount rather than a "$0.005" string
 * so the atomic amount is ours and not the SDK's default money parser: a listing
 * priced at $0.005 always quotes exactly 5000 microUSDC.
 */
export function resourceConfigFor(payTo: string, usd: number): ResourceConfig {
  return {
    scheme: "exact",
    network: TESTNET.network,
    payTo,
    price: { asset: TESTNET.assetId, amount: toAtomic(usd, "algorand") },
    maxTimeoutSeconds: 120,
  };
}

export async function buildRequirements(
  payTo: string,
  usd: number,
): Promise<PaymentRequirements[]> {
  const server = await getResourceServer();
  return server.buildPaymentRequirements(resourceConfigFor(payTo, usd));
}

// Our catalog describes a field as "url" or "string[]"; JSON Schema wants a
// primitive type and an items clause. Anything unrecognised degrades to string,
// which is the honest answer for a free-text field.
function jsonSchemaType(t: string): Record<string, unknown> {
  const base = t.replace(/\[\]$/, "");
  const mapped =
    base === "number" || base === "integer"
      ? "number"
      : base === "boolean"
        ? "boolean"
        : base === "object"
          ? "object"
          : "string";
  const format = base === "url" ? { format: "uri" } : {};
  return t.endsWith("[]")
    ? { type: "array", items: { type: mapped, ...format } }
    : { type: mapped, ...format };
}

/**
 * The Bazaar declaration for one listing: how to call it and what comes back.
 *
 * This is the same manifest the marketplace page renders, expressed in the
 * format the discovery extension expects, so a listing cannot describe itself
 * one way to humans and another to agents.
 */
export function discoveryFor(tool: Tool): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  const example: Record<string, unknown> = {};
  for (const field of tool.input) {
    properties[field.name] = {
      ...jsonSchemaType(field.type),
      ...(field.description ? { description: field.description } : {}),
    };
    if (field.required) required.push(field.name);
    if (field.example !== undefined) example[field.name] = field.example;
  }
  return declareDiscoveryExtension({
    input: example,
    inputSchema: { properties, ...(required.length ? { required } : {}) },
    output: { example: tool.outputExample },
  });
}

export async function buildPaymentRequired(
  payTo: string,
  usd: number,
  resource: ResourceInfo,
  extensions?: Record<string, unknown>,
): Promise<PaymentRequired> {
  const server = await getResourceServer();
  const requirements = await buildRequirements(payTo, usd);
  return server.createPaymentRequiredResponse(
    requirements,
    resource,
    "payment_required",
    extensions,
  );
}

// x402 v2 carries the challenge in the PAYMENT-REQUIRED header, base64 JSON, and
// leaves the body free. We fill the body too: a human curling the endpoint, and
// our own docs, both expect to read `accepts` without decoding a header. SDK
// clients read the header, so the body is additive, never authoritative.
export function paymentRequiredHeaders(pr: PaymentRequired): Record<string, string> {
  return { "PAYMENT-REQUIRED": encodePaymentRequiredHeader(pr) };
}

export function settlementHeaders(settle: SettleResponse): Record<string, string> {
  return { "PAYMENT-RESPONSE": encodePaymentResponseHeader(settle) };
}

/**
 * Decode the client's PAYMENT-SIGNATURE header.
 *
 * The header is attacker-controlled and arrives unauthenticated, so a malformed
 * value must produce null rather than an exception that becomes a 500.
 */
export function decodePaymentHeader(header: string | null): PaymentPayload | null {
  if (!header) return null;
  try {
    const payload = decodePaymentSignatureHeader(header);
    return payload && typeof payload === "object" ? payload : null;
  } catch {
    return null;
  }
}

// ── verify and settle ───────────────────────────────────────────────────────

export async function verifyPayment(
  payload: PaymentPayload,
  requirements: PaymentRequirements,
): Promise<VerifyResponse> {
  const server = await getResourceServer();
  try {
    return await server.verifyPayment(payload, requirements);
  } catch (e) {
    return { isValid: false, invalidReason: "verify_failed", invalidMessage: (e as Error).message };
  }
}

export interface AlgorandSettleResult {
  success: boolean;
  /** Algorand transaction id. Empty when the facilitator rejected outright. */
  txId: string;
  explorerUrl: string;
  network: string;
  payer: string;
  reason?: string;
  raw?: SettleResponse;
}

export async function settlePayment(
  payload: PaymentPayload,
  requirements: PaymentRequirements,
): Promise<AlgorandSettleResult> {
  const server = await getResourceServer();
  const payer = payerOf(payload);
  try {
    const res = await server.settlePayment(payload, requirements);
    return {
      success: !!res.success,
      txId: res.transaction || "",
      explorerUrl: res.transaction ? explorerTx(res.transaction) : "",
      network: res.network || TESTNET.network,
      payer: res.payer || payer,
      reason: res.success ? undefined : res.errorMessage || res.errorReason || "settle_failed",
      raw: res,
    };
  } catch (e) {
    return {
      success: false,
      txId: "",
      explorerUrl: "",
      network: TESTNET.network,
      payer,
      reason: (e as Error).message,
    };
  }
}

/**
 * Who signed the payment, read off the transaction group.
 *
 * The AVM payload is `{ paymentGroup: base64[], paymentIndex }`; the sender of
 * the transaction at paymentIndex is the payer. The facilitator reports the same
 * address back on success, but we need it before settlement too, for balance
 * checks and for the failure paths that never reach the facilitator.
 */
export function payerOf(payload: PaymentPayload): string {
  try {
    const group = (payload?.payload as { paymentGroup?: unknown })?.paymentGroup;
    const index = Number((payload?.payload as { paymentIndex?: unknown })?.paymentIndex ?? 0);
    if (!Array.isArray(group) || typeof group[index] !== "string") return "";
    const raw = Buffer.from(group[index] as string, "base64");
    // Group members may arrive signed or unsigned; try the signed envelope first.
    let txn: algosdk.Transaction;
    try {
      txn = algosdk.decodeSignedTransaction(raw).txn;
    } catch {
      txn = algosdk.decodeUnsignedTransaction(raw);
    }
    return txn.sender.toString();
  } catch {
    return "";
  }
}

export function explorerTx(txId: string): string {
  return `${TESTNET.explorerBase}/transaction/${txId}`;
}

export function explorerAccount(address: string): string {
  return `${TESTNET.explorerBase}/account/${address}`;
}

// ── accounts ────────────────────────────────────────────────────────────────
// Secrets are 25-word mnemonics in the environment. Nothing is read from disk:
// hosted deploys (Railway, Vercel) can't ship key files, and unlike the Casper
// path there is no PEM format to fall back to.

export interface AlgorandAccount {
  addr: string;
  sk: Uint8Array;
  /** Base64 of the 64-byte secret key, the form toClientAvmSigner wants. */
  privateKeyBase64: string;
  role: RoleKey;
}

const ENV_MNEMONIC: Record<RoleKey, string> = {
  treasury: "ALGO_TREASURY_MNEMONIC",
  agent: "ALGO_AGENT_MNEMONIC",
};

export function loadRoleAccount(role: RoleKey): AlgorandAccount {
  const envVar = ENV_MNEMONIC[role];
  const mnemonic = process.env[envVar]?.trim();
  if (!mnemonic) {
    throw new Error(
      `${envVar} is not set. Run \`pnpm algo:keygen\` and put the printed mnemonic in apps/web/.env (see docs/ALGORAND.md).`,
    );
  }
  return accountFromMnemonic(mnemonic, role);
}

export function accountFromMnemonic(mnemonic: string, role: RoleKey = "agent"): AlgorandAccount {
  const { addr, sk } = algosdk.mnemonicToSecretKey(mnemonic.replace(/\s+/g, " ").trim());
  return {
    addr: addr.toString(),
    sk,
    privateKeyBase64: Buffer.from(sk).toString("base64"),
    role,
  };
}

/** Does this role have a usable key? Used to fail a request early and clearly. */
export function hasRoleAccount(role: RoleKey): boolean {
  return !!process.env[ENV_MNEMONIC[role]]?.trim();
}

// ── chain reads and one-off writes ──────────────────────────────────────────
// Everything x402 needs runs through the facilitator; algod is only used for the
// operator-facing bits: balances, the USDC opt-in, and funding an agent.

let algodClient: algosdk.Algodv2 | null = null;

export function algod(): algosdk.Algodv2 {
  if (!algodClient) {
    algodClient = new algosdk.Algodv2(
      process.env.ALGOD_TOKEN || "",
      TESTNET.algodUrl,
      process.env.ALGOD_PORT || "",
    );
  }
  return algodClient;
}

export interface AccountBalances {
  address: string;
  /** microALGO. Zero is fine for a payer: the facilitator sponsors fees. */
  algo: bigint;
  /** microUSDC held, or null when the account has not opted into the ASA. */
  usdc: bigint | null;
  optedIn: boolean;
  /** False when the address has never been funded and so does not exist yet. */
  exists: boolean;
}

export async function getBalances(address: string): Promise<AccountBalances> {
  const assetId = BigInt(TESTNET.assetId);
  try {
    const info = await algod().accountInformation(address).do();
    const holding = (info.assets ?? []).find((a) => BigInt(a.assetId) === assetId);
    return {
      address,
      algo: BigInt(info.amount ?? 0),
      usdc: holding ? BigInt(holding.amount) : null,
      optedIn: !!holding,
      exists: true,
    };
  } catch (e) {
    // algod answers 404 for an address that has never received anything. That
    // is a zero balance, not a failure to read.
    if (/404|not found|no accounts found/i.test((e as Error).message)) {
      return { address, algo: 0n, usdc: null, optedIn: false, exists: false };
    }
    throw e;
  }
}

async function submit(account: AlgorandAccount, txn: algosdk.Transaction): Promise<string> {
  const signed = txn.signTxn(account.sk);
  const { txid } = await algod().sendRawTransaction(signed).do();
  await algosdk.waitForConfirmation(algod(), txid, 8);
  return txid;
}

/**
 * Opt an account into the USDC ASA.
 *
 * Algorand will not credit an asset to an account that has not opted in, so both
 * the buying agent and every receiving address must do this once. It costs a
 * transaction fee and raises the account's minimum balance by 0.1 ALGO, which is
 * the only reason a payer needs any ALGO at all.
 */
export async function optInUsdc(account: AlgorandAccount): Promise<string | null> {
  const balances = await getBalances(account.addr);
  if (balances.optedIn) return null;
  const suggestedParams = await algod().getTransactionParams().do();
  const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: account.addr,
    receiver: account.addr,
    amount: 0,
    assetIndex: Number(TESTNET.assetId),
    suggestedParams,
  });
  return submit(account, txn);
}

/** Move USDC between accounts we control, to stock an agent before a demo. */
export async function transferUsdc(
  from: AlgorandAccount,
  to: string,
  atomicAmount: string | bigint,
): Promise<string> {
  const suggestedParams = await algod().getTransactionParams().do();
  const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: from.addr,
    receiver: to,
    amount: BigInt(atomicAmount),
    assetIndex: Number(TESTNET.assetId),
    suggestedParams,
  });
  return submit(from, txn);
}

/** Send native ALGO, so a fresh agent can afford its one-time opt-in. */
export async function transferAlgo(
  from: AlgorandAccount,
  to: string,
  microAlgos: string | bigint,
): Promise<string> {
  const suggestedParams = await algod().getTransactionParams().do();
  const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: from.addr,
    receiver: to,
    amount: BigInt(microAlgos),
    suggestedParams,
  });
  return submit(from, txn);
}
