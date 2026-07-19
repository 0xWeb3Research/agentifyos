import { CopyRow } from "./copy";
import { Chip } from "./ui";
import {
  CSPR,
  ROLE_ACCOUNTS,
  explorerAccount,
  explorerContractPackage,
} from "@/lib/config";

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

// Everything AgentifyOS touches on-chain, straight from runtime config — so what
// this page shows is what the running instance actually signs and settles with.
export function AddressBook() {
  return (
    <div className="flex min-w-0 flex-col gap-4">
      {ROLE_ACCOUNTS.map((a) => (
        <Panel key={a.role} title={a.title} note={a.blurb}>
          <CopyRow
            label="public key"
            value={a.publicKey}
            href={explorerAccount(a.publicKey)}
          />
          <CopyRow label="account hash" value={a.accountHash} />
        </Panel>
      ))}

      <Panel
        title="WCSPR contract"
        note="the CEP-18 token every tool is priced in"
      >
        <CopyRow
          label="package hash"
          value={CSPR.wcsprPackageHash}
          href={explorerContractPackage(CSPR.wcsprPackageHash)}
        />
        <CopyRow label="symbol" value={`${CSPR.asset.symbol} · ${CSPR.asset.name}`} mono={false} />
        <CopyRow
          label="decimals"
          value={`${CSPR.asset.decimals}  (1 WCSPR = 1,000,000,000 atomic units)`}
        />
        <CopyRow label="entry point" value="transfer_with_authorization" />
      </Panel>

      <Panel title="Network" note="testnet only — nothing here touches mainnet">
        <CopyRow label="chain name" value={CSPR.chainName} />
        <CopyRow label="caip-2 id" value={CSPR.network} />
        <CopyRow label="json-rpc" value={CSPR.rpc} />
        <CopyRow label="explorer" value={CSPR.explorerBase} href={CSPR.explorerBase} />
        <CopyRow
          label="faucet"
          value={`${CSPR.explorerBase}/tools/faucet`}
          href={`${CSPR.explorerBase}/tools/faucet`}
        />
      </Panel>

      <p className="flex flex-wrap items-center gap-2 text-[13px] leading-relaxed text-fg-secondary">
        <Chip tone="success">public</Chip>
        Every value above is safe to share. The matching private keys are PEM files
        that never leave the machine running the facilitator.
      </p>
    </div>
  );
}
