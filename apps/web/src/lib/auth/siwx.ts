// Sign-In With Casper: wallet-based auth, no passwords and no accounts.
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
// internally: secp256k1 applies sha256 itself. Pass the UNHASHED preimage for
// both curves; hashing it here would double-hash and silently fail.
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import * as CasperNS from "casper-js-sdk";
import { MODE } from "../config";
import { SITE_URL } from "../site";

const C: any = (CasperNS as any).default ?? CasperNS;
const { PublicKey } = C;

export const CASPER_MESSAGE_PREFIX = "Casper Message:\n";
const CHALLENGE_TTL_MS = 5 * 60_000;
const SESSION_TTL_MS = 7 * 24 * 60 * 60_000;
export const SESSION_COOKIE = "agentifyos_session";

// Session tokens are HMAC'd with this. A deployment that fell back to the
// development default would let anyone who knows the string forge a session for
// any wallet, so refuse to run rather than silently accept it in production.
// NODE_ENV is an operational hint, not a security boundary: a container
// started without it would fail open, so also refuse in real mode, where a
// forgeable session gates spending from the funded wallets.
const secret = () => {
  const s = process.env.AUTH_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production" || MODE === "real") {
    throw new Error(
      "AUTH_SECRET is not set. Refusing to sign sessions with the development default.",
    );
  }
  return "dev-only-insecure-secret-set-AUTH_SECRET-in-production";
};

// ── origin binding ──────────────────────────────────────────────────────────
// The domain in the SIWX message is the whole point of the scheme: it binds a
// signature to this site. Minting (challenge) and checking (verify) must both
// derive it from the SAME server-trusted place, never from X-Forwarded-Host,
// which any client can set, turning the challenge endpoint into a signing
// oracle for arbitrary domains. Only genuine `next dev`, or a deployment with
// no origin configured at all (SITE_URL still the hardcoded default), falls
// back to the request's host so localhost sign-in keeps working.
export function authOrigin(req: Request): { host: string; origin: string } {
  const configured = Boolean(
    process.env.NEXT_PUBLIC_SITE_URL || process.env.RAILWAY_PUBLIC_DOMAIN,
  );
  if (configured && process.env.NODE_ENV !== "development") {
    const u = new URL(SITE_URL);
    return { host: u.host, origin: u.origin };
  }
  const url = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? url.host;
  const proto = req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  return { host, origin: `${proto}://${host}` };
}

// ── challenges ──────────────────────────────────────────────────────────────
// Single-use and short-lived. Kept in-process: a challenge is only valid for a
// few minutes, so surviving a restart doesn't matter. Each nonce keeps a hash
// of the exact message we composed so verify can insist the wallet signed OUR
// challenge, not a recomposed body that merely embeds a valid nonce.
interface IssuedChallenge {
  exp: number;
  messageHash: string;
}
const g = globalThis as unknown as { __siwxChallenges?: Map<string, IssuedChallenge> };
const issued: Map<string, IssuedChallenge> = (g.__siwxChallenges ??= new Map());

// Minting is unauthenticated, so the map needs a hard cap on top of expiry
// sweeping or it becomes a memory-exhaustion lever. All entries share one TTL,
// so insertion order is expiry order and evicting from the front drops oldest.
const MAX_ISSUED = 10_000;

function sweep() {
  const now = Date.now();
  for (const [nonce, c] of issued) if (c.exp < now) issued.delete(nonce);
}

const hashMessage = (message: string) =>
  createHash("sha256").update(message, "utf8").digest("hex");

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
  for (const oldest of issued.keys()) {
    if (issued.size < MAX_ISSUED) break;
    issued.delete(oldest);
  }
  const nonce = randomBytes(16).toString("hex");
  const now = new Date();
  const exp = new Date(now.getTime() + CHALLENGE_TTL_MS);

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

  issued.set(nonce, { exp: exp.getTime(), messageHash: hashMessage(message) });
  return { message, nonce, expiresAt: exp.toISOString() };
}

/**
 * Burn a nonce. Returns false if unknown, already used, or expired, and also
 * when `message` is given and it isn't byte-for-byte the challenge issued
 * under that nonce (the real challenge stays live in that case).
 */
export function consumeNonce(nonce: string, message?: string): boolean {
  sweep();
  const c = issued.get(nonce);
  if (c === undefined || c.exp < Date.now()) return false;
  if (message !== undefined && hashMessage(message) !== c.messageHash) return false;
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
    // v5 returns true or THROWS; it never returns false.
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
  iat: number;
  exp: number;
}

// Sessions are stateless HMAC tokens, so deleting the cookie alone would leave
// any copied token valid until `exp`. Sign-out therefore records a per-account
// epoch, and readSession refuses tokens issued before it. In-process like the
// challenge store: a restart forgets epochs (an old token works again until it
// expires). Move this next to the ledger's Redis if that trade-off stops
// being acceptable.
const r = globalThis as unknown as { __siwxRevokedAt?: Map<string, number> };
const revokedAt: Map<string, number> = (r.__siwxRevokedAt ??= new Map());

/** Invalidate every session issued for this account before now. */
export function revokeSessions(accountHash: string): void {
  revokedAt.set(accountHash, Date.now());
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function issueSession(s: Omit<Session, "iat" | "exp">): string {
  const now = Date.now();
  const session: Session = { ...s, iat: now, exp: now + SESSION_TTL_MS };
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
    if (s.exp <= Date.now()) return null;
    // Signed out since this token was issued? `<=` so a token minted in the
    // same millisecond as the sign-out dies too; tokens minted before `iat`
    // existed carry none and count as 0, so they fail closed as well.
    const cutoff = revokedAt.get(s.accountHash);
    if (cutoff !== undefined && (s.iat ?? 0) <= cutoff) return null;
    return s;
  } catch {
    return null;
  }
}

export const SESSION_MAX_AGE = Math.floor(SESSION_TTL_MS / 1000);
