// Generate Algorand accounts for the demo roles and print what to paste into
// apps/web/.env.
//
// Usage: pnpm algo:keygen [role ...]        (default: treasury agent)
//
// Unlike the Casper keygen this writes nothing to disk. Algorand secrets are
// 25-word mnemonics, which belong in the environment: a hosted deploy has no
// filesystem to ship a key file to, and a mnemonic printed once and pasted into
// .env leaves no stray copy behind. Nothing here touches an existing account, so
// there is no key to overwrite and no rotation guard to get wrong.
import "dotenv/config";
import algosdk from "algosdk";
import { ALGO } from "../../src/lib/chain";

const ENV_VAR: Record<string, string> = {
  treasury: "ALGO_TREASURY_MNEMONIC",
  agent: "ALGO_AGENT_MNEMONIC",
};

const requested = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const roles = requested.length ? requested : ["treasury", "agent"];

const unknown = roles.filter((r) => !ENV_VAR[r]);
if (unknown.length) {
  console.error(`unknown role(s): ${unknown.join(", ")}. Known roles: ${Object.keys(ENV_VAR).join(", ")}`);
  process.exit(1);
}

console.log(`\n  Algorand testnet accounts (${ALGO.chainName})\n`);

const lines: string[] = [];
for (const role of roles) {
  const account = algosdk.generateAccount();
  const address = account.addr.toString();
  const mnemonic = algosdk.secretKeyToMnemonic(account.sk);
  const already = process.env[ENV_VAR[role]];

  console.log(`  ${role}`);
  console.log(`    address   ${address}`);
  console.log(`    explorer  ${ALGO.explorerBase}/account/${address}`);
  console.log(`    mnemonic  ${mnemonic}`);
  if (already) {
    console.log(`    ⚠ ${ENV_VAR[role]} is already set. Keep the old value unless you mean to replace it.`);
  }
  console.log();

  lines.push(`${ENV_VAR[role]}="${mnemonic}"`);
  if (role === "treasury") lines.push(`ALGO_TREASURY_ADDRESS=${address}`);
  if (role === "agent") lines.push(`ALGO_AGENT_ADDRESS=${address}`);
}

console.log("  ── paste into apps/web/.env ──────────────────────────────────────\n");
for (const line of lines) console.log(`  ${line}`);
console.log(`
  ── then ────────────────────────────────────────────────────────────

  1. fund both addresses with testnet ALGO   ${ALGO.faucet}
     0.3 ALGO each is plenty: 0.1 base minimum balance, 0.1 more for the
     USDC opt-in, and a little for the opt-in transaction fee.
  2. opt both accounts into USDC             pnpm algo:optin
     Do this BEFORE the USDC faucet: Algorand cannot credit an asset to an
     account that has not opted into it, so a faucet send would just fail.
  3. get testnet USDC for the treasury       ${ALGO.usdcFaucet}   (pick Algorand → TestNet)
  4. move some USDC to the agent             pnpm algo:fund --usdc 1
  5. check it landed                         pnpm algo:balance

  Once a payment settles, the agent needs no ALGO for fees at all: the
  GoPlausible facilitator sponsors them. The 0.2 ALGO above is Algorand's
  locked minimum balance, not a spend.
`);
