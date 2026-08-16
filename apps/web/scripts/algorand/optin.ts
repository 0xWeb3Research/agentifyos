// Opt an account into the USDC ASA. Usage: pnpm algo:optin [role ...]
//
// Algorand will not credit an asset to an account that has not opted into it, so
// this has to happen once for the buying agent AND once for every address that
// receives payment. A receiver that skipped this fails at the facilitator's
// simulate step, which is the most common way a first x402 demo dies.
import "dotenv/config";
import { ALGO } from "../../src/lib/chain";
import {
  getBalances,
  hasRoleAccount,
  loadRoleAccount,
  optInUsdc,
  TESTNET,
  type RoleKey,
} from "../../src/lib/x402/algorand";

const requested = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const roles = (requested.length ? requested : ["treasury", "agent"]) as RoleKey[];

// 0.1 ALGO of locked minimum balance per opt-in, plus the transaction fee.
const MIN_ALGO_FOR_OPTIN = 101_000n;

async function main() {
  console.log(`\n  Opt in to USDC · ASA ${TESTNET.assetId} · Algorand testnet\n`);

  for (const role of roles) {
    if (!hasRoleAccount(role)) {
      console.log(`  ${role}: no key. Run pnpm algo:keygen first.\n`);
      continue;
    }
    const account = loadRoleAccount(role);
    const before = await getBalances(account.addr);

    if (before.optedIn) {
      console.log(`  ${role}: already opted in (${account.addr})\n`);
      continue;
    }
    // An opt-in from an unfunded account fails on-chain and costs a round trip
    // to find out. Say what is missing instead.
    if (before.algo < MIN_ALGO_FOR_OPTIN) {
      console.log(
        `  ${role}: needs ALGO before it can opt in ` +
          `(has ${(Number(before.algo) / 1e6).toFixed(4)}, needs ~0.11).`,
      );
      console.log(`         fund ${account.addr}`);
      console.log(`         at   ${ALGO.faucet}\n`);
      continue;
    }

    const txId = await optInUsdc(account);
    console.log(`  ${role}: opted in`);
    console.log(`         ${ALGO.explorerBase}/transaction/${txId}\n`);
  }
}

main().catch((e) => {
  console.error(`\n  ${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
