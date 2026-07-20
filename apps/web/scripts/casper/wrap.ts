// Wrap native CSPR → WCSPR by calling the token's Odra payable `deposit` entry
// point through Odra's proxy_caller session wasm (Casper 2.0 has no attached-value
// primitive for plain contract calls, so this is the only correct path).
//
//   pnpm casper:wrap [--role treasury] [--cspr 50] [--dry-run]
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildWrapTx,
  getCsprBalance,
  loadWalletFromFile,
  wrapCspr,
  TESTNET,
} from "../../src/lib/x402/casper";

const here = dirname(fileURLToPath(import.meta.url));
const WCSPR = process.env.WCSPR_PACKAGE_HASH || "3d80df21ba4ee4d66a2a1f60c32570dd5685e4b279f6538162a5fd1314847c1e";

function arg(name: string, def: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? def) : def;
}
const dryRun = process.argv.includes("--dry-run");

// CSPR → motes via exact integer string math. Float64 (`Number(x) * 1e9`)
// silently rounds past 2^53 motes and lets NaN/negative input through.
function csprToMotes(s: string): bigint {
  const m = /^(\d+)(?:\.(\d+))?$/.exec(s);
  if (!m) throw new Error(`--cspr must be a positive decimal number, got: ${JSON.stringify(s)}`);
  const frac = m[2] ?? "";
  if (frac.length > 9) throw new Error(`--cspr supports at most 9 decimal places (1 mote = 1e-9 CSPR), got: ${s}`);
  const motes = BigInt(m[1]) * 1_000_000_000n + BigInt(frac.padEnd(9, "0") || "0");
  if (motes <= 0n) throw new Error(`--cspr must be greater than zero, got: ${s}`);
  return motes;
}

const role = arg("role", "treasury");
const cspr = arg("cspr", "50");
const amountMotes = csprToMotes(cspr).toString();

const wallet = loadWalletFromFile(join(here, "..", "..", "keys", `${role}.pem`));
const proxyWasm = new Uint8Array(readFileSync(join(here, "wasm", "proxy_caller_with_return.wasm")));

console.log(`Wrap ${cspr} CSPR → WCSPR  (${role})`);
console.log(`  amount    ${amountMotes} motes`);
console.log(`  account   ${wallet.publicKeyHex}`);
console.log(`  token     ${WCSPR.slice(0, 16)}…`);
console.log(`  proxy     proxy_caller_with_return.wasm (${proxyWasm.length} bytes)\n`);

if (dryRun) {
  const tx = buildWrapTx(wallet, amountMotes, WCSPR, proxyWasm);
  tx.sign(wallet.privateKey);
  const json = tx.toJSON ? tx.toJSON() : {};
  console.log("  ✓ session transaction built + signed (dry run, not submitted)");
  console.log(`    attached_value ${amountMotes} motes`);
  console.log(`    approvals      ${tx.approvals?.length ?? 0}`);
  console.log(`    target         ${JSON.stringify((json as any)?.payload?.fields?.target ?? "Session")}`.slice(0, 120));
  process.exit(0);
}

const balance = Number(await getCsprBalance(wallet.publicKeyHex)) / 1e9;
const needed = Number(cspr) + 20;
if (balance < needed) {
  console.log(`  ⚠ ${role} has ${balance.toFixed(2)} CSPR, needs ~${needed} (wrap amount + ~20 gas).`);
  console.log(`     Fund it: https://testnet.cspr.live/tools/faucet → ${wallet.publicKeyHex}`);
  process.exit(1);
}

console.log("  → submitting session transaction…");
const hash = await wrapCspr(wallet, amountMotes, WCSPR, proxyWasm);
console.log(`\n  ✅ wrapped ${cspr} CSPR → WCSPR`);
console.log(`     deploy   ${hash}`);
console.log(`     explorer ${TESTNET.explorerBase}/deploy/${hash}`);
