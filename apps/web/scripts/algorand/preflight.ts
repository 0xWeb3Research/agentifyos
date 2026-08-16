// Check everything a real Algorand settlement depends on, without spending
// anything. Usage: pnpm algo:preflight
//
// Each line is one thing that can be wrong, checked independently, so a failure
// names its own fix instead of surfacing later as a facilitator simulate error.
import "dotenv/config";
import { ALGORAND_TESTNET_CAIP2, USDC_TESTNET_ASA_ID } from "@x402-avm/avm";
import { ALGO, DEFAULT_CHAIN as CHAIN } from "../../src/lib/chain";
import {
  facilitatorFeePayer,
  getBalances,
  getResourceServer,
  hasRoleAccount,
  loadRoleAccount,
  TESTNET,
  type RoleKey,
} from "../../src/lib/x402/algorand";

let failures = 0;

function check(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "✓" : "✗"}  ${label}${detail ? `  ${detail}` : ""}`);
  if (!ok) failures++;
}

async function main() {
  console.log(`\n  Algorand x402 preflight\n`);

  check("CHAIN is algorand", CHAIN === "algorand", CHAIN === "algorand" ? "" : `(CHAIN=${CHAIN})`);

  // chain.ts hardcodes these so client components can read them without the AVM
  // SDK. If a version bump ever moved them, everything downstream would quote a
  // network the facilitator does not serve, so assert they still agree.
  check(
    "CAIP-2 network matches @x402-avm/avm",
    ALGO.network === ALGORAND_TESTNET_CAIP2,
    ALGO.network,
  );
  check("USDC asset id matches @x402-avm/avm", ALGO.assetId === USDC_TESTNET_ASA_ID, `ASA ${ALGO.assetId}`);

  let feePayer: string | null = null;
  try {
    await getResourceServer();
    feePayer = await facilitatorFeePayer();
    check("facilitator reachable and serving this network", true, TESTNET.facilitatorUrl);
    check("facilitator sponsors the fee", !!feePayer, feePayer ?? "no feePayer advertised");
  } catch (e) {
    check("facilitator reachable and serving this network", false, (e as Error).message);
  }

  for (const role of ["treasury", "agent"] as RoleKey[]) {
    if (!hasRoleAccount(role)) {
      check(`${role} key present`, false, "run pnpm algo:keygen");
      continue;
    }
    const account = loadRoleAccount(role);
    check(`${role} key present`, true, account.addr);
    try {
      const b = await getBalances(account.addr);
      check(`${role} opted into USDC`, b.optedIn, b.optedIn ? "" : "run pnpm algo:optin");
      if (role === "agent") {
        check(
          "agent holds USDC to spend",
          (b.usdc ?? 0n) > 0n,
          (b.usdc ?? 0n) > 0n ? `${(Number(b.usdc) / 10 ** TESTNET.decimals).toFixed(4)} USDC` : "run pnpm algo:fund --usdc 1",
        );
      }
    } catch (e) {
      check(`${role} readable on algod`, false, (e as Error).message);
    }
  }

  const treasuryAddress = process.env.ALGO_TREASURY_ADDRESS || process.env.NEXT_PUBLIC_ALGO_TREASURY_ADDRESS;
  check(
    "ALGO_TREASURY_ADDRESS set (the payee every listing quotes)",
    !!treasuryAddress,
    treasuryAddress ?? "unset: /api/t/* will answer 503",
  );
  check("MODE=real", process.env.MODE === "real", process.env.MODE ?? "unset (defaults to mock)");

  console.log(
    failures === 0
      ? `\n  ready. Run \`pnpm algo:pay\` for a real settlement.\n`
      : `\n  ${failures} check${failures === 1 ? "" : "s"} failed. See docs/ALGORAND.md.\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(`\n  ${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
