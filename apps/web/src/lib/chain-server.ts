// Resolving the active chain on the server, per request.
//
// A visitor picks a chain from the nav; the switcher writes a cookie and the
// server reads it here. Everything that renders or settles inside a request goes
// through `getChainId()`, so a switch changes the whole app at once: the prices
// quoted, the explorer links, the address book, the discovery feed, and which
// signer actually moves the money.
//
// Server-only: `cookies()` is unavailable in the browser, and reading it opts
// the caller into dynamic rendering, which is correct for anything that has to
// reflect a per-visitor choice.
import { cookies } from "next/headers";
import {
  DEFAULT_CHAIN,
  chainMeta,
  parseChainId,
  parseNetworkId,
  type ChainId,
  type ChainMeta,
  type NetworkId,
} from "./chain";

export const CHAIN_COOKIE = "agentifyos-chain";

/**
 * The chain this request should use.
 *
 * The cookie is visitor-supplied, so it is narrowed to a known id rather than
 * trusted: an unrecognised value falls back to the deployment default instead of
 * propagating a bogus network id into a payment quote.
 */
export async function getChainId(): Promise<ChainId> {
  try {
    const store = await cookies();
    return parseChainId(store.get(CHAIN_COOKIE)?.value) ?? DEFAULT_CHAIN;
  } catch {
    // Called from a context with no request (a static shell, a build-time
    // metadata pass). The deployment default is the only honest answer.
    return DEFAULT_CHAIN;
  }
}

export async function getChain(): Promise<ChainMeta> {
  return chainMeta(await getChainId());
}

/**
 * Which network the visitor has selected, which may be Midnight.
 *
 * `getChainId()` above deliberately does not widen: a Midnight selection still
 * resolves to a real settlement chain there, so no pricing or signing path ever
 * receives a network it cannot settle on. This is only for what the site shows.
 */
export async function getNetworkId(): Promise<NetworkId> {
  try {
    const store = await cookies();
    return parseNetworkId(store.get(CHAIN_COOKIE)?.value) ?? DEFAULT_CHAIN;
  } catch {
    return DEFAULT_CHAIN;
  }
}

/**
 * Whether the Nightpass contract is actually deployed on Midnight.
 *
 * Read from the same deployment record the CLI writes, so the switcher tells the
 * truth about a checkout that has never deployed rather than offering a network
 * with nothing behind it.
 */
export function midnightReady(): boolean {
  if (process.env.NIGHTPASS_CONTRACT?.trim()) return true;
  try {
    // Required lazily: this module is imported by client-adjacent code paths.
    const { existsSync, readFileSync } = require("node:fs") as typeof import("node:fs");
    const path = require("node:path") as typeof import("node:path");
    const file = path.resolve(process.cwd(), "..", "..", "midnight", "deployment.json");
    if (!existsSync(file)) return false;
    const all = JSON.parse(readFileSync(file, "utf8")) as Record<string, { contractAddress?: string }>;
    return Boolean(all.preview?.contractAddress || all.preprod?.contractAddress);
  } catch {
    return false;
  }
}

/**
 * Which chains this deployment can actually settle on.
 *
 * A chain with no keys can still be browsed, and every page will describe it
 * correctly, but a payment would fail at the first signature. The switcher shows
 * that up front rather than letting a reader discover it by being charged
 * nothing and getting an error.
 */
export function chainReadiness(): Record<NetworkId, boolean> {
  const algorandKeys = !!process.env.ALGO_AGENT_MNEMONIC?.trim();
  const algorandPayee = !!(
    process.env.ALGO_TREASURY_ADDRESS || process.env.NEXT_PUBLIC_ALGO_TREASURY_ADDRESS
  )?.trim();
  return {
    algorand: algorandKeys && algorandPayee,
    // Casper keys are PEM files on disk or inline in the environment. Checking
    // the environment is cheap and covers a hosted deploy; a local checkout with
    // keys/ present but nothing in the environment reports false, which
    // understates rather than overstates what will work.
    casper: !!(
      process.env.FACILITATOR_KEY_PEM_CONTENT ||
      process.env.AGENT_KEY_PEM_CONTENT ||
      process.env.AGENT_KEY_PEM ||
      process.env.AGENT_PUBLIC_KEY
    )?.trim(),
    // Midnight needs no keys here: the site only ever reads public state, and
    // proving happens on the agent's own machine. "Ready" means deployed.
    midnight: midnightReady(),
  };
}
