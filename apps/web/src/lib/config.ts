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
