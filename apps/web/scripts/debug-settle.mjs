// Repro: sign against the live 402 requirements and settle directly (bypassing
// the route) to capture the deploy hash + node-level error for diffing.
import { register } from "node:module";
import { spawnSync } from "node:child_process";

const r = spawnSync(
  "pnpm",
  [
    "exec",
    "tsx",
    "-e",
    `
import { loadRoleWallet, signPayment, settleOnChain } from "./src/lib/x402/casper";

const res = await fetch("http://localhost:8402/api/t/cspr-market-data");
const j = await res.json();
const req = j.accepts[0];
console.log("REQ", JSON.stringify(req));

const agent = loadRoleWallet("agent");
const payload = signPayment(agent, req);
console.log("AUTH", JSON.stringify(payload.authorization));

try {
  const out = await settleOnChain(payload, req);
  console.log("SETTLED", JSON.stringify(out));
} catch (e) {
  console.log("REVERTED", e?.message ?? String(e));
  if (e?.deployHash) console.log("DEPLOY", e.deployHash);
}
`,
  ],
  { cwd: "/Users/sidharthp/Documents/Projects/x402-research/agentifyos/apps/web", encoding: "utf8", timeout: 180000 },
);
console.log(r.stdout);
console.error(r.stderr?.slice(-1500));
