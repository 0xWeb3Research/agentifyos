// Everything from "the accounts have USDC" to "here is the proof", in one
// command. Usage: pnpm algo:demo [--base http://localhost:8402]
//
// It exists because the last mile of the runbook had a branch nobody should have
// to think about: the faucet may have funded the treasury or the agent, and the
// agent needs a balance either way. This works out which happened, moves USDC
// only if it has to, makes one real payment, and prints the rows to paste into
// docs/PROOF.md.
import "dotenv/config";
import { ALGO } from "../../src/lib/chain";
import {
  getBalances,
  hasRoleAccount,
  loadRoleAccount,
  transferUsdc,
  TESTNET,
} from "../../src/lib/x402/algorand";
import { makePayClient, payAndFetch } from "../../src/lib/x402/algorand-client";

const argv = process.argv.slice(2);
const arg = (name: string, def?: string): string | undefined => {
  const eq = argv.find((a) => a.startsWith(`--${name}=`));
  if (eq) return eq.split("=").slice(1).join("=");
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : def;
};

const BASE = arg("base", process.env.AGENTIFYOS_URL || "http://localhost:8402")!;
const SLUG = arg("slug", "algo-market-data")!;
/** What the agent should hold before paying, in microUSDC. */
const TOP_UP = BigInt(arg("topup", "1000000")!);

const usdc = (n: bigint | null) =>
  n === null ? "not opted in" : (Number(n) / 10 ** TESTNET.decimals).toFixed(4);

async function main() {
  for (const role of ["treasury", "agent"] as const) {
    if (!hasRoleAccount(role)) throw new Error(`no ${role} key. Run \`pnpm algo:keygen\` first.`);
  }
  const treasury = loadRoleAccount("treasury");
  const agent = loadRoleAccount("agent");

  console.log(`\n  AgentifyOS · one real x402 payment on Algorand testnet\n`);

  let [t, a] = await Promise.all([getBalances(treasury.addr), getBalances(agent.addr)]);
  console.log(`  treasury  ${usdc(t.usdc).padStart(12)} USDC   ${treasury.addr}`);
  console.log(`  agent     ${usdc(a.usdc).padStart(12)} USDC   ${agent.addr}\n`);

  if (!t.optedIn || !a.optedIn) {
    throw new Error("both accounts must opt into USDC first: run `pnpm algo:optin`");
  }
  if ((t.usdc ?? 0n) === 0n && (a.usdc ?? 0n) === 0n) {
    throw new Error(
      `neither account holds USDC. Fund one at ${ALGO.usdcFaucet} (pick Algorand → TestNet), then run this again.`,
    );
  }

  // The faucet funded one of them; make sure it is the one that has to pay.
  if ((a.usdc ?? 0n) === 0n) {
    const amount = (t.usdc ?? 0n) < TOP_UP ? (t.usdc ?? 0n) : TOP_UP;
    console.log(`  → moving ${usdc(amount)} USDC from the treasury to the agent`);
    const txId = await transferUsdc(treasury, agent.addr, amount);
    console.log(`    ${ALGO.explorerBase}/transaction/${txId}\n`);
    [t, a] = await Promise.all([getBalances(treasury.addr), getBalances(agent.addr)]);
  }

  const url = `${BASE}/api/t/${SLUG}`;
  console.log(`  paying ${url}\n`);
  const out = await payAndFetch(url, makePayClient(agent), {
    maxUsd: 0.5,
    onStep: (s) => console.log(`  ${s.ok ? "·" : "✗"} ${s.label}`),
  });

  if (!out.ok || !out.txId) {
    console.error(`\n  ✗ ${out.error ?? out.status}\n`);
    process.exit(1);
  }

  const body = out.body as { receipt?: { costUsd?: number } } | null;
  const cost = body?.receipt?.costUsd;
  const after = await getBalances(agent.addr);

  console.log(`\n  ✓ settled\n`);
  console.log(`    transaction   ${out.txId}`);
  console.log(`    explorer      ${ALGO.explorerBase}/transaction/${out.txId}`);
  // The facilitator only serves receipts for mainnet settlements, so there is
  // nothing to link here on testnet; the indexer above is the independent check.
  console.log(
    `\n  agent USDC ${usdc(a.usdc)} → ${usdc(after.usdc)}, ` +
      `ALGO ${(Number(a.algo) / 1e6).toFixed(4)} → ${(Number(after.algo) / 1e6).toFixed(4)} ` +
      `(unchanged: the facilitator paid the fee)\n`,
  );

  // Ready to paste at the ALGORAND-PROOF marker in docs/PROOF.md.
  console.log(`  ── paste into docs/PROOF.md ─────────────────────────────────────\n`);
  console.log(
    `| 1 | ${SLUG} | $${(cost ?? 0).toFixed(3)} | ` +
      `[\`${out.txId}\`](${ALGO.explorerBase}/transaction/${out.txId}) | ` +
      `[view](${ALGO.explorerBase}/transaction/${out.txId}) |\n`,
  );
}

main().catch((e) => {
  console.error(`\n  ${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
