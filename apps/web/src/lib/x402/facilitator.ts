import { MODE } from "../config";
import {
  canonical,
  pseudoDeployHash,
  verifySignature,
  type ExactPayload,
  type PaymentRequirements,
} from "./payment";

export interface VerifyResult {
  isValid: boolean;
  payer: string;
  invalidReason?: string;
}

export interface SettleResult {
  success: boolean;
  payer: string;
  deployHash: string;
  network: string;
  latencyMs: number;
  errorReason?: string;
}

// The seam the real Casper facilitator drops into. Mock and real implement the
// same three calls, so every caller (paid routes, MCP, agent runner) is
// mode-agnostic.
export interface FacilitatorClient {
  readonly name: string;
  supported(): { schemes: string[]; networks: string[] };
  verify(payload: ExactPayload, req: PaymentRequirements): Promise<VerifyResult>;
  settle(payload: ExactPayload, req: PaymentRequirements): Promise<SettleResult>;
}

// Replay guard: a payment nonce may settle at most once. The nonce is 32 random
// bytes, globally unique per authorization, so keying on it alone is safe.
// Keying on (nonce, resource) let an attacker replay one signature against
// `?_=1`, `?_=2`, … since the signature never committed to the resource.
// Entries carry an expiry (the authorization's own deadline) and are swept on
// each claim so the map can't grow unbounded.
const usedNonces = new Map<string, number>(); // nonce → expiry (epoch ms)
function claimKey(payload: ExactPayload): string {
  return payload.payload.authorization.nonce;
}
function sweepNonces(now: number): void {
  for (const [k, exp] of usedNonces) if (exp <= now) usedNonces.delete(k);
}

export class MockFacilitator implements FacilitatorClient {
  readonly name = "mock:in-process";

  supported() {
    return {
      schemes: ["exact"],
      networks: [process.env.CSPR_NETWORK || "casper:casper-test"],
    };
  }

  // All checks except nonce freshness, shared by verify() and settle(), which
  // must claim the nonce itself (see settle).
  private checks(payload: ExactPayload, req: PaymentRequirements): VerifyResult {
    const { authorization, signature, publicKey } = payload?.payload ?? {};
    if (!authorization || typeof signature !== "string" || typeof publicKey !== "string") {
      return { isValid: false, payer: "", invalidReason: "malformed_payload" };
    }
    const payer = authorization.from;

    // 1. real Ed25519 signature check against the payer's public key. Passing
    //    `req` binds the check to this deployment's EIP-712 domain (network,
    //    asset, name, version), so a signature minted for another network or a
    //    different asset can't be replayed here.
    if (!verifySignature(authorization, signature, publicKey, req)) {
      return { isValid: false, payer, invalidReason: "invalid_signature" };
    }
    // 2. the payment must actually go to the required recipient.
    if (authorization.to !== req.payTo) {
      return { isValid: false, payer, invalidReason: "recipient_mismatch" };
    }
    // 3. amount must match the requirement exactly.
    if (authorization.value !== req.amount) {
      return { isValid: false, payer, invalidReason: "amount_mismatch" };
    }
    // 4. time window must be open.
    const now = Math.floor(Date.now() / 1000);
    if (now < authorization.validAfter || now > authorization.validBefore) {
      return { isValid: false, payer, invalidReason: "authorization_expired" };
    }
    return { isValid: true, payer };
  }

  async verify(payload: ExactPayload, req: PaymentRequirements): Promise<VerifyResult> {
    const r = this.checks(payload, req);
    if (!r.isValid) return r;
    // nonce must be fresh (replay guard).
    if (usedNonces.has(claimKey(payload))) {
      return { isValid: false, payer: r.payer, invalidReason: "nonce_replayed" };
    }
    return r;
  }

  async settle(payload: ExactPayload, req: PaymentRequirements): Promise<SettleResult> {
    const started = Date.now();
    const auth = payload?.payload?.authorization;
    const payer = auth?.from ?? "";
    const fail = (reason?: string): SettleResult => ({
      success: false,
      payer,
      deployHash: "",
      network: req.network,
      latencyMs: Date.now() - started,
      errorReason: reason,
    });
    if (!auth) return fail("malformed_payload");

    // Claim the nonce FIRST via a synchronous test-and-set: no await between
    // the check and the set. Awaiting verify() before claiming left a TOCTOU
    // window where two concurrent settles both saw a fresh nonce and both
    // settled. If the remaining checks then fail, the provisional claim is
    // released.
    const key = claimKey(payload);
    sweepNonces(started);
    if (usedNonces.has(key)) return fail("nonce_replayed");
    usedNonces.set(key, auth.validBefore * 1000 || started + 600_000);

    const v = this.checks(payload, req);
    if (!v.isValid) {
      usedNonces.delete(key);
      return fail(v.invalidReason);
    }
    // Claimed and verified → "broadcast".
    // Simulate Casper block/finality time deterministically (~1.1–1.6s band).
    const jitter = canonical(auth).length % 500;
    const latencyMs = 1100 + jitter;
    return {
      success: true,
      payer,
      deployHash: pseudoDeployHash(payload, started),
      network: req.network,
      latencyMs,
    };
  }
}

class RealFacilitator implements FacilitatorClient {
  readonly name = "real:casper-self-hosted";
  supported() {
    return { schemes: ["exact"], networks: ["casper:casper-test"] };
  }
  async verify(): Promise<VerifyResult> {
    throw new Error(
      "real facilitator not wired yet. Keep MODE=mock, or implement via @make-software/casper-x402 (js/examples/facilitator)",
    );
  }
  async settle(): Promise<SettleResult> {
    throw new Error("real facilitator not wired yet");
  }
}

let _facilitator: FacilitatorClient | null = null;
export function getFacilitator(): FacilitatorClient {
  if (!_facilitator) {
    _facilitator = MODE === "real" ? new RealFacilitator() : new MockFacilitator();
  }
  return _facilitator;
}

// Test hook: clear the replay-guard between selftest cases.
export function __resetNonces(): void {
  usedNonces.clear();
}
