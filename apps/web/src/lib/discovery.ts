// One machine-readable record per paid resource, shared by the discovery feed
// and the search endpoint so an agent never sees two descriptions of the same
// listing. Everything payment-related is derived from the active chain, so the
// price an agent reads here is the price the 402 will quote.
import { ALGO, resolvePayTo } from "./config";
import { chainMeta, toAtomic, type ChainId } from "./chain";
import type { ToolWithStats } from "./types";

export interface DiscoveryResource {
  resource: string;
  type: "http";
  name: string;
  description: string;
  network: string;
  scheme: "exact";
  asset: string;
  payTo: string;
  facilitator: string | null;
  price: {
    event: string;
    usd: number;
    amount: string;
    symbol: string;
    decimals: number;
    freeTrial: boolean;
  };
  input: ToolWithStats["input"];
  output: ToolWithStats["output"];
  outputExample: unknown;
  capabilities: ToolWithStats["capabilities"];
  status: ToolWithStats["status"];
  publisher: string;
  stats: { calls: number; buyers: number; successRate: number };
}

export function toDiscoveryResource(tool: ToolWithStats, on: ChainId): DiscoveryResource {
  const event = tool.priceEvents[0];
  const chain = chainMeta(on);
  return {
    resource: "/api/t/" + tool.slug,
    type: "http",
    name: tool.name,
    description: tool.tagline,
    network: chain.caip2,
    scheme: "exact",
    asset: chain.assetRef,
    payTo: resolvePayTo(tool.publisher.payTo, on),
    // Who settles the payment. On Algorand that is a third party an agent can
    // check for itself; on Casper we run our own, so there is nothing to name.
    facilitator: on === "algorand" ? ALGO.facilitatorUrl : null,
    price: {
      event: event.name,
      usd: event.usd,
      amount: toAtomic(event.usd, on),
      symbol: chain.symbol,
      decimals: chain.decimals,
      freeTrial: !!event.freeTrial,
    },
    input: tool.input,
    output: tool.output,
    outputExample: tool.outputExample,
    capabilities: tool.capabilities,
    status: tool.status,
    publisher: tool.publisher.handle,
    stats: {
      calls: tool.stats.totalCalls,
      buyers: tool.stats.distinctBuyers,
      successRate: tool.stats.successRate,
    },
  };
}
