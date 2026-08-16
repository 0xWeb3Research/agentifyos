// On-chain ALGO and USDC balances for the demo roles, plus the facilitator's
// fee sponsor. Usage: pnpm algo:balance [--address ADDR]
import "dotenv/config";
import { ALGO } from "../../src/lib/chain";
import {
  facilitatorFeePayer,
  getBalances,
  hasRoleAccount,
  loadRoleAccount,
  TESTNET,
  type RoleKey,
} from "../../src/lib/x402/algorand";

const arg = (name: string): string | undefined => {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`));
  if (hit) return hit.split("=").slice(1).join("=");
  const idx = process.argv.indexOf(`--${name}`);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
};

const algo = (micro: bigint) => (Number(micro) / 1e6).toFixed(4);
const usdc = (atomic: bigint | null) =>
  atomic === null ? "—" : (Number(atomic) / 10 ** TESTNET.decimals).toFixed(4);

async function show(label: string, address: string) {
  const b = await getBalances(address);
  const optIn = b.optedIn ? "" : b.exists ? "  (not opted into USDC)" : "  (account not funded yet)";
  console.log(
    `  ${label.padEnd(12)} ${algo(b.algo).padStart(11)} ALGO   ${usdc(b.usdc).padStart(11)} USDC${optIn}`,
  );
  console.log(`  ${" ".repeat(12)} ${ALGO.explorerBase}/account/${address}\n`);
}

async function main() {
  const only = arg("address");
  console.log(`\n  Algorand testnet balances · ${TESTNET.algodUrl}\n`);

  if (only) {
    await show("address", only);
    return;
  }

  for (const role of ["treasury", "agent"] as RoleKey[]) {
    if (!hasRoleAccount(role)) {
      console.log(`  ${role.padEnd(12)} (no key: run pnpm algo:keygen)\n`);
      continue;
    }
    await show(role, loadRoleAccount(role).addr);
  }

  // The fee sponsor is the facilitator's, not ours. Showing it makes the gasless
  // claim checkable: that address pays every fee our agent does not.
  try {
    const feePayer = await facilitatorFeePayer();
    if (feePayer) {
      console.log(`  facilitator fee sponsor (GoPlausible)`);
      console.log(`               ${feePayer}`);
      console.log(`               ${ALGO.explorerBase}/account/${feePayer}\n`);
    }
  } catch (e) {
    console.log(`  facilitator unreachable: ${(e as Error).message}\n`);
  }

  console.log(`  USDC asset   ASA ${TESTNET.assetId}  ${ALGO.explorerBase}/asset/${TESTNET.assetId}`);
  console.log(`  fund ALGO    ${ALGO.faucet}`);
  console.log(`  fund USDC    ${ALGO.usdcFaucet}   (pick Algorand → TestNet)\n`);
}

main().catch((e) => {
  console.error(`\n  ${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
