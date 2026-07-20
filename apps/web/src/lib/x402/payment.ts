import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign as edSign,
  verify as edVerify,
  randomBytes,
  type KeyObject,
} from "node:crypto";
import { CSPR } from "../config";
import { toAtomic } from "../format";
import type { PriceEvent, Tool } from "../types";

// ── x402 V2 wire types (Casper "exact" scheme) ──────────────────────────────

export interface PaymentRequirements {
  scheme: "exact";
  network: string; // casper:casper-test
  amount: string; // atomic WCSPR
  asset: string; // CEP-18 package hash
  payTo: string; // 00 + account hash
  maxTimeoutSeconds: number;
  resource: string;
  description: string;
  mimeType: string;
  extra: { name: string; symbol: string; version: string; decimals: string };
}

export interface Payment402Body {
  x402Version: 2;
  error: string;
  accepts: PaymentRequirements[];
}

export interface Authorization {
  from: string; // payer account hash
  to: string; // payee account hash
  value: string; // atomic
  validAfter: number; // unix seconds
  validBefore: number;
  nonce: string; // 32-byte hex
}

export interface ExactPayload {
  x402Version: 2;
  scheme: "exact";
  network: string;
  payload: {
    signature: string; // hex Ed25519 signature over canonical(authorization)
    publicKey: string; // Casper-style "01"-prefixed Ed25519 public key hex
    authorization: Authorization;
  };
}

// ── builders ────────────────────────────────────────────────────────────────

export function buildRequirements(
  tool: Tool,
  event: PriceEvent,
  resourceUrl: string,
  payTo: string,
): PaymentRequirements {
  return {
    scheme: "exact",
    network: CSPR.network,
    amount: toAtomic(event.usd),
    asset: CSPR.wcsprPackageHash,
    payTo,
    maxTimeoutSeconds: 60,
    resource: resourceUrl,
    description: `${tool.name} · ${event.title}`,
    mimeType: "application/json",
    extra: CSPR.asset,
  };
}

export function make402(
  tool: Tool,
  event: PriceEvent,
  resourceUrl: string,
  payTo: string,
): Payment402Body {
  return {
    x402Version: 2,
    error: "payment_required",
    accepts: [buildRequirements(tool, event, resourceUrl, payTo)],
  };
}

// Deterministic, stable JSON — the exact bytes that get signed and verified.
export function canonical(obj: unknown): string {
  if (obj === null || typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) return `[${obj.map(canonical).join(",")}]`;
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${canonical((obj as Record<string, unknown>)[k])}`)
    .join(",")}}`;
}

export function newNonce(): string {
  return randomBytes(32).toString("hex");
}

// ── real Ed25519 (same curve Casper uses), deterministic from a seed ─────────
// Mock mode uses these directly; real mode swaps in casper-eip-712 typed-data
// signing over a TransferAuthorization struct + a funded PEM key. The verify
// path only ever needs the public key — no secret leaves the wallet.

const PKCS8_ED25519_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");
const SPKI_ED25519_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

function privFromSeed(seed32: Buffer): KeyObject {
  return createPrivateKey({
    key: Buffer.concat([PKCS8_ED25519_PREFIX, seed32]),
    format: "der",
    type: "pkcs8",
  });
}

function pubFromRawHex(publicKeyHex: string): KeyObject {
  // strip Casper's "01" Ed25519 algorithm prefix → 32-byte raw key
  const raw = Buffer.from(publicKeyHex.slice(2), "hex");
  return createPublicKey({
    key: Buffer.concat([SPKI_ED25519_PREFIX, raw]),
    format: "der",
    type: "spki",
  });
}

export interface AgentWallet {
  seedHex: string; // demo only — a real agent holds this in a PEM/KMS
  publicKey: string; // "01" + raw ed25519 hex (Casper convention)
  accountHash: string; // "00" + blake-style hash (mock uses sha256)
  label: string;
}

export function makeWallet(seed: string, label: string): AgentWallet {
  const seed32 = createHash("sha256").update("agentifyos:" + seed).digest();
  const priv = privFromSeed(seed32);
  const rawPub = createPublicKey(priv).export({ format: "der", type: "spki" }).subarray(-32);
  const publicKey = "01" + Buffer.from(rawPub).toString("hex");
  const accountHash = "00" + createHash("sha256").update(publicKey).digest("hex");
  return { seedHex: seed32.toString("hex"), publicKey, accountHash, label };
}

export function signAuthorization(auth: Authorization, wallet: AgentWallet): string {
  const priv = privFromSeed(Buffer.from(wallet.seedHex, "hex"));
  return edSign(null, Buffer.from(canonical(auth)), priv).toString("hex");
}

export function verifySignature(
  auth: Authorization,
  signatureHex: string,
  publicKeyHex: string,
): boolean {
  try {
    return edVerify(
      null,
      Buffer.from(canonical(auth)),
      pubFromRawHex(publicKeyHex),
      Buffer.from(signatureHex, "hex"),
    );
  } catch {
    return false;
  }
}

export function buildPayload(
  wallet: AgentWallet,
  req: PaymentRequirements,
  nowSec = Math.floor(Date.now() / 1000),
): ExactPayload {
  const authorization: Authorization = {
    from: wallet.accountHash,
    to: req.payTo,
    value: req.amount,
    // Casper can execute a transaction in a block whose timestamp precedes
    // submission time — a tight validAfter makes the contract see the
    // authorization as not-yet-valid. Backdate like the server-side signer.
    validAfter: nowSec - 600,
    validBefore: nowSec + req.maxTimeoutSeconds,
    nonce: newNonce(),
  };
  return {
    x402Version: 2,
    scheme: "exact",
    network: req.network,
    payload: {
      signature: signAuthorization(authorization, wallet),
      publicKey: wallet.publicKey,
      authorization,
    },
  };
}

// A stable result hash for receipts — proves what was delivered.
export function hashResult(result: unknown): string {
  return createHash("sha256").update(canonical(result)).digest("hex");
}

export function pseudoDeployHash(payload: ExactPayload, settledAtMs: number): string {
  return createHash("sha256")
    .update(canonical(payload.payload.authorization) + ":" + settledAtMs)
    .digest("hex");
}
