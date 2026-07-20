// Install the AgentifyOS ToolRegistry contract on Casper testnet.
//
//   pnpm casper:deploy-registry [--gas <motes>]
//
// Installing is a SESSION transaction: the wasm's `call()` runs once, creates
// the contract and its dictionaries, and stores the package under the sending
// account's named keys. The contract hash it prints is the one to publish.
import { readFileSync } from "node:fs";
import path from "node:path";
import * as CasperNS from "casper-js-sdk";
import {
  TESTNET,
  loadRoleWallet,
  putTransactionRaw,
  waitForTransactionRaw,
  getCsprBalance,
} from "../../src/lib/x402/casper";

const C: any = (CasperNS as any).default ?? CasperNS;
const { Args, SessionBuilder } = C;

const arg = (name: string, fallback?: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};

// Casper bills `payment_limited`: the declared amount is debited in full and
// only 75% of the unused remainder is refunded. Overshooting burns real CSPR,
// so this is a considered figure rather than a huge safety margin.
const GAS_MOTES = arg("gas", "120000000000")!; // 120 CSPR

const WASM = path.resolve(
  process.cwd(),
  // The lowered artifact from contracts/tool-registry/build.sh; the raw
  // cargo output contains bulk-memory ops the node rejects.
  "../../contracts/tool-registry/target/tool_registry.mvp.wasm",
);

async function main() {
  const treasury = loadRoleWallet("treasury");
  const wasm = readFileSync(WASM);

  console.log("Install ToolRegistry · Casper testnet\n");
  console.log(`  sender   ${treasury.publicKeyHex.slice(0, 16)}…`);
  console.log(`  wasm     ${WASM.split("/").slice(-1)[0]}  (${wasm.length} bytes)`);
  console.log(`  gas      ${Number(GAS_MOTES) / 1e9} CSPR declared\n`);

  // getCsprBalance returns motes as a decimal string.
  const motes = BigInt(await getCsprBalance(treasury.publicKeyHex));
  const cspr = Number(motes) / 1e9;
  const need = Number(GAS_MOTES) / 1e9;
  if (motes < BigInt(GAS_MOTES)) {
    console.log(`  ✗ treasury holds ${cspr.toFixed(2)} CSPR, needs ~${need}. Fund it first.`);
    process.exit(1);
  }
  console.log(`  → treasury has ${cspr.toFixed(2)} CSPR`);

  const tx = new SessionBuilder()
    .from(treasury.publicKey)
    .wasm(new Uint8Array(wasm))
    // Casper 2.0 routes contract installs to a dedicated transaction lane.
    // Without this the tx is a plain session and the runtime refuses to add a
    // contract version (ApiError::NotAllowedToAddContractVersion).
    .installOrUpgrade()
    .runtimeArgs(Args.fromMap({}))
    .chainName(TESTNET.chainName)
    .payment(Number(GAS_MOTES)) // the builder serializes this as a JSON number
    .build();

  tx.sign(treasury.privateKey);
  console.log("  → submitting install transaction…");
  const hash = await putTransactionRaw(tx);
  console.log(`    tx ${hash}`);
  console.log("  → waiting for execution (this takes ~15-60s)…");

  try {
    await waitForTransactionRaw(hash, 180_000);
  } catch (e) {
    console.log(`\n  ✗ install failed: ${e instanceof Error ? e.message : e}`);
    console.log(`     ${TESTNET.explorerBase}/deploy/${hash}`);
    process.exit(1);
  }

  console.log("\n  ✅ INSTALLED");
  console.log(`     tx       ${TESTNET.explorerBase}/deploy/${hash}`);
  console.log(`     account  ${TESTNET.explorerBase}/account/${treasury.publicKeyHex}`);
  console.log("\n  Read the resulting hashes with:  pnpm casper:registry-info\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
