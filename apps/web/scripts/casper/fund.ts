// Move native CSPR between the demo roles.
//
//   pnpm casper:fund --from treasury --to facilitator --cspr 3500
//
// The facilitator pays gas on every settlement, so under a busy public demo it
// is the wallet that actually depletes. This tops it up from the treasury
// reserve. Native transfers cost a flat 0.1 CSPR fee.
import * as CasperNS from "casper-js-sdk";
import {
  TESTNET,
  loadRoleWallet,
  putTransactionRaw,
  waitForTransactionRaw,
  getCsprBalance,
} from "../../src/lib/x402/casper";

const C: any = (CasperNS as any).default ?? CasperNS;
const { NativeTransferBuilder } = C;

type Role = "facilitator" | "treasury" | "agent";
const arg = (n: string, d?: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : d;
};

async function main() {
  const from = arg("from", "treasury") as Role;
  const to = arg("to", "facilitator") as Role;
  const cspr = Number(arg("cspr", "0"));
  if (!cspr || cspr <= 0) {
    console.log("  ✗ pass --cspr <amount>, e.g. --cspr 3500");
    process.exit(1);
  }
  if (from === to) {
    console.log("  ✗ --from and --to must differ");
    process.exit(1);
  }

  const sender = loadRoleWallet(from);
  const recipient = loadRoleWallet(to);
  const motes = BigInt(Math.round(cspr * 1e9));

  console.log(`Native CSPR transfer · ${from} → ${to}\n`);
  console.log(`  amount   ${cspr} CSPR`);
  console.log(`  from     ${sender.publicKeyHex.slice(0, 16)}…`);
  console.log(`  to       ${recipient.publicKeyHex.slice(0, 16)}…\n`);

  const have = BigInt(await getCsprBalance(sender.publicKeyHex));
  if (have < motes + 100_000_000n) {
    console.log(`  ✗ ${from} has ${(Number(have) / 1e9).toFixed(2)} CSPR — not enough for ${cspr} + fee.`);
    process.exit(1);
  }

  const tx = new NativeTransferBuilder()
    .from(sender.publicKey)
    .target(recipient.publicKey)
    .amount(motes.toString())
    .id(Date.now())
    .chainName(TESTNET.chainName)
    .payment(100_000_000) // flat 0.1 CSPR native-transfer fee
    .build();

  tx.sign(sender.privateKey);
  console.log("  → submitting native transfer…");
  const hash = await putTransactionRaw(tx);
  console.log(`    tx ${hash}`);
  await waitForTransactionRaw(hash, 120_000);

  console.log("\n  ✅ transferred");
  console.log(`     ${TESTNET.explorerBase}/deploy/${hash}`);
}

main().catch((e) => {
  console.error(`\n  ✗ ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
