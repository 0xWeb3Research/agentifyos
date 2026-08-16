// Runtime configuration. The app defaults to mock mode with zero infra.
import { DEFAULT_CHAIN, type ChainId } from "./chain";

export type Mode = "mock" | "real";

// Which chain settles, plus its constants and explorer links. Re-exported here
// because config is what the rest of the app already imports.
// Deliberately NOT re-exported: `chain` and `CHAIN`. A module-level chain is
// wrong for anything that renders per request, and re-exporting one made it
// too easy to reach for. Use `getChain()` on the server, `useChain()` in the
// browser, or `defaultChain` where there is genuinely no request.
export { ALGO, CSPR, CSPR_PRICE_USD, CHAIN_META, DEFAULT_CHAIN, defaultChain, chainMeta } from "./chain";
export {
  explorerAccount,
  explorerAsset,
  explorerContractPackage,
  explorerTx,
  facilitatorReceipt,
  fromAtomic,
  toAtomic,
} from "./chain";
export type { ChainId, ChainMeta } from "./chain";

// Unset/empty defaults to mock (zero-config local dev). A *set* value that is
// neither "real" nor "mock" (e.g. "Real", "production", "prod") is almost
// certainly a misconfiguration: silently collapsing it to mock would settle
// nothing on-chain while the operator believes real payments are flowing. Fail
// closed on that case rather than guess. Unset stays permitted so `next build`
// with no env still works.
const RAW_MODE = process.env.MODE;
if (RAW_MODE !== undefined && RAW_MODE !== "" && RAW_MODE !== "real" && RAW_MODE !== "mock") {
  throw new Error(`MODE="${RAW_MODE}" is invalid; set MODE=real or MODE=mock`);
}
export const MODE: Mode = RAW_MODE === "real" ? "real" : "mock";
export const USE_DB = process.env.USE_DB === "1";

// ── spend safety ─────────────────────────────────────────────────────────────
// Server-side hard cap on how much a single server-initiated agent run or MCP
// `call_tool` may spend, no matter what budget the client asks for. A client
// budget can only ever lower this, never raise it, so an unauthenticated caller
// can't drain the funded wallet by passing a huge (or omitted) budget.
export const AGENT_MAX_SPEND_USD = (() => {
  const n = Number(process.env.AGENT_MAX_SPEND_USD);
  return Number.isFinite(n) && n > 0 ? n : 0.1;
})();

// Whether unauthenticated callers may trigger spending from the server's OWN
// wallet (the agent runner and MCP `call_tool`). Off by default: in real mode an
// anonymous POST would otherwise sign and settle real payments with the server's
// funded key. Set ALLOW_UNAUTH_SPEND=1 only for a public, funded demo whose cost
// you accept. In mock mode nothing settles on-chain, so this only gates real mode.
export const ALLOW_UNAUTH_SPEND = process.env.ALLOW_UNAUTH_SPEND === "1";

// Apify-style 80/20 creator/platform split.
export const PLATFORM_FEE = 0.2;

// ── the demo accounts ────────────────────────────────────────────────────────
// Public identifiers only; secrets (Algorand mnemonics, Casper PEMs) never land
// here. Read from env so a deployed instance advertises its own accounts rather
// than whatever happened to be baked in at build time.
export type RoleKey = "facilitator" | "treasury" | "agent";

export interface RoleAccount {
  role: RoleKey;
  title: string;
  blurb: string;
  /** The chain-native address, and what the explorer link points at. */
  address: string;
  /** Casper only: the "01"-prefixed Ed25519 public key. */
  publicKey?: string;
  /** Casper only: the bare account hash. */
  accountHash?: string;
}

// GoPlausible's fee-sponsoring account on Algorand, as advertised by
// GET https://facilitator.goplausible.xyz/supported → kinds[].extra.feePayer.
// Every settlement of ours is grouped with a fee transaction from this address,
// which is exactly why our agent pays no network fee.
export const ALGO_FACILITATOR_ADDRESS =
  process.env.NEXT_PUBLIC_ALGO_FACILITATOR_ADDRESS ||
  "ZMFK2OI7ZBD2U27ISERZC4S6LKM6WMFJPZQ4MYNJDZ2VNBNMBA67RA22AA";

export const ALGO_TREASURY_ADDRESS =
  process.env.NEXT_PUBLIC_ALGO_TREASURY_ADDRESS || process.env.ALGO_TREASURY_ADDRESS || "";

export const ALGO_AGENT_ADDRESS =
  process.env.NEXT_PUBLIC_ALGO_AGENT_ADDRESS || process.env.ALGO_AGENT_ADDRESS || "";

const ALGORAND_ROLE_ACCOUNTS: RoleAccount[] = [
  {
    role: "facilitator",
    title: "Facilitator",
    blurb: "GoPlausible, hosted. Submits every settlement and sponsors the network fee.",
    address: ALGO_FACILITATOR_ADDRESS,
  },
  {
    role: "treasury",
    title: "Treasury",
    blurb: "Receives every payment and funds agents with USDC. Opted into ASA 10458941.",
    address: ALGO_TREASURY_ADDRESS,
  },
  {
    role: "agent",
    title: "Agent",
    blurb:
      "The buyer. Signs the USDC transfer and spends no ALGO: its only ALGO is " +
      "the locked minimum balance, which never moves.",
    address: ALGO_AGENT_ADDRESS,
  },
];

// On Casper the explorer keys accounts by public key, so that doubles as the
// display address.
function casperRole(
  role: RoleKey,
  title: string,
  blurb: string,
  publicKey: string,
  accountHash: string,
): RoleAccount {
  return { role, title, blurb, address: publicKey, publicKey, accountHash };
}

const CASPER_ROLE_ACCOUNTS: RoleAccount[] = [
  casperRole(
    "facilitator",
    "Facilitator",
    "Submits every settlement on-chain and pays the gas.",
    process.env.FACILITATOR_PUBLIC_KEY ||
      "01e3d2d1883d8c63bb4b6e0df05ea9c2f42c6a483c704cfcd8a727e2e4373252ae",
    process.env.FACILITATOR_ACCOUNT_HASH ||
      "e0c57785b93365efc81063aabdcec6056d6f1523da33acdb5c2001620aad8796",
  ),
  casperRole(
    "treasury",
    "Treasury",
    "Wraps CSPR into WCSPR, then funds agents with it.",
    process.env.TREASURY_PUBLIC_KEY ||
      "014ea619c544f11f034674ccccb44c8758c354f674af2bf3138514a501539706ab",
    process.env.TREASURY_ACCOUNT_HASH ||
      "4ee08c54de78389c1466980260051c44f6dc367391ae37dc3f473896dbbeb666",
  ),
  casperRole(
    "agent",
    "Agent",
    "The buyer. Signs x402 payments and holds zero CSPR.",
    process.env.AGENT_PUBLIC_KEY ||
      "01e565e859f9bab3f7cb1eb666ffa7aa12879e27639f7c000a079e859edbbfde0c",
    process.env.AGENT_ACCOUNT_HASH ||
      "41611f2c0902ede544b2a61e557b47b5ca5b313a03bbaa45765eb80075ca9e1e",
  ),
];

/** The demo accounts for a given chain. The address book renders these. */
export function roleAccounts(on: ChainId): RoleAccount[] {
  return on === "casper" ? CASPER_ROLE_ACCOUNTS : ALGORAND_ROLE_ACCOUNTS;
}

/** @deprecated Prefer `roleAccounts(await getChainId())`, which follows the switcher. */
export const ROLE_ACCOUNTS: RoleAccount[] = roleAccounts(DEFAULT_CHAIN);

/**
 * Where a listing's payments land.
 *
 * On Casper each seeded publisher has its own derived account hash, and nothing
 * has to exist on-chain for the demo to read. On Algorand a receiving account
 * must be real and opted into the USDC ASA before it can be paid at all, so
 * every listing settles into the one treasury account we actually maintain.
 * Per-seller payout accounts are a mainnet concern, and docs/ALGORAND.md says so.
 */
export function resolvePayTo(publisherPayTo: string, on: ChainId = DEFAULT_CHAIN): string {
  return on === "casper" ? publisherPayTo : ALGO_TREASURY_ADDRESS;
}

/** True when the given chain has everything it needs to settle for real. */
export function realModeReady(on: ChainId = DEFAULT_CHAIN): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  if (on === "algorand") {
    if (!ALGO_TREASURY_ADDRESS) missing.push("ALGO_TREASURY_ADDRESS");
    if (!process.env.ALGO_AGENT_MNEMONIC) missing.push("ALGO_AGENT_MNEMONIC");
  }
  return { ok: missing.length === 0, missing };
}
