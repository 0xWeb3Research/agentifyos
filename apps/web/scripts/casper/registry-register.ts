// Anchor a tool's manifest hash in the on-chain ToolRegistry.
//
//   pnpm casper:registry-register [--slug cspr-market-data] [--gas <motes>]
//
// The hash commits to exactly what the marketplace serves for that listing, so
// a later silent edit to price or payout address becomes detectable by anyone.
import { createHash } from "node:crypto";
import * as CasperNS from "casper-js-sdk";
import {
  TESTNET,
  loadRoleWallet,
  putTransactionRaw,
  waitForTransactionRaw,
} from "../../src/lib/x402/casper";
import { getToolBySlug } from "../../src/lib/data";

const C: any = (CasperNS as any).default ?? CasperNS;
const { Args, CLValue, ContractCallBuilder } = C;

const arg = (n: string, d?: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : d;
};

const PACKAGE = process.env.TOOL_REGISTRY_PACKAGE_HASH ||
  "9c1b0ac3b1f2d2db53ef4884761c3567ebecf93ff4f5623e5545903bc0720a18";

/** Hash the fields an agent actually relies on, in a fixed order. */
export function manifestHash(tool: {
  slug: string; name: string; tagline: string;
  priceEvents: { name: string; usd: number }[];
  publisher: { payTo: string };
}): string {
  const canonical = JSON.stringify({
    slug: tool.slug,
    name: tool.name,
    tagline: tool.tagline,
    payTo: tool.publisher.payTo,
    prices: tool.priceEvents.map((p) => [p.name, p.usd]).sort(),
  });
  return createHash("sha256").update(canonical).digest("hex");
}

async function main() {
  const slug = arg("slug", "cspr-market-data")!;
  const gas = arg("gas", "5000000000")!; // 5 CSPR
  const tool = getToolBySlug(slug);
  if (!tool) {
    console.log(`  ✗ no such tool: ${slug}`);
    process.exit(1);
  }

  const treasury = loadRoleWallet("treasury");
  const hash = manifestHash(tool);

  console.log("Anchor tool manifest · AgentifyOS ToolRegistry\n");
  console.log(`  slug          ${slug}`);
  console.log(`  manifest sha  ${hash}`);
  console.log(`  registry      ${PACKAGE.slice(0, 16)}…`);
  console.log(`  sender        ${treasury.publicKeyHex.slice(0, 16)}…\n`);

  const tx = new ContractCallBuilder()
    .from(treasury.publicKey)
    .byPackageHash(PACKAGE)
    .entryPoint("register_tool")
    .runtimeArgs(
      Args.fromMap({
        slug: CLValue.newCLString(slug),
        manifest_hash: CLValue.newCLString(hash),
      }),
    )
    .chainName(TESTNET.chainName)
    .payment(Number(gas))
    .build();

  tx.sign(treasury.privateKey);
  console.log("  → calling register_tool…");
  const txHash = await putTransactionRaw(tx);
  console.log(`    tx ${txHash}`);
  await waitForTransactionRaw(txHash, 180_000);

  console.log("\n  ✅ ANCHORED ON-CHAIN");
  console.log(`     ${TESTNET.explorerBase}/deploy/${txHash}`);
}

main().catch((e) => {
  console.error(`\n  ✗ ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
