/*
 * Server-side reader for the Nightpass contract on Midnight.
 *
 * This deliberately reads the PUBLIC half of the contract and nothing else,
 * which is the point being demonstrated: anyone can audit the market without a
 * wallet, a proof server, or permission, and still learn nothing about who
 * called what. It is a plain GraphQL fetch against the public indexer, so the
 * deployed site can render live state without shipping a wallet stack.
 */

import "server-only";
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

export type NightpassNetwork = "preview" | "preprod";

export type NightpassDeployment = {
  network: NightpassNetwork;
  contractAddress: string;
  deployTxId?: string;
  deployedAt: string;
  compiler: string;
};

export type NightpassTool = {
  toolId: string;
  slug: string | null;
  priceAtomic: bigint;
  quota: bigint;
  active: boolean;
  callsServed: bigint;
  publisherCommitment: string;
};

export type NightpassState = {
  deployment: NightpassDeployment;
  tools: NightpassTool[];
  passesIssued: bigint;
  callsRedeemed: bigint;
  attestations: bigint;
  readAt: string;
};

const INDEXERS: Record<NightpassNetwork, string> = {
  preview: "https://indexer.preview.midnight.network/api/v3/graphql",
  preprod: "https://indexer.preprod.midnight.network/api/v3/graphql",
};

export const explorerUrl = (network: NightpassNetwork, address: string): string =>
  `https://explorer.midnight.network/${network}/contract/${address}`;

/*
 * Tool ids are sha256 of the marketplace slug. The chain stores only the hash,
 * so names are recovered by hashing the known catalog and matching, exactly as
 * any third party could. Anything unrecognised stays an opaque id rather than
 * being invented.
 */
const KNOWN_SLUGS = [
  "algo-market-data",
  "page-scraper",
  "text-summarizer",
  "rwa-attestor",
  "sentiment-scan",
  "onchain-oracle",
];

const slugByHash = new Map(
  KNOWN_SLUGS.map((slug) => [createHash("sha256").update(slug).digest("hex"), slug]),
);

const DEPLOYMENT_FILE = path.resolve(process.cwd(), "..", "..", "midnight", "deployment.json");

export function readDeployment(network: NightpassNetwork): NightpassDeployment | null {
  const fromEnv = process.env.NIGHTPASS_CONTRACT;
  if (fromEnv) {
    return {
      network,
      contractAddress: fromEnv,
      deployedAt: "configured via NIGHTPASS_CONTRACT",
      compiler: "0.31.1",
    };
  }
  if (!existsSync(DEPLOYMENT_FILE)) return null;
  try {
    const all = JSON.parse(readFileSync(DEPLOYMENT_FILE, "utf8")) as Record<
      string,
      NightpassDeployment
    >;
    return all[network] ?? null;
  } catch {
    return null;
  }
}

const CONTRACT_STATE_QUERY = `
  query ContractState($address: HexEncoded!) {
    contractAction(address: $address) {
      state
    }
  }
`;

const hex = (b: Uint8Array): string => Buffer.from(b).toString("hex");

/**
 * Reads and decodes live contract state. Returns null rather than throwing when
 * the contract is not deployed or the indexer is unreachable, so the page can
 * say so plainly instead of failing the render.
 */
export async function readNightpassState(
  network: NightpassNetwork = "preview",
): Promise<NightpassState | null> {
  const deployment = readDeployment(network);
  if (deployment === null) return null;

  let stateHex: string | null = null;
  try {
    const res = await fetch(INDEXERS[network], {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query: CONTRACT_STATE_QUERY,
        variables: { address: deployment.contractAddress },
      }),
      // The ledger moves on every call, so a short window keeps the page live
      // without hammering the indexer on every request.
      next: { revalidate: 15 },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      data?: { contractAction?: { state?: string } | null };
    };
    stateHex = body.data?.contractAction?.state ?? null;
  } catch {
    return null;
  }
  if (!stateHex) return null;

  try {
    // Imported lazily: these carry WASM and must never reach the client bundle.
    const { ContractState } = await import("@midnight-ntwrk/midnight-js-protocol/compact-runtime");
    const { setNetworkId } = await import("@midnight-ntwrk/midnight-js/network-id");
    const { Nightpass } = await import("@nightpass/contract");

    setNetworkId(network);
    const contractState = ContractState.deserialize(Uint8Array.from(Buffer.from(stateHex, "hex")));
    const ledger = Nightpass.ledger(contractState.data);

    const tools: NightpassTool[] = [];
    for (const [id, tool] of ledger.tools) {
      const toolId = hex(id);
      tools.push({
        toolId,
        slug: slugByHash.get(toolId) ?? null,
        priceAtomic: tool.priceAtomic,
        quota: tool.quota,
        active: tool.active,
        callsServed: ledger.callsServed.member(id) ? ledger.callsServed.lookup(id) : 0n,
        publisherCommitment: hex(tool.publisherCommitment),
      });
    }
    tools.sort((a, b) => Number(b.callsServed - a.callsServed));

    return {
      deployment,
      tools,
      passesIssued: ledger.passesIssued,
      callsRedeemed: ledger.spentCalls.size(),
      attestations: ledger.attestations.size(),
      readAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
