// Prove the wallet sign-in flow works end to end, headlessly.
//
// A Casper Wallet signs `"Casper Message:\n" + message`. We reproduce exactly
// that with a local PEM key, so this test exercises the same verification path a
// real wallet signature takes. No extension needed.
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import CasperMod from "casper-js-sdk";
import {
  CASPER_MESSAGE_PREFIX,
  createChallenge,
  consumeNonce,
  issueSession,
  nonceOf,
  readSession,
  revokeSessions,
  verifySignedMessage,
} from "../src/lib/auth/siwx";

const C: any = (CasperMod as any).default ?? CasperMod;
const { PrivateKey, KeyAlgorithm } = C;

const here = dirname(fileURLToPath(import.meta.url));
let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean, extra = "") => {
  if (ok) {
    pass++;
    console.log(`  ✓ PASS  ${name}`);
  } else {
    fail++;
    console.log(`  ✗ FAIL  ${name} ${extra}`);
  }
};

console.log("\nSign-In With Casper · offline verification\n");

const priv = PrivateKey.fromPem(
  (await import("node:fs")).readFileSync(join(here, "..", "keys", "agent.pem"), "utf8"),
  KeyAlgorithm.ED25519,
);
const pub = priv.publicKey;
const publicKeyHex = pub.toHex();

// 1. issue a challenge
const challenge = await createChallenge({
  domain: "localhost:8402",
  uri: "http://localhost:8402",
  accountHash: "00" + pub.accountHash().toHex(),
});
check("challenge contains a nonce", !!nonceOf(challenge.message));

// 2. sign it exactly as a wallet would (prefix + message, unhashed)
const preimage = Buffer.from(CASPER_MESSAGE_PREFIX + challenge.message, "utf8");
const signature = Buffer.from(priv.signAndAddAlgorithmBytes(preimage)).toString("hex");
check("signature is 65 bytes (algo tag + 64)", signature.length / 2 === 65);

// 3. verify
const good = verifySignedMessage(publicKeyHex, challenge.message, signature);
check("wallet-style signature verifies", good.ok, good.reason ?? "");
check(
  "recovered account hash matches the signer",
  good.accountHash === pub.accountHash().toHex(),
);

// 4. a bare 64-byte signature is tolerated (tag re-attached)
const bare = signature.slice(2);
check("bare 64-byte signature also verifies", verifySignedMessage(publicKeyHex, challenge.message, bare).ok);

// 5. tampering must fail
const tampered = challenge.message.replace(/Nonce: [0-9a-f]+/, "Nonce: " + "0".repeat(32));
check("tampered message is rejected", !verifySignedMessage(publicKeyHex, tampered, signature).ok);

// 6. a different key must fail
const other = PrivateKey.generate(KeyAlgorithm.ED25519);
check(
  "another account's key is rejected",
  !verifySignedMessage(other.publicKey.toHex(), challenge.message, signature).ok,
);

// 7. nonce is single-use (replay protection)
const n = nonceOf(challenge.message)!;
check("nonce burns on first use", await consumeNonce(n, challenge.message));
check("replaying the same nonce fails", !(await consumeNonce(n, challenge.message)));

// 7b. the signed body is bound to the exact issued message: a recomposed body
// carrying a valid nonce is rejected, and the genuine challenge stays live.
const bound = await createChallenge({
  domain: "localhost:8402",
  uri: "http://localhost:8402",
  accountHash: "00" + pub.accountHash().toHex(),
});
const boundNonce = nonceOf(bound.message)!;
const forgedBody = bound.message + "\nEXTRA: attacker-appended line";
check("recomposed message with a valid nonce is rejected", !(await consumeNonce(boundNonce, forgedBody)));
check("the genuine challenge is still live after a rejected recomposition", await consumeNonce(boundNonce, bound.message));

// 8. session round-trip + tamper resistance
const token = issueSession({
  publicKey: publicKeyHex,
  accountHash: good.accountHash!,
  address: good.address!,
});
check("session token round-trips", readSession(token)?.accountHash === good.accountHash);
check("forged session token is rejected", readSession(token.split(".")[0] + ".forged") === null);

// 9. sign-out revokes outstanding tokens, not just the cookie
revokeSessions(good.accountHash!);
check("a token issued before sign-out stops verifying", readSession(token) === null);
// The revocation epoch is `<=`, so a token minted in the same millisecond as
// sign-out also dies; wait a tick so a genuinely-later token has iat > cutoff.
await new Promise((r) => setTimeout(r, 5));
const fresh = issueSession({
  publicKey: publicKeyHex,
  accountHash: good.accountHash!,
  address: good.address!,
});
check("a token issued after sign-out still verifies", readSession(fresh)?.accountHash === good.accountHash);

console.log(`\n${pass}/${pass + fail} passed\n`);
process.exit(fail ? 1 : 0);
