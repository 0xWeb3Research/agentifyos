/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  /*
   * Server-only SDKs, kept out of the bundler entirely.
   *
   * Beyond the WASM (which a browser build cannot take), these packages
   * identify their own types with module-local `Symbol()` values. Bundling one
   * of them while another is required from node_modules produces two module
   * instances with two different symbols, and a value built by one becomes
   * unreadable to the other: `compiledContract[TypeId]` comes back undefined
   * and the contract fails to construct. Every package in the Midnight object
   * graph therefore has to be external together, not just the ones with WASM.
   */
  serverExternalPackages: [
    "casper-js-sdk",
    "@make-software/casper-x402",
    "@nightpass/contract",
    "@midnight-ntwrk/compact-js",
    "@midnight-ntwrk/compact-runtime",
    "@midnight-ntwrk/ledger-v8",
    "@midnight-ntwrk/midnight-js",
    "@midnight-ntwrk/midnight-js-contracts",
    "@midnight-ntwrk/midnight-js-protocol",
    "@midnight-ntwrk/midnight-js-types",
    "@midnight-ntwrk/midnight-js-utils",
    "@midnight-ntwrk/midnight-js-network-id",
    "@midnight-ntwrk/midnight-js-http-client-proof-provider",
    "@midnight-ntwrk/midnight-js-indexer-public-data-provider",
    "@midnight-ntwrk/midnight-js-node-zk-config-provider",
    "@midnight-ntwrk/onchain-runtime-v3",
    "@midnight-ntwrk/platform-js",
    "@midnight-ntwrk/wallet-sdk-address-format",
    "@midnight-ntwrk/wallet-sdk-dust-wallet",
    "@midnight-ntwrk/wallet-sdk-facade",
    "@midnight-ntwrk/wallet-sdk-hd",
    "@midnight-ntwrk/wallet-sdk-shielded",
    "@midnight-ntwrk/wallet-sdk-unshielded-wallet",
  ],
};

export default nextConfig;
