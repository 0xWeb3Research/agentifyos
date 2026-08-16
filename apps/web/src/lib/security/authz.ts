import { ALLOW_UNAUTH_SPEND, MODE } from "../config";
import { readSession, SESSION_COOKIE, type Session } from "../auth/siwx";
import { defaultChain as chain } from "../chain";

// Read and verify the SIWX session directly from a Request's Cookie header.
// Next's route handlers get a raw `Request`, so we parse the cookie ourselves
// rather than reaching for next/headers (which isn't available in every runtime
// context here). Returns null for a missing, malformed, forged, or expired token.
export function sessionFromRequest(req: Request): Session | null {
  const cookie = req.headers.get("cookie");
  if (!cookie) return null;
  const prefix = SESSION_COOKIE + "=";
  const raw = cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(prefix));
  if (!raw) return null;
  let value = raw.slice(prefix.length);
  try {
    value = decodeURIComponent(value);
  } catch {
    /* use the raw value if it isn't percent-encoded */
  }
  return readSession(value);
}

export interface SpendAuthResult {
  allowed: boolean;
  reason?: string;
  session: Session | null;
}

/**
 * Gate a server-initiated paid call (agent runner, MCP `call_tool`) that spends
 * from the server's own wallet keys.
 *
 * - Mock mode never settles on-chain, so it's always allowed.
 * - Real mode requires a valid SIWX session; otherwise an anonymous request
 *   would drain the funded agent/facilitator wallets. Set ALLOW_UNAUTH_SPEND=1
 *   to intentionally run an open, funded public demo.
 */
export function authorizeSpend(req: Request): SpendAuthResult {
  const session = sessionFromRequest(req);
  if (MODE !== "real") return { allowed: true, session };
  if (ALLOW_UNAUTH_SPEND) return { allowed: true, session };
  if (session) return { allowed: true, session };
  return {
    allowed: false,
    reason:
      `authentication required: signing in with a ${chain.name} wallet is required to spend from the server wallet in real mode`,
    session: null,
  };
}
