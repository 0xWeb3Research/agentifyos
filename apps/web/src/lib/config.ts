// Runtime configuration. The app defaults to mock mode with zero infra.
export type Mode = "mock" | "real";

export const MODE: Mode = process.env.MODE === "real" ? "real" : "mock";
export const USE_DB = process.env.USE_DB === "1";

// Casper testnet constants (make-software/casper-x402 reference values).
export const CSPR = {
  network: process.env.CSPR_NETWORK || "casper:casper-test",
  chainName: "casper-test",
  rpc: process.env.CSPR_NODE_RPC || "https://node.testnet.casper.network/rpc",
  explorerBase: "https://testnet.cspr.live",
  wcsprPackageHash:
    process.env.WCSPR_PACKAGE_HASH ||
    "3d80df21ba4ee4d66a2a1f60c32570dd5685e4b279f6538162a5fd1314847c1e",
  asset: { name: "Wrapped CSPR", symbol: "WCSPR", version: "1", decimals: "9" },
} as const;

// Illustrative CSPR price so USD prices map to WCSPR atomic amounts for the demo.
export const CSPR_PRICE_USD = 0.0231;

// Apify-style 80/20 creator/platform split.
export const PLATFORM_FEE = 0.2;

export function explorerTx(deployHash: string): string {
  return `${CSPR.explorerBase}/deploy/${deployHash}`;
}
export function explorerAccount(accountHash: string): string {
  return `${CSPR.explorerBase}/account/${accountHash}`;
}
export function explorerContractPackage(packageHash: string): string {
  return `${CSPR.explorerBase}/contract-package/${packageHash}`;
}

// ── the three demo accounts ──────────────────────────────────────────────────
// Public keys only — the matching PEMs stay in apps/web/keys/ and are gitignored.
// Read from env so a deployed instance advertises its own accounts rather than
// the values that happened to be baked in at build time.
export type RoleKey = "facilitator" | "treasury" | "agent";

export interface RoleAccount {
  role: RoleKey;
  title: string;
  blurb: string;
  publicKey: string;
  accountHash: string;
}

export const ROLE_ACCOUNTS: RoleAccount[] = [
  {
    role: "facilitator",
    title: "Facilitator",
    blurb: "Submits every settlement on-chain and pays the gas.",
    publicKey:
      process.env.FACILITATOR_PUBLIC_KEY ||
      "01e3d2d1883d8c63bb4b6e0df05ea9c2f42c6a483c704cfcd8a727e2e4373252ae",
    accountHash:
      process.env.FACILITATOR_ACCOUNT_HASH ||
      "e0c57785b93365efc81063aabdcec6056d6f1523da33acdb5c2001620aad8796",
  },
  {
    role: "treasury",
    title: "Treasury",
    blurb: "Wraps CSPR into WCSPR, then funds agents with it.",
    publicKey:
      process.env.TREASURY_PUBLIC_KEY ||
      "014ea619c544f11f034674ccccb44c8758c354f674af2bf3138514a501539706ab",
    accountHash:
      process.env.TREASURY_ACCOUNT_HASH ||
      "4ee08c54de78389c1466980260051c44f6dc367391ae37dc3f473896dbbeb666",
  },
  {
    role: "agent",
    title: "Agent",
    blurb: "The buyer. Signs x402 payments and holds zero CSPR.",
    publicKey:
      process.env.AGENT_PUBLIC_KEY ||
      "01e565e859f9bab3f7cb1eb666ffa7aa12879e27639f7c000a079e859edbbfde0c",
    accountHash:
      process.env.AGENT_ACCOUNT_HASH ||
      "41611f2c0902ede544b2a61e557b47b5ca5b313a03bbaa45765eb80075ca9e1e",
  },
];
