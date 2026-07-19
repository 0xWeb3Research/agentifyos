/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Casper/x402 SDKs are server-only; never bundle them into the client.
  serverExternalPackages: ["casper-js-sdk", "@make-software/casper-x402"],
};

export default nextConfig;
