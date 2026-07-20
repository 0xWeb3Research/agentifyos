// Generate real Casper Ed25519 keypairs (PEM) for real-mode roles.
// Usage: pnpm exec tsx scripts/casper/keygen.ts [name ...]   (default: facilitator agent treasury)
//        pnpm exec tsx scripts/casper/keygen.ts <name> --force   (rotate ONE named key)
// Keys are written to ../keys/<name>.pem (gitignored). Fund the printed account
// hashes via the testnet faucet (see docs/TESTNET.md).
//
// Existing keys are NEVER overwritten by default: they control funded testnet
// accounts and have no mnemonic or backup. `--force` requires (a) explicitly
// named roles (it refuses to rotate the whole default set at once) and
// (b) CASPER_KEYGEN_FORCE=yes in the env; the old PEM is copied to
// keys/<role>.pem.bak-<n> before the new key is written.
import { chmodSync, copyFileSync, mkdirSync, existsSync, writeFileSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import CasperMod from "casper-js-sdk";

const Casper: any = (CasperMod as any).default ?? CasperMod;
const { PrivateKey, KeyAlgorithm } = Casper;

const here = dirname(fileURLToPath(import.meta.url));
const keysDir = join(here, "..", "..", "keys");
// 0o700: private keys live here, and chmod too, since mkdir's mode only
// applies when the directory is created.
mkdirSync(keysDir, { recursive: true, mode: 0o700 });
chmodSync(keysDir, 0o700);

const names = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const roles = names.length ? names : ["facilitator", "agent", "treasury"];
const force = process.argv.includes("--force");

if (force && !names.length) {
  console.error("✗ --force overwrites funded wallet keys. Name the role(s) to rotate explicitly, e.g.:");
  console.error("    pnpm exec tsx scripts/casper/keygen.ts agent --force");
  process.exit(1);
}
if (force && process.env.CASPER_KEYGEN_FORCE !== "yes") {
  console.error("✗ --force irreversibly rotates keys that control funded testnet accounts.");
  console.error("  Set CASPER_KEYGEN_FORCE=yes to confirm (the old PEM is backed up to keys/<role>.pem.bak-<n> first).");
  process.exit(1);
}

// Deterministic backup name: first free .bak-<n> counter (no timestamps).
function backupPath(pemPath: string): string {
  for (let n = 1; ; n++) {
    const candidate = `${pemPath}.bak-${n}`;
    if (!existsSync(candidate)) return candidate;
  }
}

console.log("Casper Ed25519 keypairs (testnet)\n");
for (const role of roles) {
  const pemPath = join(keysDir, `${role}.pem`);
  const exists = existsSync(pemPath);
  const reuse = exists && !force;
  let priv: any;
  let backup: string | undefined;
  if (reuse) {
    priv = await PrivateKey.fromPem(readFileSync(pemPath, "utf8"), KeyAlgorithm.ED25519);
    chmodSync(pemPath, 0o600); // repair loose perms on keys provisioned out-of-band
  } else {
    if (exists) {
      backup = backupPath(pemPath);
      copyFileSync(pemPath, backup);
      chmodSync(backup, 0o600);
    }
    priv = await PrivateKey.generate(KeyAlgorithm.ED25519);
    writeFileSync(pemPath, priv.toPem(), { mode: 0o600 });
    chmodSync(pemPath, 0o600); // writeFileSync's mode is ignored when the file already existed
  }
  const pub = priv.publicKey;
  console.log(`  ${role.padEnd(12)} ${reuse ? "(existing)" : backup ? "(rotated)" : "(new)"}`);
  console.log(`    pem          keys/${role}.pem`);
  if (backup) console.log(`    old key      keys/${basename(backup)}  (previous PEM preserved)`);
  console.log(`    publicKey    ${pub.toHex()}`);
  console.log(`    accountHash  ${pub.accountHash().toHex()}`);
  console.log(`    explorer     https://testnet.cspr.live/account/${pub.toHex()}\n`);
}
console.log("Next: fund the facilitator (and treasury) account via the faucet (see docs/TESTNET.md §2).");
