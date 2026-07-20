// Read the installed ToolRegistry's on-chain addresses from the treasury
// account's named keys.
//
//   pnpm casper:registry-info
import { TESTNET, loadRoleWallet } from "../../src/lib/x402/casper";

async function rpc(method: string, params: unknown) {
  const res = await fetch(TESTNET.rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  return res.json();
}

async function main() {
  const treasury = loadRoleWallet("treasury");
  const accountHash = `account-hash-${treasury.accountHash}`;

  const root = (await rpc("chain_get_state_root_hash", {}))?.result?.state_root_hash;
  const acct = await rpc("state_get_item", {
    state_root_hash: root,
    key: accountHash,
    path: [],
  });

  const named: { name: string; key: string }[] =
    acct?.result?.stored_value?.Account?.named_keys ?? [];

  const find = (n: string) => named.find((k) => k.name === n)?.key;
  const pkg = find("tool_registry_package");
  const contract = find("tool_registry_contract");

  console.log("AgentifyOS ToolRegistry · Casper testnet\n");
  console.log(`  owner account   ${treasury.publicKeyHex}`);
  console.log(`  package         ${pkg ?? "(not found — is it installed?)"}`);
  console.log(`  contract        ${contract ?? "(not found)"}`);

  if (pkg) {
    const hash = pkg.replace(/^hash-/, "");
    console.log(`\n  explorer  ${TESTNET.explorerBase}/contract-package/${hash}`);

    // Confirm the entry points the node actually exposes.
    const pkgState = await rpc("state_get_item", {
      state_root_hash: root,
      key: `hash-${hash}`,
      path: [],
    });
    const versions =
      pkgState?.result?.stored_value?.Package?.versions ??
      pkgState?.result?.stored_value?.ContractPackage?.versions ??
      [];
    const latest = versions[versions.length - 1];
    if (latest) {
      console.log(`  version   ${latest.contract_version} → ${latest.contract_hash}`);
      const c = await rpc("state_get_item", {
        state_root_hash: root,
        key: latest.contract_hash,
        path: [],
      });
      const eps = c?.result?.stored_value?.Contract?.entry_points ?? [];
      console.log(`  entry points:`);
      for (const e of eps) {
        const args = (e.args ?? []).map((a: any) => `${a.name}: ${JSON.stringify(a.cl_type)}`);
        console.log(`    ${e.name}(${args.join(", ")})`);
      }
    }
    console.log(`\n  Set in .env:  TOOL_REGISTRY_PACKAGE_HASH=${hash}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
