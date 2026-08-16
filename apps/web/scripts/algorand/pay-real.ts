// One real x402 payment on Algorand testnet, end to end, with the whole
// handshake printed.
//
//   pnpm algo:pay                                  pay for the default tool
//   pnpm algo:pay --slug page-scraper --url https://algorand.co
//   pnpm algo:pay --base http://localhost:8402     against a local dev server
//   pnpm algo:pay --wrapped                        the three-line integration
//
// This is the script to run when someone asks for proof. It calls the public
// paid endpoint over HTTP with no privileged shortcut, gets a 402, signs a USDC
// transfer, retries, and prints the Lora link for the transaction that settled.
import "dotenv/config";
import { ALGO } from "../../src/lib/chain";
import { getBalances, hasRoleAccount, loadRoleAccount, TESTNET } from "../../src/lib/x402/algorand";
import {
  makePayClient,
  payAndFetch,
  paymentEnabledFetch,
} from "../../src/lib/x402/algorand-client";
import { decodePaymentResponseHeader } from "@x402-avm/fetch";

const argv = process.argv.slice(2);
const arg = (name: string, def?: string): string | undefined => {
  const eq = argv.find((a) => a.startsWith(`--${name}=`));
  if (eq) return eq.split("=").slice(1).join("=");
  const idx = argv.indexOf(`--${name}`);
  return idx >= 0 ? argv[idx + 1] : def;
};

const BASE = arg("base", process.env.AGENTIFYOS_URL || "http://localhost:8402")!;
const SLUG = arg("slug", "algo-market-data")!;
const MAX_USD = Number(arg("max", "0.5"));

async function main() {
  if (!hasRoleAccount("agent")) {
    throw new Error("ALGO_AGENT_MNEMONIC is not set. Run `pnpm algo:keygen` first.");
  }
  const agent = loadRoleAccount("agent");

  console.log(`\n  x402 payment · Algorand testnet\n`);
  console.log(`  resource     ${BASE}/api/t/${SLUG}`);
  console.log(`  payer        ${agent.addr}`);
  console.log(`  facilitator  ${TESTNET.facilitatorUrl}`);
  console.log(`  asset        USDC · ASA ${TESTNET.assetId}\n`);

  // Preflight the two conditions that produce an opaque failure inside the
  // facilitator, so the operator is told what is wrong rather than shown a
  // simulate error.
  const balance = await getBalances(agent.addr);
  if (!balance.optedIn) {
    throw new Error(
      `the agent has not opted into USDC (ASA ${TESTNET.assetId}). Run \`pnpm algo:optin\`.`,
    );
  }
  if ((balance.usdc ?? 0n) === 0n) {
    throw new Error(`the agent holds no USDC. Run \`pnpm algo:fund --usdc 1\`.`);
  }
  console.log(
    `  agent holds  ${(Number(balance.usdc) / 10 ** TESTNET.decimals).toFixed(4)} USDC, ` +
      `${(Number(balance.algo) / 1e6).toFixed(4)} ALGO\n`,
  );

  const params = new URLSearchParams();
  for (const a of argv) {
    if (a.startsWith("--") && a.includes("=")) {
      const [k, ...v] = a.slice(2).split("=");
      if (!["base", "slug", "max"].includes(k)) params.set(k, v.join("="));
    }
  }
  const url = `${BASE}/api/t/${SLUG}${params.toString() ? `?${params}` : ""}`;

  // --wrapped runs the same payment through wrapFetchWithPayment: no steps to
  // watch, just a fetch that turns a 402 into a 200. It is the integration an
  // outside developer would actually write, so it is worth being able to run it.
  if (argv.includes("--wrapped")) {
    const pay = paymentEnabledFetch(agent);
    const res = await pay(url, { headers: { accept: "application/json" } });
    const body = (await res.json()) as { result?: unknown };
    const settle = decodePaymentResponseHeader(res.headers.get("PAYMENT-RESPONSE") ?? "");
    console.log(`  ${res.status} ${res.ok ? "OK" : "failed"}\n`);
    console.log(`${JSON.stringify(body.result, null, 2).split("\n").map((l) => "    " + l).join("\n")}\n`);
    console.log(`  ✓ settled · ${ALGO.explorerBase}/transaction/${settle.transaction}\n`);
    return;
  }

  const out = await payAndFetch(url, makePayClient(agent), {
    maxUsd: Number.isFinite(MAX_USD) && MAX_USD > 0 ? MAX_USD : 0.5,
    onStep: (s) => console.log(`  ${(s.ok ? "·" : "✗").padEnd(3)} ${s.label}  (+${s.atMs}ms)`),
  });

  if (!out.ok) {
    console.error(`\n  ✗ failed: ${out.error ?? out.status}\n`);
    if (out.body) console.error(`    ${JSON.stringify(out.body)}\n`);
    process.exit(1);
  }

  const body = out.body as { result?: unknown; receipt?: Record<string, unknown> } | null;
  console.log(`\n  result\n${JSON.stringify(body?.result, null, 2).split("\n").map((l) => "    " + l).join("\n")}\n`);

  const txId = out.txId;
  console.log(`  ✓ settled on Algorand testnet\n`);
  console.log(`    transaction   ${txId}`);
  console.log(`    explorer      ${ALGO.explorerBase}/transaction/${txId}`);
  console.log(`    facilitator   ${TESTNET.facilitatorUrl}/api/receipt/${txId}`);
  console.log(`    payer         ${ALGO.explorerBase}/account/${agent.addr}\n`);

  const after = await getBalances(agent.addr);
  console.log(
    `  agent now holds ${(Number(after.usdc ?? 0n) / 10 ** TESTNET.decimals).toFixed(4)} USDC, ` +
      `${(Number(after.algo) / 1e6).toFixed(4)} ALGO ` +
      `(ALGO unchanged: the facilitator paid the fee)\n`,
  );
}

main().catch((e) => {
  console.error(`\n  ${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
