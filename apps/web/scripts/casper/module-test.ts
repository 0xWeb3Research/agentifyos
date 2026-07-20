// Offline round-trip of the real casper.ts module: sign a payment, verify it,
// and confirm tampering is rejected (using real keys, no chain).
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
if (payload.signature.length !== 130) throw new Error("signature not 65 bytes: " + payload.signature.length / 2);
console.log("  signature len:", payload.signature.length / 2, "bytes");

const ok = verifyPayment(payload, req);
if (!ok.valid) throw new Error("expected valid, got: " + ok.reason);
console.log("  ✓ signed payment verifies (payer " + ok.payer.slice(0, 12) + "…)");

// Guard clauses: field mismatches are rejected before any crypto runs.
const tampered = { ...payload, authorization: { ...payload.authorization, value: "999" } };
const bad = verifyPayment(tampered, req);
if (bad.valid) throw new Error("tampered payment verified!");
console.log("  ✓ tampered amount rejected (guard): " + bad.reason);

const wrongReq = { ...req, amount: "1" };
const bad2 = verifyPayment(payload, wrongReq);
if (bad2.valid) throw new Error("amount mismatch not caught");
console.log("  ✓ requirement amount mismatch rejected (guard): " + bad2.reason);

// Signature path proper: the cases below pass every guard clause, so rejection
// can only come from the digest + verifySignature step, the crypto that
// actually gates settleOnChain.

// Amount tampered CONSISTENTLY in payload and requirements: all field guards
// pass, but the recomputed digest no longer matches what was signed.
const resigned = {
  ...payload,
  authorization: { ...payload.authorization, value: "999" },
};
const badSig1 = verifyPayment(resigned, { ...req, amount: "999" });
if (badSig1.valid) throw new Error("forged amount passed signature verification!");
if (badSig1.reason !== "invalid_signature") throw new Error("expected invalid_signature, got: " + badSig1.reason);
console.log("  ✓ consistently tampered amount rejected by signature check: " + badSig1.reason);

// Bit-flipped signature over an otherwise valid payload (verifySignature may
// return false or throw; both must read as invalid).
const flipped =
  payload.signature.slice(0, -2) +
  (parseInt(payload.signature.slice(-2), 16) ^ 0x01).toString(16).padStart(2, "0");
const badSig2 = verifyPayment({ ...payload, signature: flipped }, req);
if (badSig2.valid) throw new Error("bit-flipped signature verified!");
if (badSig2.reason !== "invalid_signature") throw new Error("expected invalid_signature, got: " + badSig2.reason);
console.log("  ✓ bit-flipped signature rejected: " + badSig2.reason);

// Structurally invalid signature (wrong length garbage): exercises the
// throw-on-bad-sig path that verifyPayment must treat as invalid, not crash.
const badSig3 = verifyPayment({ ...payload, signature: "deadbeef" }, req);
if (badSig3.valid) throw new Error("garbage signature verified!");
if (badSig3.reason !== "invalid_signature") throw new Error("expected invalid_signature, got: " + badSig3.reason);
console.log("  ✓ malformed signature rejected (throw path): " + badSig3.reason);

// Payment redirected to a different payee than the one signed.
const redirected = { ...payload, authorization: { ...payload.authorization, to: "00" + "33".repeat(32) } };
const badSig4 = verifyPayment(redirected, { ...req, payTo: "00" + "33".repeat(32) });
if (badSig4.valid) throw new Error("redirected payee passed signature verification!");
if (badSig4.reason !== "invalid_signature") throw new Error("expected invalid_signature, got: " + badSig4.reason);
console.log("  ✓ redirected payee rejected by signature check: " + badSig4.reason);

console.log("\n  real casper.ts sign/verify verified offline ✅");
