/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Casper/x402 and Midnight SDKs are server-only; never bundle them into the
  // client. The Midnight packages carry WASM that breaks a browser build.
  serverExternalPackages: [
    "casper-js-sdk",
    "@make-software/casper-x402",
    "@nightpass/contract",
    "@midnight-ntwrk/midnight-js",
    "@midnight-ntwrk/midnight-js-protocol",
    "@midnight-ntwrk/compact-runtime",
  ],
};

export default nextConfig;
