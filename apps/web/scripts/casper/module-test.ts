// Offline round-trip of the real casper.ts module: sign a payment, verify it,
// and confirm tampering is rejected — using real keys, no chain.
// Run: pnpm exec tsx scripts/casper/module-test.ts
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadWalletFromFile,
  signPayment,
  verifyPayment,
  type CasperPaymentRequirements,
} from "../../src/lib/x402/casper";

const here = dirname(fileURLToPath(import.meta.url));
const agent = await loadWalletFromFile(join(here, "..", "..", "keys", "agent.pem"));
const payeeHash = "00" + "22".repeat(32);

const req: CasperPaymentRequirements = {
  scheme: "exact",
  network: "casper:casper-test",
  amount: "865800866",
  asset: "3d80df21ba4ee4d66a2a1f60c32570dd5685e4b279f6538162a5fd1314847c1e",
  payTo: payeeHash,
  maxTimeoutSeconds: 60,
  extra: { name: "Wrapped CSPR", version: "1", symbol: "WCSPR", decimals: "9" },
};

const payload = signPayment(agent, req);
console.log("  agent address:", agent.address.slice(0, 14) + "…");
console.log("  signature len:", payload.signature.length / 2, "bytes");

const ok = verifyPayment(payload, req);
if (!ok.valid) throw new Error("expected valid, got: " + ok.reason);
console.log("  ✓ signed payment verifies (payer " + ok.payer.slice(0, 12) + "…)");

const tampered = { ...payload, authorization: { ...payload.authorization, value: "999" } };
const bad = verifyPayment(tampered, req);
if (bad.valid) throw new Error("tampered payment verified!");
console.log("  ✓ tampered amount rejected: " + bad.reason);

const wrongReq = { ...req, amount: "1" };
const bad2 = verifyPayment(payload, wrongReq);
if (bad2.valid) throw new Error("amount mismatch not caught");
console.log("  ✓ requirement amount mismatch rejected: " + bad2.reason);

console.log("\n  real casper.ts sign/verify verified offline ✅");
