import Link from "next/link";
import { chainMeta, settlementChainFor } from "@/lib/chain";
import { getNetworkId } from "@/lib/chain-server";
import { Arrow } from "./ui";

/**
 * The band that appears when Midnight is the selected network.
 *
 * Selecting Midnight has to change more than a badge, or the switcher is
 * decorative. It also must not overstate what changed: Nightpass proves access,
 * it does not move money, so the band names the chain still settling underneath
 * rather than letting a reader assume payments moved to tNIGHT.
 *
 * Rendered once in the layout, so every page reflects the choice.
 */
export async function NetworkBanner() {
  const network = await getNetworkId();
  if (network !== "midnight") return null;

  const settles = chainMeta(settlementChainFor(network));

  return (
    <div className="border-b border-border bg-tint">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:gap-4 sm:px-6">
        <span className="label shrink-0 text-accent">midnight preview</span>
        <p className="min-w-0 text-[13px] leading-snug text-fg-secondary">
          Access is proved in zero knowledge, so a tool call reveals no buyer.
          Payment still settles in {settles.symbol} on {settles.name}.
        </p>
        <Link
          href="/shielded"
          className="press label group ml-auto inline-flex shrink-0 items-center gap-1.5 text-fg hover:text-accent"
        >
          shielded ledger
          <Arrow className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </Link>
      </div>
    </div>
  );
}
