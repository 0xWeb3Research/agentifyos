// Generate real Casper Ed25519 keypairs (PEM) for real-mode roles.
// Usage: pnpm exec tsx scripts/casper/keygen.ts [name ...]   (default: facilitator agent treasury)
// Keys are written to ../keys/<name>.pem (gitignored). Fund the printed account
// hashes via the testnet faucet — see docs/TESTNET.md.
import { mkdirSync, existsSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import CasperMod from "casper-js-sdk";

const Casper: any = (CasperMod as any).default ?? CasperMod;
const { PrivateKey, KeyAlgorithm } = Casper;

const here = dirname(fileURLToPath(import.meta.url));
const keysDir = join(here, "..", "..", "keys");
mkdirSync(keysDir, { recursive: true });

const names = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const roles = names.length ? names : ["facilitator", "agent", "treasury"];
const force = process.argv.includes("--force");

console.log("Casper Ed25519 keypairs (testnet)\n");
for (const role of roles) {
  const pemPath = join(keysDir, `${role}.pem`);
  const reuse = existsSync(pemPath) && !force;
  let priv: any;
  if (reuse) {
    priv = await PrivateKey.fromPem(readFileSync(pemPath, "utf8"), KeyAlgorithm.ED25519);
  } else {
    priv = await PrivateKey.generate(KeyAlgorithm.ED25519);
    writeFileSync(pemPath, priv.toPem(), { mode: 0o600 });
  }
  const pub = priv.publicKey;
  console.log(`  ${role.padEnd(12)} ${reuse ? "(existing)" : "(new)"}`);
  console.log(`    pem          keys/${role}.pem`);
  console.log(`    publicKey    ${pub.toHex()}`);
  console.log(`    accountHash  ${pub.accountHash().toHex()}`);
  console.log(`    explorer     https://testnet.cspr.live/account/${pub.toHex()}\n`);
}
console.log("Next: fund the facilitator (and treasury) account via the faucet — see docs/TESTNET.md §2.");
