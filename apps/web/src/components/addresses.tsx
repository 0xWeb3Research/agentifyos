import { CopyRow } from "./copy";
import { Chip } from "./ui";
import { ALGO, CSPR, explorerAccount, explorerAsset, roleAccounts } from "@/lib/config";
import { getChain } from "@/lib/chain-server";

function Panel({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-[var(--radius-card)] border border-border bg-surface">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border px-4 py-3 sm:px-5">
        <h3 className="text-[15px] font-medium tracking-[-0.01em]">{title}</h3>
        {note && <p className="text-[13px] text-fg-secondary">{note}</p>}
      </header>
      <div className="divide-y divide-border px-4 py-1 sm:px-5">{children}</div>
    </section>
  );
}

// Everything AgentifyOS touches on-chain, straight from runtime config, so what
// this page shows is what the running instance actually signs and settles with.
export async function AddressBook() {
  const chain = await getChain();
  const casper = chain.id === "casper";
  return (
    <div className="flex min-w-0 flex-col gap-4">
      {roleAccounts(chain.id).map((a) => (
        <Panel key={a.role} title={a.title} note={a.blurb}>
          {a.address ? (
            <CopyRow
              label={casper ? "public key" : "address"}
              value={a.address}
              href={explorerAccount(a.address, chain.id)}
            />
          ) : (
            <CopyRow label="address" value="not configured" mono={false} />
          )}
          {a.accountHash && <CopyRow label="account hash" value={a.accountHash} />}
        </Panel>
      ))}

      {casper ? (
        <Panel title="WCSPR contract" note="the CEP-18 token every tool is priced in">
          <CopyRow
            label="package hash"
            value={CSPR.wcsprPackageHash}
            href={explorerAsset(CSPR.wcsprPackageHash, "casper")}
          />
          <CopyRow label="symbol" value={`${CSPR.asset.symbol} · ${CSPR.asset.name}`} mono={false} />
          <CopyRow
            label="decimals"
            value={`${CSPR.asset.decimals}  (1 WCSPR = 1,000,000,000 atomic units)`}
          />
          <CopyRow label="entry point" value="transfer_with_authorization" />
        </Panel>
      ) : (
        <Panel title="USDC" note="the asset every tool is priced in">
          <CopyRow label="asset id" value={`ASA ${ALGO.assetId}`} href={explorerAsset(undefined, "algorand")} />
          <CopyRow label="symbol" value={`${ALGO.asset.symbol} · ${ALGO.asset.name}`} mono={false} />
          <CopyRow
            label="decimals"
            value={`${ALGO.asset.decimals}  (1 USDC = 1,000,000 atomic units)`}
          />
          <CopyRow label="scheme" value="exact · signed ASA transfer in an atomic group" mono={false} />
        </Panel>
      )}

      {!casper && (
        <Panel title="Facilitator" note="hosted by GoPlausible · verifies, settles, pays the fee">
          <CopyRow label="base url" value={ALGO.facilitatorUrl} href={ALGO.facilitatorUrl} />
          <CopyRow
            label="supported"
            value={`${ALGO.facilitatorUrl}/supported`}
            href={`${ALGO.facilitatorUrl}/supported`}
          />
          <CopyRow
            label="bazaar"
            value={`${ALGO.facilitatorUrl}/discovery/resources`}
            href={`${ALGO.facilitatorUrl}/discovery/resources`}
          />
        </Panel>
      )}

      <Panel title="Network" note="testnet only · nothing here touches mainnet">
        <CopyRow label="chain name" value={chain.networkLabel} mono={false} />
        <CopyRow label="caip-2 id" value={chain.caip2} />
        <CopyRow label="node" value={casper ? CSPR.rpc : ALGO.algod} />
        <CopyRow label="explorer" value={chain.explorerBase} href={chain.explorerBase} />
        <CopyRow label="faucet" value={chain.faucet} href={chain.faucet} />
        {!casper && (
          <CopyRow label="usdc faucet" value={ALGO.usdcFaucet} href={ALGO.usdcFaucet} />
        )}
      </Panel>

      <p className="flex flex-wrap items-center gap-2 text-[13px] leading-relaxed text-fg-secondary">
        <Chip tone="success">public</Chip>
        Every value above is safe to share. The matching secrets are{" "}
        {casper ? "PEM files" : "mnemonics"} that never leave the machine running the app.
      </p>
    </div>
  );
}
