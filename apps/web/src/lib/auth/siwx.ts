// Sign-In With Casper — wallet-based auth, no passwords and no accounts.
//
// You prove you control a Casper account by signing a one-time challenge. The
// account you sign with becomes your publisher identity AND your payout address,
// so you can only ever publish tools that pay you.
//
// The signing preimage is `"Casper Message:\n" + message`. That prefix is used
// identically by casper-js-sdk, the Casper Wallet extension, the MetaMask snap
// and Ledger firmware (which hard-rejects payloads without it).
//
// Verification note: casper-js-sdk v5's `verifySignature` branches on curve
// internally — secp256k1 applies sha256 itself. Pass the UNHASHED preimage for
// both curves; hashing it here would double-hash and silently fail.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import * as CasperNS from "casper-js-sdk";

const C: any = (CasperNS as any).default ?? CasperNS;
const { PublicKey } = C;

export const CASPER_MESSAGE_PREFIX = "Casper Message:\n";
const CHALLENGE_TTL_MS = 5 * 60_000;
const SESSION_TTL_MS = 7 * 24 * 60 * 60_000;
export const SESSION_COOKIE = "agentifyos_session";

// Session tokens are HMAC'd with this. A deployment that fell back to the
// development default would let anyone who knows the string forge a session for
// any wallet, so refuse to run rather than silently accept it in production.
const secret = () => {
  const s = process.env.AUTH_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "AUTH_SECRET is not set. Refusing to sign sessions with the development default.",
    );
  }
  return "dev-only-insecure-secret-set-AUTH_SECRET-in-production";
};

// ── challenges ──────────────────────────────────────────────────────────────
// Single-use and short-lived. Kept in-process: a challenge is only valid for a
// few minutes, so surviving a restart doesn't matter.
const g = globalThis as unknown as { __siwxNonces?: Map<string, number> };
const issued: Map<string, number> = (g.__siwxNonces ??= new Map());

function sweep() {
  const now = Date.now();
  for (const [nonce, exp] of issued) if (exp < now) issued.delete(nonce);
}

export interface Challenge {
  message: string;
  nonce: string;
  expiresAt: string;
}

export function createChallenge(opts: {
  domain: string;
  uri: string;
  accountHash?: string;
  chainId?: string;
}): Challenge {
  sweep();
  const nonce = randomBytes(16).toString("hex");
  const now = new Date();
  const exp = new Date(now.getTime() + CHALLENGE_TTL_MS);
  issued.set(nonce, exp.getTime());

  const message = [
    `${opts.domain} wants you to sign in with your Casper account:`,
    opts.accountHash ?? "(your account)",
    "",
    "Signing proves you control this account. It publishes nothing, moves no funds,",
    "and costs no gas. Payments for tools you publish will be sent to this account.",
    "",
    `URI: ${opts.uri}`,
    `Version: 1`,
    `Chain ID: ${opts.chainId ?? "casper:casper-test"}`,
    `Nonce: ${nonce}`,
    `Issued At: ${now.toISOString()}`,
    `Expiration Time: ${exp.toISOString()}`,
  ].join("\n");

  return { message, nonce, expiresAt: exp.toISOString() };
}

/** Burn a nonce. Returns false if unknown, already used, or expired. */
export function consumeNonce(nonce: string): boolean {
  sweep();
  const exp = issued.get(nonce);
  if (exp === undefined || exp < Date.now()) return false;
  issued.delete(nonce);
  return true;
}

// ── signature verification ──────────────────────────────────────────────────
export interface VerifyOutcome {
  ok: boolean;
  accountHash?: string;
  address?: string;
  reason?: string;
}

/**
 * Verify a wallet signature over a challenge message.
 * `signatureHex` should carry the 1-byte algorithm tag (65 bytes for Ed25519);
 * we tolerate a bare 64-byte signature by re-adding the tag from the public key.
 */
export function verifySignedMessage(
  publicKeyHex: string,
  message: string,
  signatureHex: string,
): VerifyOutcome {
  let pub: any;
  try {
    pub = PublicKey.fromHex(publicKeyHex);
  } catch {
    return { ok: false, reason: "bad_public_key" };
  }

  const preimage = Buffer.from(CASPER_MESSAGE_PREFIX + message, "utf8");
  let sig = Buffer.from(signatureHex.replace(/^0x/, ""), "hex");
  // Re-attach the algorithm tag if the wallet returned a bare signature.
  if (sig.length === 64) {
    sig = Buffer.concat([Buffer.from([publicKeyHex.startsWith("02") ? 0x02 : 0x01]), sig]);
  }

  try {
    // v5 returns true or THROWS — it never returns false.
    if (pub.verifySignature(preimage, sig) !== true) {
      return { ok: false, reason: "invalid_signature" };
    }
  } catch {
    return { ok: false, reason: "invalid_signature" };
  }

  const accountHash = pub.accountHash().toHex();
  return { ok: true, accountHash, address: "00" + accountHash };
}

/** Pull the nonce back out of a signed message so it can be burned. */
export function nonceOf(message: string): string | null {
  return message.match(/^Nonce: ([0-9a-f]+)$/m)?.[1] ?? null;
}

// ── sessions ────────────────────────────────────────────────────────────────
export interface Session {
  publicKey: string;
  accountHash: string;
  address: string;
  exp: number;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function issueSession(s: Omit<Session, "exp">): string {
  const session: Session = { ...s, exp: Date.now() + SESSION_TTL_MS };
  const body = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function readSession(token: string | undefined): Session | null {
  if (!token) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const expected = sign(body);
  // Constant-time compare, guarding the length mismatch that would throw.
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const s = JSON.parse(Buffer.from(body, "base64url").toString()) as Session;
    return s.exp > Date.now() ? s : null;
  } catch {
    return null;
  }
}

export const SESSION_MAX_AGE = Math.floor(SESSION_TTL_MS / 1000);
