# AgentifyOS

## The marketplace where AI agents shop for tools

**A two-sided tool market for autonomous agents, settled with x402 on the Casper Network**

Version 1.0 · July 2026 · [agentifyos.xyz](https://agentifyos.xyz)

---

## Abstract

Autonomous agents are becoming economic actors, but the infrastructure they inherit was built for humans: API keys assume a person signed up, card payments break below thirty cents, and subscriptions assume a relationship rather than a transaction. The x402 protocol (HTTP 402 revived as a machine-payable standard, now governed by the Linux Foundation with forty member organizations including Visa, Mastercard, Google, AWS, and Stripe) solves the *rail*. It does not solve the *market*. Independent measurement shows that most x402 volume to date has been artificial, and until mid-2026 the protocol had only about two thousand payable endpoints. The bottleneck is not demand infrastructure; it is inventory and trust.

AgentifyOS is a marketplace built for that gap. Developers publish paid HTTP tools from a single manifest that becomes, simultaneously, a human-readable listing, a machine-readable discovery record, and an MCP tool. Agents discover tools over HTTP, MCP, or `llms.txt`, pay per call using the x402 `exact` scheme, and settle on the Casper Network via a gasless `transfer_with_authorization` on a CEP-18 token: the paying agent holds zero CSPR. Reputation is derived exclusively from the settlement ledger: **the payment is the review.** The full loop is live on Casper testnet today, with on-chain deploy hashes any reader can verify. This paper describes the design, the settlement layer, the economics, and the launch plan from testnet proof to a self-sustaining machine economy.

---

## 1. Motivation: software became a customer

For thirty years, every payment on the internet has assumed a human is present. Four layers of that assumption now fail at once:

| Layer | Built for humans | Fails for agents because |
|---|---|---|
| **Identity** | API keys, sign-up forms, OAuth consent screens | There is no person to fill in the form. Keys are provisioned ahead of time, for services someone predicted the agent would need. |
| **Payment** | Card networks, ~$0.30 + 2.9% per transaction | A $0.003 API call cannot carry a thirty-cent toll. Sub-cent commerce is physically unservable on card rails. |
| **Risk** | Chargebacks, fraud scoring, 3-D Secure | Dispute flows assume a cardholder who can answer a challenge. |
| **Packaging** | Monthly subscriptions, seat licenses | An agent needs one call, now. Not a relationship. |

HTTP anticipated this. Status code **402 Payment Required** was reserved "for future use" in the 1997 specification and sat dormant for twenty-eight years [1]. In May 2025, Coinbase open-sourced **x402**, an open standard that makes 402 operational: a server answers an unpaid request with machine-readable payment requirements; the client signs a payment authorization and retries; a facilitator verifies and settles on-chain; the server returns the result with a receipt [2]. Version 2 shipped in December 2025 [3], and on July 14, 2026 the protocol moved under neutral governance: the **x402 Foundation**, operationally launched within the Linux Foundation with forty member organizations across payments, cloud, and crypto (Visa, Mastercard, American Express, Google, AWS, Stripe, Cloudflare, Coinbase, Shopify, and thirty-one others). The Casper Association is an Associate member [4].

The rail is real, standardized, and institutionally backed. Cloudflare and AWS both settle x402 at the edge [5][6]; Vercel wired it into MCP tooling [7]; Google's Agent Payments Protocol carries an x402 extension [8]. Meanwhile the interface layer standardized in parallel: the Model Context Protocol (donated to the Linux Foundation's Agentic AI Foundation in December 2025) passed ten thousand active public servers and ninety-seven million monthly SDK downloads [9], with more than twenty-two thousand servers indexed by mid-2026 [10]. Both halves of the machine economy's plumbing (how agents *connect* to tools and how they *pay* for them) now live under the same neutral foundation umbrella.

What has not standardized is where an agent goes to *shop*.

## 2. The gap: rails without inventory

The forecasts are enormous. Gartner expects AI agents to intermediate 90% of B2B buying by 2028, channeling more than **$15 trillion** through agent exchanges [11], and modeled machine customers influencing or participating in **$30 trillion** of purchases by 2030 [12]. McKinsey sizes agent-orchestrated consumer commerce at **$3–5 trillion globally by 2030** [13]. And the early signal is measurable: AI touched **$67 billion** of Cyber Week 2025 sales [14], and AI-referred traffic to retail sites grew over 1,200% in a single year [15].

The measured on-chain reality is humbler, and more instructive. By July 2026 x402 trackers showed on the order of 157 million cumulative transactions and ~$41M in raw settled volume [16]. But a joint Visa–Artemis study that excluded wash trading, self-dealing, and test traffic put **adjusted lifetime volume at roughly $15 million** [17]; independent measurement earlier in the year found genuine volume near **$28,000 per day**, with roughly half of all transactions artificial [18]. Quality is improving (payments over $1 rose from 49% to 95% of volume in a year, and tester-to-payer conversion improved fourfold [19]), but the eight-orders-of-magnitude gap between forecast and genuine volume is the honest starting point for anyone building here.

Why does the gap exist? Not for lack of buyers or rails. Until June 30, 2026, the entire x402 ecosystem offered approximately **two thousand payable endpoints**. Then a single supplier, Apify, connected its catalog and expanded payable supply **tenfold overnight** [20]. The lesson generalizes:

> A market needs three things: rails, inventory, and trust. x402 shipped the rails. The inventory and the trust are still missing. And they are marketplace problems, not protocol problems.

That is the problem AgentifyOS exists to solve, on a settlement layer purpose-built for machine actors.

## 3. The marketplace

AgentifyOS is a two-sided market in which the customer is an autonomous agent. Five actors appear throughout this paper:

- **Publisher**: a developer who lists a paid HTTP tool. Identity is a Casper wallet; the payout address *is* the account.
- **Agent**: the buyer. Holds its own Ed25519 keypair and a metered budget. Never holds gas.
- **Marketplace**: catalog, discovery, schemas, and stats. Never custodies funds.
- **Facilitator**: verifies signed payment authorizations and submits settlements on-chain, absorbing gas.
- **Casper Network**: the settlement layer and the source of truth for reputation.

### 3.1 One manifest, three surfaces

A publisher describes a tool once (name, schema, price-per-event, payout address) and the manifest projects into three surfaces simultaneously:

1. **A catalog listing** humans can browse at `agentifyos.xyz/tools`.
2. **A discovery record** served from `/api/discovery/resources`: machine-readable x402 `PaymentRequirements` plus input/output schemas, capabilities, and ledger-derived stats.
3. **An MCP tool**: the same manifest mounted through the marketplace's MCP endpoint, callable from Claude, Cursor, or any MCP host, with payment handled by the same x402 handshake underneath.

`llms.txt` ties the surfaces together as the agent-facing front door: every tool, its price, and its 402 endpoint in a format any crawler or agent can consume. Publishing takes about sixty seconds; nothing about a listing requires review queues, because trust does not come from the listing.

### 3.2 The payment is the review

Marketplaces built on star ratings import every pathology of human review systems, and agents can neither write nor read them honestly. AgentifyOS derives reputation exclusively from the settlement ledger:

- A new listing starts **unverified**. It flips to **verified** on its first on-chain settlement: proof that the tool ran and someone paid.
- Stats shown to agents (calls, unique buyers, success rate) are computed from settlements, not testimonials.
- A first-call-free sandbox lets an agent inspect real output before spending.

Because roughly half of historical x402 volume has been wash trading [18], a reputation system this literal must also be adversarial: settlement stats weigh unique payer wallets and repeat purchases, not raw counts, and the marketplace publishes adjusted rather than raw volume (§8.4).

### 3.3 The payment flow

The full loop, as implemented and live today:

1. **Discover.** The agent finds a tool via `/api/discovery/search`, MCP, or `llms.txt`.
2. **Quote.** `GET /api/t/{slug}` with no payment header returns **HTTP 402** and machine-readable requirements: scheme `exact`, network `casper:casper-test`, the WCSPR token contract, the payout address, and a validity window.
3. **Sign.** The agent constructs a `TransferWithAuthorization` typed-data payload (an EIP-712-style structure) and signs it with its Ed25519 key: off-chain, gasless, in one round trip.
4. **Verify and settle.** The facilitator checks the signature, amount, validity window, and payer balance off-chain, then submits `transfer_with_authorization` to the token contract on Casper and waits for finality. Gas is paid by the facilitator, never the agent.
5. **Deliver.** The tool executes and the response carries the result plus a receipt: settlement id, deploy hash, result hash, and an explorer link.

A replay guard binds each authorization nonce to the specific resource being purchased, claimed atomically before broadcast; on-chain, the token contract's used-nonce registry enforces the same invariant [21]. The agent-side experience is exactly four HTTP calls with no accounts, no API keys, and no human in the loop.

### 3.4 The agent runner

The marketplace ships its own proof-of-demand: `/agent` runs a server-side autonomous loop on camera. Given a task and a budget, it plans, searches the catalog, selects tools, walks each x402 handshake, threads results between tools, and stops when the task completes or the budget runs out. The same loop is reachable programmatically via `/api/agent/run` and from MCP hosts via `call_tool`, every spending path passing through the same server-enforced budget clamp (§7).

## 4. Settlement: why Casper

Marketplace and rail are separable concerns; AgentifyOS settles on Casper deliberately.

**Deterministic finality.** Casper 2.0 introduced Zug consensus: once a block is finalized, it is final, with no probabilistic reorg window for a receipt to survive [22]. The 2.1 upgrade cut block times to a maximum of ~8 seconds and introduced protocol-level burning of all transaction fees [23]. For a machine buyer, "settled" must be a fact, not a probability.

**Predictable cost.** Casper prices gas at a fixed base rate of 1 mote per gas unit, with the dynamic multiplier observed pinned at 1 on live nodes. An agent's cost model can be computed ahead of time: no auctions, no fee spikes mid-task.

**A gasless authorization primitive.** Casper's reference x402 token is a CEP-18 (fungible-token standard) contract carrying `transfer_with_authorization`, the analog of Ethereum's EIP-3009. The payer signs typed data off-chain; anyone may submit the transfer on-chain. This is the mechanism that lets the buying agent hold **zero CSPR, ever**: the treasury funds it with wrapped tokens, and the facilitator pays gas [24].

**Institutional direction.** Casper's 2026 positioning is explicitly the "trust layer for the agent economy": the Casper AI Toolkit (June 2026) shipped a production x402 facilitator, a Casper MCP server, and agent tooling (Casper's claim of being the first WASM-native L1 with live x402 payments on mainnet [25]), while the Casper Manifest roadmap commits to x402 micropayments, gasless transactions, and quantum-safe keys [26], and the Association sits in the x402 Foundation as an Associate member [4].

AgentifyOS treats the settlement rail as swappable by design (the facilitator sits behind a narrow interface), but Casper is where machine-money properties are strongest today.

## 5. Live today: on-chain proof

Everything in §3 runs now, on Casper testnet, with real cryptography end-to-end. The canonical demonstration: **an autonomous agent completed a four-tool task holding zero CSPR**, paying $0.037 metered from a $0.10 budget, across four on-chain settlements (page scrape, summarization, market data, and a signed RWA attestation), each carrying a deploy hash verifiable on `testnet.cspr.live` [21].

Selected facts a reader can check:

- **Real 402s.** `curl https://agentifyos.xyz/api/t/cspr-market-data` returns a genuine HTTP 402 with x402 v2 `PaymentRequirements`.
- **Real settlements.** The public feed at `/api/settlements` lists deploy hashes; the proof pack publishes the full table, including the treasury's wrap-and-fund transactions.
- **Zero-CSPR invariant.** Balance proofs show the agent account's CSPR balance at 0 before and after the run; only WCSPR moved, and the facilitator absorbed all gas.
- **Tuned economics.** Settlement gas was measured and budgeted down 43% (7 → 4 CSPR declared), reflecting Casper's refund-and-burn accounting, where over-declaring payment burns real money.
- **Our own contract on-chain.** The ToolRegistry contract authored for this marketplace is deployed to testnet and already anchoring manifests: `register_tool(slug, manifest_hash)` with first-writer-owns-slug semantics, verified by reading the anchored hash back out of global state.

Honesty notes, stated plainly because a marketplace's currency is trust: the settlement token is Casper's canonical reference WCSPR contract (we operate it, we did not author it); four of fourteen catalog listings are callable today, with the remainder labeled "coming soon"; and displayed catalog stats are seeded for demonstration while the settlement feed itself is real. Each of these is scheduled to close in Phase 2 (§8).

## 6. Economics

**Split.** Publishers keep **80%** of every settled call; the marketplace retains 20%. This mirrors the split under which Apify's community (the largest supply base in the adjacent web-automation market) currently earns about **$1.4M per month** across roughly three thousand monetizing developers [27]. Marketplaces that treat supply as the scarce side price this way; the 80/20 convention is proven, not aspirational.

**Pricing.** Tools price per event (per call, per item, per attestation) in USD terms, settled in WCSPR at execution. Micro-prices are the point: the reference catalog runs $0.005–$0.02 per call, two to three orders of magnitude below the minimum viable card transaction.

**Why not a centralized API hub?** The cautionary tale is RapidAPI: ~$272M raised, a $1B valuation, a claimed forty thousand APIs; then a two-year hollowing-out to "hundreds" of active listings and an asset sale [28]. A centralized hub owns both the listings and the payouts, so developer trust dies with the operator's balance sheet (RapidAPI took 20–25% and accumulated payout complaints [29]). Under x402, settlement is wallet-to-wallet on a public chain: the marketplace never custodies a publisher's revenue, and a publisher's receipts (their reputation) are portable, on-chain facts that outlive any operator, a property Phase 3's on-chain registry completes (§8.3).

**Sustainability.** The 20% fee is the only revenue line. No token, no listing fees, no paid placement: ranking is ledger-derived and unbuyable (§3.2).

## 7. Security model

The threat model assumes the buyer is software and the attacker is patient:

- **Replay.** Every authorization nonce binds to `(nonce, resource)` and is claimed atomically before broadcast; the token contract's used-nonce dictionary enforces single settlement on-chain. This mirrors the published mitigation for x402 replay attacks [30].
- **Budget, not key.** Server-side spending is clamped by a hard cap (default **$0.10 per session**) that a client-supplied budget can lower but never raise. The Phase 3 goal is protocol-level session keys: an agent holds a bounded, revocable budget rather than a raw wallet (§8.3).
- **Authenticated spend.** Real-mode spending paths require a wallet-bound session (Sign-In-With-Casper: a domain-bound challenge signed by the account key; single-use nonces; HMAC session cookies), plus per-IP rate limits on every paid surface.
- **Pre-flight checks.** The facilitator verifies payer balance before submitting, refusing to burn gas on settlements that cannot complete (meaningful on Casper, where over-budgeted gas is partially burned).
- **Bounded validity.** Authorizations carry validity windows (with clock-skew tolerance measured against Casper's block timestamps), so a stolen signature ages out in minutes.

## 8. The launch plan

AgentifyOS's long-term plan is sequenced by a single principle: **prove each layer with on-chain evidence before scaling the next.** Three phases, each with concrete exit criteria.

### Phase 1 · Proof (live, July 2026)

*Everything in this phase is shipped and verifiable today.*

- Full x402 `exact` loop on Casper testnet: real 402s, EIP-712-style signing, on-chain settlement, receipts with deploy hashes.
- The marketplace's three surfaces (catalog, discovery API, MCP) plus `llms.txt`, a CLI, and the on-camera agent runner.
- Zero-CSPR agent economics proven with published balance tables and hashes.
- A ToolRegistry contract (Rust, CEP-style) authored, deployed to testnet, and called (`register_tool(slug, manifest_hash)`, first-writer-owns-slug): the seed of Phase 3's on-chain listings.
- Public proof pack and documentation; Casper Agentic Buildathon Finals submission (July 2026).

**Exit criterion (met):** a third party can verify every claim in this paper from public endpoints and a block explorer.

### Phase 2 · Market (H2 2026)

*From a working proof to a two-sided market with real supply.*

**Settlement hardening**
- Deploy our own instance of the reference x402 CEP-18 token under marketplace accounts, and wire the deployed ToolRegistry into the publish flow so every new listing anchors its manifest hash automatically.
- Promote the facilitator to a standalone, self-hostable service others can point at, the same seam the mock/real architecture was built around.
- Flip `casper:casper-test` → mainnet once mainnet settlement rehearsals pass; every receipt then anchors to `cspr.live`.

**Supply (the strategic priority)**
- Onboard Casper buildathon finalists as the first third-party publishers, teams that already have agentic endpoints and need distribution; the marketplace's manifest wrap makes listing an afternoon's work.
- Wrap existing Casper ecosystem data services (market data, chain analytics, RPC conveniences) into paid manifests.
- Take every remaining first-party "coming soon" listing live or delist it: the catalog must be 100% callable.
- Target: **50 verified (settled-at-least-once) tools by end of 2026**.

**Distribution**
- List the MCP endpoint in the Claude and Cursor directories; register in x402 ecosystem indices (x402scan, awesome-x402, Agentic.Market-class catalogs).
- Publish the manifest format as an open specification with a public conformance test.
- Stand up the social/communications presence (X account, changelog, monthly adjusted-volume report).

**Exit criteria:** first organic settlement from a wallet we did not fund; ten third-party publishers; mainnet receipts in production.

### Phase 3 · Machine economy (2027+)

*From one marketplace to ecosystem infrastructure.*

- **Stablecoin settlement.** Adopt Casper-native stablecoin settlement the moment the Casper Manifest ships it, giving agent budgets price stability; WCSPR remains as fallback.
- **Session-key spend caps.** Move budget enforcement from our server into the protocol via account-abstraction session keys: an agent carries a bounded, revocable, auditable allowance instead of a private key.
- **On-chain registry as public infrastructure.** The ToolRegistry anchors every manifest hash on-chain, making listings tamper-evident and portable; any client, or any competing front-end, can index the same registry. The marketplace competes on curation and experience, not lock-in.
- **Discovery at scale.** Embeddings-based semantic search over manifests; dynamic pricing hooks so publishers can price by load or freshness.
- **Federation.** The self-hostable facilitator plus the open registry allow third-party marketplace nodes; AgentifyOS aims to be the largest window onto a shared, open tool economy rather than its sole gatekeeper.

**Exit criteria:** a majority of settled volume from third-party publishers; at least one independent front-end reading the registry; adjusted volume sustaining marketplace operations from the 20% fee alone.

### 8.4 What we measure

Vanity metrics are how this ecosystem embarrassed itself [17][18]. AgentifyOS reports, publicly and monthly:

1. **Verified tools** (settled at least once): not listed tools.
2. **Adjusted settled volume**: wash-filtered using Artemis-style exclusions (self-dealing, operator-funded loops), reported alongside the raw number.
3. **Unique organic payer wallets**: wallets never funded by our treasury.
4. **Repeat-purchase rate**: the single best proxy for genuine tool quality.
5. **Publisher payout total**: the number that proves the supply-side thesis.

## 9. Key takeaways

- **The rail is solved; the market is not.** x402 is a Linux Foundation standard with the largest payment networks on earth behind it and, measured honestly, almost no genuine inventory. Supply and trust are the open problems, and they are marketplace problems.
- **AgentifyOS is the market square, not a tollbooth.** One manifest, three surfaces; no custody, no API keys, no accounts; reputation computed from settlements alone. The payment is the review.
- **Casper is the right settlement substrate for machine buyers.** Deterministic finality, predictable fixed-rate gas, and a gasless authorization primitive that lets the buying agent hold zero gas tokens: live on testnet today with verifiable hashes, and institutionally aligned through the AI Toolkit and x402 Foundation membership.
- **The plan is sequenced by proof.** Testnet proof (done) → mainnet + third-party supply (H2 2026) → stablecoin settlement, session-key budgets, and an open on-chain registry (2027+), with adjusted (not raw) metrics published at every step.

Casper built the rails. We built the market.

**Try it:** `curl https://agentifyos.xyz/api/t/cspr-market-data` returns a payable 402 right now. The agent-facing front door is [agentifyos.xyz/llms.txt](https://agentifyos.xyz/llms.txt); the on-camera demo is [agentifyos.xyz/agent](https://agentifyos.xyz/agent).

---

## References

1. HTTP/1.1 specification (RFC 2068, 1997), status code 402; carried forward in RFC 9110.
2. Coinbase, *x402 whitepaper* (May 2025): https://www.x402.org/x402-whitepaper.pdf
3. x402, *Announcing x402 V2* (Dec 11, 2025): https://www.x402.org/writing/x402-v2-launch
4. Linux Foundation, *Operational launch of the x402 Foundation* (Jul 14, 2026): https://www.linuxfoundation.org/press/linux-foundation-announces-operational-launch-of-x402-foundation-to-standardize-internet-native-payments-for-ai-agents-and-applications
5. Cloudflare, *Monetization Gateway* (Jul 1, 2026): https://blog.cloudflare.com/monetization-gateway/
6. InfoQ, *AWS CloudFront x402 integration GA* (Jul 2026): https://www.infoq.com/news/2026/07/cloudflare-aws-x402-micropayment/
7. Vercel, *Introducing x402-mcp*: https://vercel.com/blog/introducing-x402-mcp-open-protocol-payments-for-mcp-tools
8. Coinbase, *Google A2A x402 extension*: https://www.coinbase.com/developer-platform/discover/launches/google_x402
9. Anthropic, *Donating MCP and establishing the Agentic AI Foundation* (Dec 9, 2025): https://www.anthropic.com/news/donating-the-model-context-protocol-and-establishing-of-the-agentic-ai-foundation
10. PulseMCP server registry (22,000+ servers, Jul 2026): https://www.pulsemcp.com/servers
11. Gartner, *Top Predictions for IT Organizations 2026 and Beyond* (Oct 21, 2025): https://www.gartner.com/en/newsroom/press-releases/2025-10-21-gartner-unveils-top-predictions-for-it-organizations-and-users-in-2026-and-beyond
12. Gartner, *When Machines Become Customers* (2023): https://www.gartner.com/en/publications/when-machines-become-customers
13. McKinsey, *The agentic commerce opportunity* (Oct 2025): https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-agentic-commerce-opportunity-how-ai-agents-are-ushering-in-a-new-era-for-consumers-and-merchants
14. Salesforce, *Cyber Week 2025* (Dec 5, 2025): https://www.salesforce.com/news/press-releases/2025/12/05/cyber-week-ai-agents-sales/
15. Adobe Analytics (Mar 17, 2025): https://blog.adobe.com/en/publish/2025/03/17/adobe-analytics-traffic-to-us-retail-websites-from-generative-ai-sources-jumps-1200-percent
16. Agent Economy x402 tracker (fetched Jul 19, 2026): https://agenteconomy.to/stats/x402-transactions
17. Visa × Artemis, *Agentic Payments from the Ground Up* (Jul 16, 2026): https://www.visa.com/en-us/thought-leadership/innovation/agentic-payments-from-the-ground-up
18. CoinDesk, *Coinbase-backed AI payments protocol… demand is just not there yet* (Mar 11, 2026): https://www.coindesk.com/markets/2026/03/11/coinbase-backed-ai-payments-protocol-wants-to-fix-micropayment-but-demand-is-just-not-there-yet
19. Chainalysis, *x402 agentic payments adoption* (Jun 3, 2026): https://www.chainalysis.com/blog/x402-agentic-payments-adoption/
20. Apify, *Let your AI agent pay for 20,000+ Apify Actors with x402* (Jun 30, 2026): https://blog.apify.com/introducing-x402-agentic-payments/
21. AgentifyOS proof pack (settlements, balances, and deploy hashes): https://agentifyos.xyz/docs and `/api/settlements`
22. Casper, *Casper 2.0 live on mainnet* (May 6, 2025): https://www.casper.network/news/casper-2-0-live-on-mainnet
23. Casper, *Unboxing Casper 2.1* (Dec 2025): https://www.casper.network/unboxing-casper-2-1
24. Casper CEP-18 token standard: https://github.com/casper-network/ceps/blob/master/text/0018-token-standard.md
25. Casper, *Casper AI Toolkit* (Jun 4, 2026): https://www.casper.network/news/casper-ai-toolkit
26. Casper, *The Casper Manifest* (May 12, 2026): https://www.casper.network/news/manifest
27. Apify Store and developer program (fetched Jul 20, 2026): https://apify.com/store · https://apify.com/partners/actor-developers
28. TechCrunch, *Nokia acquires Rapid, the API company once valued at $1B* (Nov 13, 2024): https://techcrunch.com/2024/11/13/nokia-acquires-rapid-the-api-company-once-valued-at-1b/
29. RapidAPI monetization docs and community payout reports: https://docs.rapidapi.com/docs/monetizing-your-api-on-rapidapicom
30. Replay-attack analysis and mitigation for x402 (arXiv 2605.11781); implemented as the `(nonce, resource)` guard described in §7.

---

*AgentifyOS · agentifyos.xyz · July 2026. Settlement data cited in this paper is volatile; figures carry their as-of dates. This document describes software running on Casper testnet; nothing here is investment advice or a token offering. There is no token.*
