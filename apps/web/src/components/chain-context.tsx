"use client";

import { createContext, useContext } from "react";
import {
  chainMeta,
  defaultChain,
  explorerAccount as explorerAccountFor,
  explorerAsset as explorerAssetFor,
  explorerTx as explorerTxFor,
  facilitatorReceipt as facilitatorReceiptFor,
  fromAtomic as fromAtomicFor,
  toAtomic as toAtomicFor,
  type ChainId,
  type ChainMeta,
} from "@/lib/chain";

// The chain a client component should render. Seeded by the root layout from
// the request cookie, so the browser never disagrees with the server about
// which chain is settling. The default is only the value React uses before a
// provider is mounted, which should not happen inside the app shell.
const ChainContext = createContext<ChainMeta>(defaultChain);

export function ChainProvider({
  id,
  children,
}: {
  id: ChainId;
  children: React.ReactNode;
}) {
  return <ChainContext.Provider value={chainMeta(id)}>{children}</ChainContext.Provider>;
}

/** The active chain's display metadata. */
export function useChain(): ChainMeta {
  return useContext(ChainContext);
}

/**
 * The chain-aware helpers, bound to the active chain.
 *
 * Client components used to call `explorerTx(hash)` and get whatever the build
 * default was. Going through the hook means a link follows the visitor's choice
 * rather than the deployment's.
 */
export function useChainLinks() {
  const chain = useChain();
  return {
    chain,
    explorerTx: (txId: string) => explorerTxFor(txId, chain.id),
    explorerAccount: (address: string) => explorerAccountFor(address, chain.id),
    explorerAsset: (ref?: string) => explorerAssetFor(ref, chain.id),
    facilitatorReceipt: (txId: string) => facilitatorReceiptFor(txId, chain.id),
    toAtomic: (usd: number) => toAtomicFor(usd, chain.id),
    fromAtomic: (atomic: string | number | bigint) => fromAtomicFor(atomic, chain.id),
  };
}
