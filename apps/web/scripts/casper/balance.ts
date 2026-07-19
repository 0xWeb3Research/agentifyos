// Check native CSPR (and, once confirmed, WCSPR) balances for the demo accounts.
// Run: pnpm exec tsx scripts/casper/balance.ts
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { getCsprBalance, getWcsprBalance, loadWalletFromFile, TESTNET } from "../../src/lib/x402/casper";

const here = dirname(fileURLToPath(import.meta.url));
const roles = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const which = roles.length ? roles : ["facilitator", "agent", "treasury"];

console.log(`CSPR balances (testnet · ${TESTNET.rpcUrl})\n`);
for (const role of which) {
  const pem = join(here, "..", "..", "keys", `${role}.pem`);
  if (!existsSync(pem)) {
    console.log(`  ${role.padEnd(12)} (no key — run casper:keygen)`);
    continue;
  }
  const w = loadWalletFromFile(pem);
  try {
    const [motes, wcsprAtomic] = await Promise.all([
      getCsprBalance(w.publicKeyHex),
      getWcsprBalance(w.accountHash),
    ]);
    const cspr = (Number(motes) / 1e9).toFixed(4);
    const wcspr = (Number(wcsprAtomic) / 1e9).toFixed(4);
    console.log(
      `  ${role.padEnd(12)} ${cspr.padStart(12)} CSPR   ${wcspr.padStart(12)} WCSPR   ${w.publicKeyHex.slice(0, 12)}…`,
    );
  } catch (e) {
    console.log(`  ${role.padEnd(12)} balance read failed: ${(e as Error).message}`);
  }
}
console.log(`\nFund an account: https://testnet.cspr.live/tools/faucet (5,000 CSPR, once per account)`);
