// Distribute WCSPR from the treasury to the agent (real CEP-18 `transfer`).
//   pnpm casper:transfer [--to agent] [--amount <atomic>]
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadWalletFromFile, transferWcspr, TESTNET } from "../../src/lib/x402/casper";

const here = dirname(fileURLToPath(import.meta.url));
const keys = (r: string) => join(here, "..", "..", "keys", `${r}.pem`);
const WCSPR = process.env.WCSPR_PACKAGE_HASH || "3d80df21ba4ee4d66a2a1f60c32570dd5685e4b279f6538162a5fd1314847c1e";

function arg(name: string, def: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? def) : def;
}

const treasury = loadWalletFromFile(keys("treasury"));
const toRole = arg("to", "agent");
const to = loadWalletFromFile(keys(toRole));
const amount = arg("amount", "1000000000"); // 1 WCSPR (9 decimals)
// This value goes on-chain, so refuse anything but a positive atomic integer.
if (!/^\d+$/.test(amount) || BigInt(amount) === 0n) {
  throw new Error(`--amount must be a positive integer in WCSPR-atomic units (9 decimals), got: ${JSON.stringify(amount)}`);
}

console.log(`Transfer ${amount} WCSPR-atomic: treasury → ${toRole}`);
console.log(`  ${treasury.publicKeyHex.slice(0, 14)}… → ${to.address.slice(0, 14)}…\n`);

const hash = await transferWcspr(treasury, to.address, amount, WCSPR);
console.log(`  ✅ transferred`);
console.log(`     deploy   ${hash}`);
console.log(`     explorer ${TESTNET.explorerBase}/deploy/${hash}`);
