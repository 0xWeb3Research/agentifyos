// Move testnet value between the demo roles.
//
//   pnpm algo:fund --usdc 1                treasury → agent, 1 USDC
//   pnpm algo:fund --algo 0.3              treasury → agent, 0.3 ALGO
//   pnpm algo:fund --usdc 1 --to <address> pay an arbitrary address
//   pnpm algo:fund --from agent --usdc 0.5 sweep back the other way
//
// The faucets fund one account; this spreads it. USDC is what tools are paid in;
// ALGO is only ever needed to cover an account's opt-in and minimum balance.
import "dotenv/config";
import { ALGO } from "../../src/lib/chain";
import {
  getBalances,
  hasRoleAccount,
  loadRoleAccount,
  transferAlgo,
  transferUsdc,
  TESTNET,
  type RoleKey,
} from "../../src/lib/x402/algorand";

const argv = process.argv.slice(2);
const arg = (name: string): string | undefined => {
  const eq = argv.find((a) => a.startsWith(`--${name}=`));
  if (eq) return eq.split("=").slice(1).join("=");
  const idx = argv.indexOf(`--${name}`);
  return idx >= 0 ? argv[idx + 1] : undefined;
};

// Decimal string → atomic units without touching float64. `0.1 * 1e6` is
// 100000.00000000001 in binary floating point, and BigInt() rejects that; more
// importantly, a funding script has no business rounding anyone's money.
function toAtomicUnits(decimal: string, decimals: number): bigint {
  const s = decimal.trim();
  if (!/^\d+(\.\d+)?$/.test(s)) throw new Error(`amount must be a positive decimal, got: ${decimal}`);
  const [whole, frac = ""] = s.split(".");
  if (frac.length > decimals) {
    throw new Error(`at most ${decimals} decimal places supported, got: ${decimal}`);
  }
  return BigInt(whole + frac.padEnd(decimals, "0"));
}

async function main() {
  const fromRole = (arg("from") || "treasury") as RoleKey;
  const toArg = arg("to") || "agent";
  const usdcAmount = arg("usdc");
  const algoAmount = arg("algo");

  if (!usdcAmount && !algoAmount) {
    console.log("\n  usage: pnpm algo:fund --usdc <amount> [--algo <amount>] [--from role] [--to role|address]\n");
    process.exit(1);
  }
  if (!hasRoleAccount(fromRole)) {
    throw new Error(`no key for "${fromRole}". Run pnpm algo:keygen first.`);
  }

  const from = loadRoleAccount(fromRole);
  const to =
    toArg === "treasury" || toArg === "agent" ? loadRoleAccount(toArg as RoleKey).addr : toArg;

  console.log(`\n  Algorand testnet transfer · ${fromRole} → ${toArg}\n`);
  console.log(`  from  ${from.addr}`);
  console.log(`  to    ${to}\n`);

  if (algoAmount) {
    const micro = toAtomicUnits(algoAmount, 6);
    const balance = await getBalances(from.addr);
    if (balance.algo < micro + 1000n) {
      throw new Error(
        `${fromRole} holds ${(Number(balance.algo) / 1e6).toFixed(4)} ALGO, not enough for ${algoAmount} plus fee.`,
      );
    }
    const txId = await transferAlgo(from, to, micro);
    console.log(`  ✓ sent ${algoAmount} ALGO`);
    console.log(`    ${ALGO.explorerBase}/transaction/${txId}\n`);
  }

  if (usdcAmount) {
    const atomic = toAtomicUnits(usdcAmount, TESTNET.decimals);
    const [sender, receiver] = await Promise.all([getBalances(from.addr), getBalances(to)]);
    if (!sender.optedIn || (sender.usdc ?? 0n) < atomic) {
      throw new Error(
        `${fromRole} holds ${sender.optedIn ? (Number(sender.usdc) / 10 ** TESTNET.decimals).toFixed(4) : "no"} USDC, not enough for ${usdcAmount}. Fund it at ${ALGO.usdcFaucet}.`,
      );
    }
    // An asset transfer to an address that never opted in is rejected by the
    // network. Catching it here costs one query and saves a confusing failure.
    if (!receiver.optedIn) {
      throw new Error(
        `${to} has not opted into USDC (ASA ${TESTNET.assetId}). Run \`pnpm algo:optin\` for that account first.`,
      );
    }
    const txId = await transferUsdc(from, to, atomic);
    console.log(`  ✓ sent ${usdcAmount} USDC`);
    console.log(`    ${ALGO.explorerBase}/transaction/${txId}\n`);
  }
}

main().catch((e) => {
  console.error(`\n  ${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
