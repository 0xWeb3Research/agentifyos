// Which chain settles payments, and everything that follows from that choice.
//
// AgentifyOS speaks x402 over two settlement layers. Algorand is the default:
// payments are USDC (ASA 10458941) moved by the GoPlausible facilitator, which
// also sponsors the transaction fee, so a buying agent needs no ALGO at all.
// Casper is the original implementation and stays selectable with CHAIN=casper.
//
// This module is client-safe: no node built-ins, no SDK imports. The chain id is
// read from NEXT_PUBLIC_CHAIN so a browser bundle renders the same chain the
// server settles on.

export type ChainId = "algorand" | "casper";

export const CHAIN_IDS = ["algorand", "casper"] as const;

/** Narrow an untrusted string (a cookie, a query param) to a chain id. */
export function parseChainId(value: unknown): ChainId | null {
  return value === "algorand" || value === "casper" ? value : null;
}

const RAW_CHAIN = process.env.NEXT_PUBLIC_CHAIN ?? process.env.CHAIN;
if (RAW_CHAIN !== undefined && RAW_CHAIN !== "" && !parseChainId(RAW_CHAIN)) {
  throw new Error(`CHAIN="${RAW_CHAIN}" is invalid; set CHAIN=algorand or CHAIN=casper`);
}

/**
 * The chain this deployment settles on unless a visitor picks another.
 *
 * A reader can switch chains from the nav, which sets a cookie; the server
 * resolves that per request via `getChainId()` in chain-server.ts, and client
 * components read it from `useChain()`. This constant is the fallback, and the
 * right answer in the few places that genuinely cannot see a request: build-time
 * metadata, the web manifest, and the static OG images.
 */
export const DEFAULT_CHAIN: ChainId = RAW_CHAIN === "casper" ? "casper" : "algorand";


// ── Algorand testnet (default) ───────────────────────────────────────────────
// The CAIP-2 id is `algorand:<base64 genesis hash>`, the same constant
// ALGORAND_TESTNET_CAIP2 exports from @x402-avm/avm. It is duplicated here as a
// literal because this module must stay importable from client components,
// which cannot pull in the AVM SDK. scripts/algorand/preflight.ts asserts the
// two agree, so a version bump that changed it would fail loudly.
export const ALGO = {
  // Typed as the CAIP-2 template the SDK's `Network` expects, so it can be
  // passed straight through without a cast at every call site.
  network: (process.env.NEXT_PUBLIC_ALGO_NETWORK ||
    "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=") as `${string}:${string}`,
  chainName: "testnet",
  algod: process.env.ALGOD_TESTNET_URL || "https://testnet-api.algonode.cloud",
  indexer: process.env.ALGOD_TESTNET_INDEXER || "https://testnet-idx.algonode.cloud",
  explorerBase: "https://lora.algokit.io/testnet",
  /** Hosted x402 facilitator. It verifies, settles, and pays the network fee. */
  facilitatorUrl: process.env.X402_FACILITATOR_URL || "https://facilitator.goplausible.xyz",
  /** USDC on Algorand testnet. 6 decimals, so $0.005 is 5000 atomic units. */
  assetId: process.env.ALGO_USDC_ASSET_ID || "10458941",
  asset: { name: "USD Coin", symbol: "USDC", version: "1", decimals: "6" },
  faucet: "https://lora.algokit.io/testnet/fund",
  usdcFaucet: "https://faucet.circle.com",
} as const;

// ── Casper testnet (CHAIN=casper) ────────────────────────────────────────────
export const CSPR = {
  network: (process.env.CSPR_NETWORK || "casper:casper-test") as `${string}:${string}`,
  chainName: "casper-test",
  rpc: process.env.CSPR_NODE_RPC || "https://node.testnet.casper.network/rpc",
  explorerBase: "https://testnet.cspr.live",
  wcsprPackageHash:
    process.env.WCSPR_PACKAGE_HASH ||
    "3d80df21ba4ee4d66a2a1f60c32570dd5685e4b279f6538162a5fd1314847c1e",
  asset: { name: "Wrapped CSPR", symbol: "WCSPR", version: "1", decimals: "9" },
  faucet: "https://testnet.cspr.live/tools/faucet",
} as const;

// Illustrative CSPR price, used only to map USD prices onto WCSPR atomic units.
// Algorand needs no such table: USDC is already denominated in dollars.
export const CSPR_PRICE_USD = 0.0231;

// ── display metadata ─────────────────────────────────────────────────────────

export interface ChainMeta {
  id: ChainId;
  /** "Algorand" */
  name: string;
  /** "Algorand testnet" */
  networkLabel: string;
  /** CAIP-2 network id carried in every PaymentRequirements. */
  caip2: string;
  /** "USDC" */
  symbol: string;
  assetName: string;
  decimals: number;
  /** The on-chain id of the settlement asset: an ASA id or a package hash. */
  assetRef: string;
  /** "Lora" */
  explorerName: string;
  explorerBase: string;
  faucet: string;
  /** What the receipt's transaction identifier is called on this chain. */
  txLabel: string;
  /** Who pays the network fee. */
  feePayer: string;
}

export const CHAIN_META: Record<ChainId, ChainMeta> = {
  algorand: {
    id: "algorand",
    name: "Algorand",
    networkLabel: "Algorand testnet",
    caip2: ALGO.network,
    symbol: ALGO.asset.symbol,
    assetName: ALGO.asset.name,
    decimals: Number(ALGO.asset.decimals),
    assetRef: ALGO.assetId,
    explorerName: "Lora",
    explorerBase: ALGO.explorerBase,
    faucet: ALGO.faucet,
    txLabel: "transaction id",
    feePayer: "the GoPlausible facilitator sponsors the fee",
  },
  casper: {
    id: "casper",
    name: "Casper",
    networkLabel: "Casper testnet",
    caip2: CSPR.network,
    symbol: CSPR.asset.symbol,
    assetName: CSPR.asset.name,
    decimals: Number(CSPR.asset.decimals),
    assetRef: CSPR.wcsprPackageHash,
    explorerName: "cspr.live",
    explorerBase: CSPR.explorerBase,
    faucet: CSPR.faucet,
    txLabel: "deploy hash",
    feePayer: "our facilitator key pays the gas",
  },
};

export function chainMeta(id: ChainId): ChainMeta {
  return CHAIN_META[id];
}

/**
 * The deployment default's metadata. Only for contexts with no request to read
 * a preference from: page metadata, the manifest, OG images. Everything that
 * renders per request should resolve the chain instead.
 */
export const defaultChain: ChainMeta = CHAIN_META[DEFAULT_CHAIN];


// ── explorer links ───────────────────────────────────────────────────────────
// Lora is AlgoKit's explorer and the one the judges are asked to check, so an
// Algorand receipt always resolves to lora.algokit.io/testnet.

export function explorerTx(txId: string, on: ChainId = DEFAULT_CHAIN): string {
  return on === "casper"
    ? `${CSPR.explorerBase}/deploy/${txId}`
    : `${ALGO.explorerBase}/transaction/${txId}`;
}

export function explorerAccount(address: string, on: ChainId = DEFAULT_CHAIN): string {
  return on === "casper"
    ? `${CSPR.explorerBase}/account/${address}`
    : `${ALGO.explorerBase}/account/${address}`;
}

/**
 * The settlement asset itself: an ASA page on Lora, a contract package on
 * cspr.live. Omit `ref` for whichever asset the given chain settles in; a
 * default tied to one chain's asset would produce a broken link on the other.
 */
export function explorerAsset(ref?: string, on: ChainId = DEFAULT_CHAIN): string {
  const id = ref ?? CHAIN_META[on].assetRef;
  return on === "casper"
    ? `${CSPR.explorerBase}/contract-package/${id}`
    : `${ALGO.explorerBase}/asset/${id}`;
}

/** Casper-only, kept for the pages that still document the CEP-18 package. */
export function explorerContractPackage(packageHash: string): string {
  return `${CSPR.explorerBase}/contract-package/${packageHash}`;
}

/**
 * The facilitator's own receipt for a settled payment.
 *
 * Independent of us: GoPlausible serves it from their records, so a reader can
 * confirm the payment without taking our word or our database for it.
 */
export function facilitatorReceipt(txId: string, on: ChainId = DEFAULT_CHAIN): string | null {
  return on === "algorand" ? `${ALGO.facilitatorUrl}/api/receipt/${txId}` : null;
}

// ── money ────────────────────────────────────────────────────────────────────

/**
 * USD price → atomic units of the active chain's settlement asset.
 *
 * On Algorand this is exact: USDC is a dollar with 6 decimals, so $0.005 is
 * 5000 and nothing is estimated. On Casper it goes through an illustrative CSPR
 * price, which is why the Casper receipts were only ever approximately priced.
 */
export function toAtomic(amountUsd: number, on: ChainId = DEFAULT_CHAIN): string {
  if (on === "casper") {
    const decimals = Number(CSPR.asset.decimals);
    return BigInt(Math.round((amountUsd / CSPR_PRICE_USD) * 10 ** decimals)).toString();
  }
  return BigInt(Math.round(amountUsd * 10 ** Number(ALGO.asset.decimals))).toString();
}

/** Atomic units → USD, the inverse of toAtomic. Used to price-check a 402. */
export function fromAtomic(atomic: string | number | bigint, on: ChainId = DEFAULT_CHAIN): number {
  const n = Number(atomic);
  if (on === "casper") return (n / 10 ** Number(CSPR.asset.decimals)) * CSPR_PRICE_USD;
  return n / 10 ** Number(ALGO.asset.decimals);
}
