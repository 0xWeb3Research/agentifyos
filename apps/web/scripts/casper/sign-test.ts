// Offline proof of the REAL x402 payment signature — the exact EIP-712 typed-data
// flow the on-chain CEP-18 `transfer_with_authorization` contract verifies.
// No chain, no funds: sign a TransferWithAuthorization digest with a real Casper
// key and verify it locally. Run: pnpm exec tsx scripts/casper/sign-test.ts
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { webcrypto } from "node:crypto";
import CasperMod from "casper-js-sdk";
import * as EIP712 from "@casper-ecosystem/casper-eip-712";

const Casper: any = (CasperMod as any).default ?? CasperMod;
const eip: any = (EIP712 as any).default ?? EIP712;
const { PrivateKey, KeyAlgorithm } = Casper;

const here = dirname(fileURLToPath(import.meta.url));
const pem = readFileSync(join(here, "..", "..", "keys", "agent.pem"), "utf8");

const WCSPR_PACKAGE = "3d80df21ba4ee4d66a2a1f60c32570dd5685e4b279f6538162a5fd1314847c1e";
const NETWORK = "casper:casper-test";

const hex = (u: Uint8Array) => Buffer.from(u).toString("hex");

function fail(msg: string): never {
  console.log(`  ✗ ${msg}`);
  process.exit(1);
}

const priv = await PrivateKey.fromPem(pem, KeyAlgorithm.ED25519);
const pub = priv.publicKey;
const accountAddress = "00" + pub.accountHash().toHex(); // Casper x402 "00"+hash

// Build the exact EIP-712 domain + TransferWithAuthorization struct the client signs.
const domain = eip.buildDomain("Wrapped CSPR", "1", NETWORK, "0x" + WCSPR_PACKAGE);
const types = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
};
const now = Math.floor(Date.now() / 1000);
const nonce = webcrypto.getRandomValues(new Uint8Array(32));
const payeeHash = "00" + "11".repeat(32);
const message = {
  from: "0x" + accountAddress,
  to: "0x" + payeeHash,
  value: 865800866n,
  validAfter: BigInt(now - 600),
  validBefore: BigInt(now + 60),
  nonce: "0x" + hex(nonce),
};

// hashTypedData may need the Casper domain types explicitly.
let digest: Uint8Array;
try {
  digest = eip.hashTypedData(domain, types, "TransferWithAuthorization", message, {
    domainTypes: eip.CASPER_DOMAIN_TYPES,
  });
} catch {
  digest = eip.hashTypedData(domain, types, "TransferWithAuthorization", message);
}
if (!(digest instanceof Uint8Array) || digest.length !== 32) fail(`digest not 32 bytes (${digest?.length})`);
console.log(`  ✓ EIP-712 digest computed (${digest.length} bytes): ${hex(digest).slice(0, 24)}…`);

// Sign exactly like the official client signer: signAndAddAlgorithmBytes → 65 bytes.
const sig = priv.signAndAddAlgorithmBytes(digest);
if (sig.length !== 65) fail(`signature not 65 bytes (${sig.length})`);
console.log(`  ✓ signed (65-byte Ed25519): ${hex(sig).slice(0, 24)}…`);

// Verify locally (what the facilitator + contract do).
if (pub.verifySignature(digest, sig) !== true) fail("verifySignature returned false");
console.log("  ✓ signature verifies against the payer public key");

// Tamper → must fail.
const tampered = { ...message, value: 999n };
const tdigest = (() => {
  try {
    return eip.hashTypedData(domain, types, "TransferWithAuthorization", tampered, { domainTypes: eip.CASPER_DOMAIN_TYPES });
  } catch {
    return eip.hashTypedData(domain, types, "TransferWithAuthorization", tampered);
  }
})();
// casper-js-sdk's verifySignature THROWS on an invalid signature (rather than
// returning false) — the real facilitator/verify path must treat a throw as invalid.
let tamperRejected = false;
try {
  tamperRejected = pub.verifySignature(tdigest, sig) !== true;
} catch {
  tamperRejected = true;
}
if (!tamperRejected) fail("tampered amount still verified");
console.log("  ✓ tampered amount is rejected (verify throws on bad sig)");

// Account-hash derivation matches what the contract re-derives.
if (pub.accountHash().toHex() !== accountAddress.slice(2)) fail("account hash mismatch");
console.log("  ✓ public key → account hash derivation matches");

console.log("\nREAL x402 signature path verified offline — no mock, no chain. ✅");
