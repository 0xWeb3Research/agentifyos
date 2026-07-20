// Repro: sign against the live 402 requirements and settle directly (bypassing
// the route) to capture the deploy hash + node-level error for diffing.
import { loadRoleWallet, signPayment, settleOnChain } from "../src/lib/x402/casper";

async function main() {
  const res = await fetch("http://localhost:8402/api/t/cspr-market-data");
  const j = (await res.json()) as any;
  const req = j.accepts[0];
  console.log("REQ", JSON.stringify(req));

  const agent = loadRoleWallet("agent");
  const payload = signPayment(agent, req);
  console.log("AUTH", JSON.stringify(payload.authorization));

  const facilitator = loadRoleWallet("facilitator");
  try {
    const out = await settleOnChain(facilitator, payload, req);
    console.log("RESULT", JSON.stringify(out));
  } catch (e: any) {
    console.log("REVERTED", e?.message ?? String(e));
    for (const k of ["deployHash", "hash", "transactionHash"]) if (e?.[k]) console.log("DEPLOY", e[k]);
  }
}
main();
