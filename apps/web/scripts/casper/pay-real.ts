// REAL end-to-end x402 settlement on Casper testnet — no mock, no simulation.
// The agent signs an EIP-712 payment authorization; the facilitator submits
// `transfer_with_authorization` on-chain and pays gas. Prints the real deploy
// hash + testnet.cspr.live link.
//
//   pnpm casper:pay [--amount <motes>] [--to 00<accounthash>]
//
// Requires: facilitator funded with CSPR (gas), agent holding WCSPR (see TESTNET.md).
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  getCsprBalance,
  loadWalletFromFile,
  settleOnChain,
  signPayment,
  TESTNET,
  type CasperPaymentRequirements,
} from "../../src/lib/x402/casper";

const here = dirname(fileURLToPath(import.meta.url));
const keys = (r: string) => join(here, "..", "..", "keys", `${r}.pem`);
const WCSPR = process.env.WCSPR_PACKAGE_HASH || "3d80df21ba4ee4d66a2a1f60c32570dd5685e4b279f6538162a5fd1314847c1e";

function arg(name: string, def: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? def) : def;
}

const facilitator = loadWalletFromFile(keys("facilitator"));
const agent = loadWalletFromFile(keys("agent"));
const treasury = loadWalletFromFile(keys("treasury"));

const amount = arg("amount", "8658008"); // ~$0.002 worth of WCSPR (9 decimals)
const payTo = arg("to", treasury.address);

console.log("REAL x402 settlement · Casper testnet\n");
console.log(`  facilitator  ${facilitator.publicKeyHex.slice(0, 16)}…  (submits + pays gas)`);
console.log(`  agent        ${agent.publicKeyHex.slice(0, 16)}…  (signs the payment)`);
console.log(`  payTo        ${payTo.slice(0, 16)}…`);
console.log(`  amount       ${amount} WCSPR-atomic\n`);

const facGas = Number(await getCsprBalance(facilitator.publicKeyHex)) / 1e9;
if (facGas < 5) {
  console.log(`  ⚠ facilitator has ${facGas.toFixed(2)} CSPR — needs ~7+ for gas. Fund it:`);
  console.log(`     https://testnet.cspr.live/tools/faucet  →  ${facilitator.publicKeyHex}`);
  process.exit(1);
}

const req: CasperPaymentRequirements = {
  scheme: "exact",
  network: TESTNET.network,
  amount,
  asset: WCSPR,
  payTo,
  maxTimeoutSeconds: 120,
  extra: { name: "Wrapped CSPR", version: "1", symbol: "WCSPR", decimals: "9" },
};

console.log("  → agent signs EIP-712 authorization…");
const payload = signPayment(agent, req);
console.log(`    signature ${payload.signature.slice(0, 20)}… (65 bytes)`);

console.log("  → facilitator settles on-chain (transfer_with_authorization)…");
const res = await settleOnChain(facilitator, payload, req);

if (res.success) {
  console.log(`\n  ✅ SETTLED on Casper testnet`);
  console.log(`     deploy   ${res.deployHash}`);
  console.log(`     explorer ${res.explorerUrl}`);
} else {
  console.log(`\n  ✗ settlement failed: ${res.reason}`);
  if (res.deployHash) console.log(`     deploy   ${res.explorerUrl}`);
  process.exit(1);
}
