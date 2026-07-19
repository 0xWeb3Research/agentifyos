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

// Replay guard: a payment nonce may settle at most once per resource. Mirrors
// the arXiv 2605.11781 mitigation — bind (nonce, resource) before serving.
const usedNonces = new Set<string>();
function claimKey(payload: ExactPayload, req: PaymentRequirements): string {
  return `${payload.payload.authorization.nonce}:${req.resource}`;
}

export class MockFacilitator implements FacilitatorClient {
  readonly name = "mock:in-process";

  supported() {
    return {
      schemes: ["exact"],
      networks: [process.env.CSPR_NETWORK || "casper:casper-test"],
    };
  }

  async verify(payload: ExactPayload, req: PaymentRequirements): Promise<VerifyResult> {
    const { authorization, signature, publicKey } = payload.payload;
    const payer = authorization.from;

    // 1. real Ed25519 signature check against the payer's public key.
    if (!verifySignature(authorization, signature, publicKey)) {
      return { isValid: false, payer, invalidReason: "invalid_signature" };
    }
    // 2. amount must match the requirement exactly.
    if (authorization.value !== req.amount) {
      return { isValid: false, payer, invalidReason: "amount_mismatch" };
    }
    // 3. time window must be open.
    const now = Math.floor(Date.now() / 1000);
    if (now < authorization.validAfter || now > authorization.validBefore) {
      return { isValid: false, payer, invalidReason: "authorization_expired" };
    }
    // 4. nonce must be fresh for this resource (replay guard).
    if (usedNonces.has(claimKey(payload, req))) {
      return { isValid: false, payer, invalidReason: "nonce_replayed" };
    }
    return { isValid: true, payer };
  }

  async settle(payload: ExactPayload, req: PaymentRequirements): Promise<SettleResult> {
    const started = Date.now();
    const v = await this.verify(payload, req);
    const payer = payload.payload.authorization.from;
    if (!v.isValid) {
      return {
        success: false,
        payer,
        deployHash: "",
        network: req.network,
        latencyMs: Date.now() - started,
        errorReason: v.invalidReason,
      };
    }
    // Claim atomically, then "broadcast".
    usedNonces.add(claimKey(payload, req));
    // Simulate Casper block/finality time deterministically (~1.1–1.6s band).
    const jitter = canonical(payload.payload.authorization).length % 500;
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
      "real facilitator not wired yet — keep MODE=mock, or implement via @make-software/casper-x402 (js/examples/facilitator)",
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
