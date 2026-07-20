# AgentifyOS · Apify for AI agents, settled with x402 on Casper

> **Name:** `AgentifyOS`, the operating layer where AI agents discover, pay for, and use tools. (Domain: **agentifyos.xyz**, secured.)
> **One-liner:** Developers publish paid tools in 60 seconds. Autonomous agents discover them, inspect schemas, pay per call with x402 from their **own** wallets, and get results + on-chain receipts: no API keys, no accounts, no humans. **The payment is the review.**
> **Target:** Casper Agentic Buildathon 2026 · **Final Round** · DoraHacks · **$150K pool** ($30K cash + $100K x402 credits + $20K in-kind)
> **Deadline:** **2026-07-26 23:59** (7 days from plan date) · Virtual · Submission needs public repo + demo video + Casper **testnet** deployment with transaction-producing on-chain component
> **Chain:** Casper testnet `casper:casper-test` · scheme `exact` · WCSPR CEP-18 (`transfer_with_authorization`, EIP-712-signed) · **no USDC exists on Casper**: price in `$`, settle in WCSPR
> **Status (2026-07-19):** planning; research fan-out complete (5 agents · hackathon / Casper / x402 / Apify+competitors / design)

---

## ⚠️ Day-0 blocking check (do before writing code)

We did **not** submit in the Qualification Round (June 1 – July 7, 254 BUIDLs advanced). The finals page shows open "Register as Hacker" / "Submit BUIDL" buttons (109 hackers vs 570 qualifiers), but **no rule explicitly says whether a brand-new team may enter the finals directly.**
- [ ] Ask on the finals QA page: https://dorahacks.io/hackathon/casper-agentic-buildathon-finals/qa
- [ ] Ask in Casper dev Telegram: https://t.me/CSPRDevelopers
- [ ] Register as hacker + create a draft BUIDL immediately (registration is open; occupy the slot)

If late entry is disallowed, the same build targets the **November "Casper Hackathon 2026"** (Halborn co-sponsored) with 4 months of polish. The plan survives either answer.

---

## 1. The insight this is built on

Three facts line up almost too well:

1. **Casper has rails but no market.** Casper's AI Toolkit (June 4, 2026) made it "the first WASM-native L1 with live x402 payments": facilitator, MCP servers, agent skills, all first-party. But the entire supply side is **one weather-endpoint demo**. The rails are live; there is nothing to buy. Coinbase's x402 Bazaar (165M+ tx, 480K agents) proves the marketplace layer is what turns rails into an economy, and **nothing marketplace-shaped exists on Casper**. "First agent-tool marketplace on Casper" is a *true* claim.
2. **The concept is on Casper's own wishlist.** casper.network/ai lists "Pay-per-request APIs" as a flagship use case: monetize any API with x402 micropayments, agents pay per call automatically. x402 is a hackathon tag, and $100K of the prize pool is literally *x402 ecosystem credits*. We are building the showcase app their stack was launched for.
3. **The incumbent teaches us what to skip.** Apify already ships "Actors as agent tools" (MCP + x402 on Base) and Bazaar already does agent discovery, so the wedge is not the *concept* but the marketplace primitives **both** lack: settlement-derived reputation, free first-call trials, per-call receipts with budget caps, and a storefront that serves humans *and* machines from one manifest.

**The thesis for judges:** billions of agents are becoming economic actors, but a market needs three things: rails, inventory, and trust. Casper shipped the rails six weeks ago. AgentifyOS is the inventory and the trust.

---

## 2. What we're building

A two-sided marketplace where **the customer is an autonomous agent**:

**Supply (humans):** a developer pastes their HTTP endpoint (or forks our tool template), fills a manifest (name, ≤500-char description, tags, input JSON Schema, output schema + example, pay-per-event price table) and publishes. One manifest auto-generates the human listing page, the machine-readable discovery record, *and* the MCP tool definition (Apify's proven schema→tool pipeline). Listings start **unverified** and flip to **verified** on their first successful x402 settlement (Bazaar's killer mechanic), with a **first-call-free sandbox event** fixing Bazaar's biggest gap.

**Demand (agents):** an agent with its **own Ed25519 keypair** (non-custodial; this is the knife into Casper Gateway) connects over MCP or plain HTTP:
1. `search_tools("scrape a product page under $0.01")` → ranked manifests with schemas + prices
2. calls the tool → **HTTP 402** + `PaymentRequirements` (scheme `exact`, network `casper:casper-test`, WCSPR asset)
3. signs an EIP-712 `transfer_with_authorization` payload with its own key → retries with `PAYMENT-SIGNATURE` header (all automatic via `@x402/fetch` `wrapFetchWithPayment`)
4. facilitator verifies → settles on Casper → agent gets the result + a **receipt**: `{tool, event, cost, payer, deployHash, resultHash}` deep-linked to testnet.cspr.live
5. every settlement auto-updates the listing's ledger-derived stats: calls, distinct buyers, success rate, revenue. **The payment is the review.**

**The flywheel on one screen:** publisher dashboard shows earnings ticking up *while* the agent's terminal shows reasoning + payments, and the marketplace's live feed shows settlements landing on-chain.

### The three surfaces

| Surface | For | What it is |
|---|---|---|
| **Marketplace web** (Next.js) | humans | catalog grid, tool detail pages, publish flow, publisher earnings dashboard, live settlement feed, receipts explorer |
| **Discovery + payment API** | agents | `GET /api/discovery/resources` · `GET /api/discovery/search` · paid tool endpoints returning 402 · `llms.txt` |
| **MCP server** | agents | `search_tools` · `get_tool` · `call_tool` (auto 402→sign→pay→retry) · `get_receipts`; one config snippet, works in Claude/Cursor |

---

## 3. Differentiation (the map is drawn; stay off others' hills)

| Player | What they are | Our knife |
|---|---|---|
| **Casper Gateway** (cspr-gw.xyz · *in this hackathon*, "MCPay on Casper") | custodial gateway: **its** wallet signs, agents use scoped `casper_` API keys, proxies existing endpoints | **agent-HELD wallets** doing the true 402→sign→retry x402 flow (no API keys: the exact thing x402 exists to kill); publisher earnings + receipts; machine-readable discovery (MCP + llms.txt); settlement-derived reputation; design bar |
| **x402 Bazaar** (Coinbase, Base/Solana) | discovery index, no storefront | doesn't support Casper; no ratings, no trials, no human storefront; we ship all three |
| **Apify** | the real incumbent; MCP + x402 on Base | not on Casper; rental-era pricing being killed; we're x402-V2-native + reputation-first |
| **KaJota / Immortal / FORGE / Payward** (in-event) | agentic-commerce showcases, single-purpose | none is a polished two-sided marketplace; several become **our future suppliers**; name that in the pitch |
| **Skyfire / AP2 / Nevermined** | identity/mandate/metering layers | complementary, not competitors: "AP2 = authorization evidence, x402 = execution; we're the market on top" |

**One-line positioning:** *Casper Gateway built a tollbooth; AgentifyOS builds the market square.*

---

## 4. Winning = the 8 published judging criteria, mapped

| # | Criterion | How AgentifyOS scores it |
|---|---|---|
| 1 | Technical Execution | full x402 V2 flow with official SDKs; self-hosted facilitator; MCP; clean monorepo |
| 2 | Innovation & Originality | first marketplace on Casper x402; "payment is the review" reputation; first-call-free trials |
| 3 | Use of AI / Agentic Systems | live autonomous agent: discovers → decides → pays → completes task, on camera |
| 4 | Real-World Applicability (DeFi & RWA) | seeded tools are DeFi/RWA-flavored (CSPR market data, RWA doc attestation); see §8 |
| 5 | UX & Design | designsystems.surf-inspired refined-light system (§10): most teams ignore this criterion; we treat it as a weapon |
| 6 | Working Smart Contracts on testnet | our own **Cep18X402 token deployed** (wasm shipped in casper-x402 repo) + every settlement is an on-chain `transfer_with_authorization` deploy; stretch: Odra ToolRegistry |
| 7 | Long-Term Launch Plans | domain + X account + public roadmap page in-app (`/roadmap`): mainnet, stablecoin when Manifest ships it, session-key spend caps (account abstraction, 2026H2) |
| 8 | Long-Term Ecosystem Impact | every listed tool = new Casper x402 volume; other finalists become suppliers; open manifest spec |

Proof bar set by top qualifiers (KaJota): a **table of live verifiable hashes** in the BUIDL page. Token package hash, settlement deploy hashes, all linked to testnet.cspr.live. We replicate that format exactly.

---

## 5. Architecture

```
                 HUMANS                                      AGENTS
      ┌────────────────────────┐              ┌──────────────────────────────┐
      │  Next.js web (:8402)   │              │  demo agent CLI (pnpm agent) │
      │  catalog · publish ·   │              │  own Ed25519 PEM wallet       │
      │  dashboards · feed     │              │  MCP client / @x402/fetch     │
      └───────────┬────────────┘              └──────────────┬───────────────┘
                  │                                          │ 1. search_tools (MCP /api/mcp)
                  ▼                                          │ 2. call tool
      ┌───────────────────────────────────────────────────────▼─────────────┐
      │  AGENTIFYOS core (Next.js API routes, :8402)                         │
      │  ├─ /api/discovery/{resources,search}   ← manifests, ranked          │
      │  ├─ /api/mcp  (search_tools · get_tool · call_tool · get_receipts)   │
      │  ├─ /api/t/[slug]  paid proxy → seller endpoint                      │
      │  │    x402ResourceServer + ExactCasperScheme → 402 + terms           │
      │  │    verify → serve → settle → receipt (nonce×resource idempotency) │
      │  └─ stats engine: settlement → listing reputation                    │
      └───────┬───────────────────────────────┬───────────────────────────── ┘
              │ Prisma                        │ /verify · /settle
              ▼                               ▼
      ┌──────────────┐            ┌───────────────────────────┐     WCSPR CEP-18
      │ Postgres     │            │ FACILITATOR               │     transfer_with_authorization
      │ (:5404)      │            │ MODE=mock: in-process fake│ ──────────────────────▶ Casper
      │ listings ·   │            │ MODE=real: self-hosted    │      testnet deploys
      │ receipts ·   │            │  (:8404, funded PEM key)  │      testnet.cspr.live links
      │ settlements  │            │  fallback: cspr.cloud     │
      └──────────────┘            └───────────────────────────┘
              ▲
      ┌───────┴──────────────┐
      │ seller demo tools     │  4 first-party Standby-style endpoints (:8403)
      │ scrape · summarize ·  │  behind paymentMiddleware: the seeded inventory
      │ cspr-data · rwa-attest│
      └───────────────────────┘
```

**MODE=mock (default, house convention):** whole loop (402 → EIP-712 sign → verify → settle → receipt → stats) runs with zero keys/funds; fake facilitator writes deterministic pseudo-hashes to Postgres, clearly labeled `MOCK` in UI. **MODE=real:** same code paths against self-hosted facilitator + Casper testnet WCSPR. The facilitator sits behind our own `FacilitatorClient` interface so mock/hosted/self-hosted swap by env var.

---

## 6. Tech stack (all verified live by research agents, 2026-07-19)

| Layer | Pick | Notes |
|---|---|---|
| Web | **Next.js 15 · React 19 · Tailwind v4 · Zustand · Geist** | house stack, same as agentskart |
| x402 core | **`@x402/core` 2.15 + `@x402/express` + `@x402/fetch`** | V2 modular SDK; `PAYMENT-REQUIRED`/`PAYMENT-SIGNATURE`/`PAYMENT-RESPONSE` headers |
| Casper mechanism | **`@make-software/casper-x402` 1.0.0** | official; `ExactCasperScheme` server+client, `createClientCasperSigner(pem)`; copy `js/examples/{server,client,facilitator}` |
| Chain SDK | **`casper-js-sdk` 5.0.12** | `PrivateKey.generate(ED25519)`, `NativeTransferBuilder`, `waitForTransaction`, `PublicKey.verifySignature` |
| Signing | **`@casper-ecosystem/casper-eip-712` 1.2.1** | EIP-712 typed data; `TransferAuthorization` structs (v1.2's casper-native feature) |
| Asset (testnet) | **WCSPR Cep18X402** package `3d80df21…47c1e`, 9 decimals, `extra:{name:'Wrapped CSPR',symbol:'WCSPR',version:'1'}` | + deploy our OWN token via shipped `Cep18X402.wasm` for criterion 6 |
| Facilitator | **self-hosted** (`js/examples/facilitator`, :8404, funded secp256k1 PEM) | hosted `x402-facilitator.cspr.cloud` free tier = **25 req/day on testnet**. Demo would exhaust it; keep hosted as fallback + mention sponsored feePayer |
| RPC / explorer | `https://node.testnet.casper.network/rpc` · testnet.cspr.live | chainName `casper-test`, CAIP-2 `casper:casper-test` |
| DB | **Postgres 16 (docker-compose, :5404) + Prisma** | listings, manifests, settlements, receipts, feedback |
| MCP | **`@modelcontextprotocol/sdk`**, HTTP transport at `/api/mcp` | agentskart pattern; also integrate hosted Casper MCP (`mcp.testnet.cspr.cloud`) in the demo agent for balance checks |
| Search | Postgres FTS + trigram + tag/price filters | embeddings are a stretch, not MVP |
| Faucet / keys | testnet.cspr.live/tools/faucet: **5,000 CSPR once per account** | treasury key pattern: faucet once → fan out via `NativeTransferBuilder` (0.1 CSPR fixed fee) |
| API key | console.cspr.build: one key covers CSPR.cloud REST + facilitator + MCP | register Day 0; server-side only |

**Ports (claimed, no sibling collisions):** web **8402** · seller tools **8403** · facilitator **8404** · Postgres **5404**. (agentfare owns 3000/4021, agentskart owns 7402/5402/6402; note casper-x402 examples default to 4021/4022; **override them**, 4021 is agentfare's.)

---

## 7. Data model (Prisma sketch)

```
Publisher   id · handle · payTo (00+account-hash) · createdAt
Tool        id · slug · name · description(≤500) · tags[] · publisherId
            originUrl · inputSchema(json) · outputSchema(json) · outputExample(json)
            status: draft|unverified|verified   ← flips on first settlement
            llmsTxt entry auto-generated
PriceEvent  id · toolId · eventName · title · usdPrice · isFreeTrial(bool)  ← first-call-free
Settlement  id · toolId · eventName · payer · amountAtomic · usdAtTime
            deployHash · network · status: verified|settled|failed · latencyMs · mode: mock|real
Receipt     id · settlementId · resultHash · requestId · createdAt        ← what agent takes away
Feedback    id · settlementId · payer · thumbs: up|down · sig (Ed25519)   ← signed, one per settlement
AgentSession payer · nonce · sigVerifiedAt                                 ← SIWX-style re-access
ToolStats   (materialized) toolId · totalCalls · distinctBuyers · successRate · revenue · last30d
```

Reputation is **ledger-derived only**: no prose reviews. Rank = f(settled volume, distinct payers, success rate, recency, metadata completeness) with per-`payTo` weighting for Sybil resistance (see §9).

---

## 8. Seeded inventory · 4 first-party tools (DeFi/RWA-flavored on purpose)

| Tool | What it does | Events / price | Judging hook |
|---|---|---|---|
| `page-scraper` | URL → clean markdown + metadata | `scrape` $0.005 · first free | the Apify homage |
| `text-summarizer` | text → structured summary (LLM behind flag; deterministic mock) | `summarize` $0.01 | AI |
| `cspr-market-data` | CSPR/USD price, volume, liquidity snapshot (cached CoinGecko) | `quote` $0.002 | **DeFi** |
| `rwa-attestor` | doc hash → signed attestation record (mock notary w/ Ed25519 sig) | `attest` $0.02 | **RWA** |

All four run as one Express "Standby-style" server (:8403) behind `paymentMiddleware`: they are the demo inventory *and* the reference implementation a publisher forks. Plus 8–10 additional **fixture listings** (schemas + fake stats, labeled clearly) so the catalog grid looks like a market, not a hallway.

Demo agent task (`pnpm agent "…"`): *"You have 100 WCSPR. Get the current CSPR price, scrape today's Casper blog post, summarize it, and attest the summary hash."* → 4 discoveries, 4 payments, 4 receipts, one report. Also runnable from Claude via the MCP snippet on any listing page.

---

## 9. Agent identity & security (the "authenticate with a signature" story)

- **Wallet = identity.** `/verify` returns the recovered `payer`; usage, spend history, reputation, and rate limits key off it. Zero registration.
- **SIWX-style sessions** (x402 V2 extension, CAIP-122): after first payment, agent signs a server nonce with the same key → session token → re-access paid content without re-settling. "Pay once, authenticated forever"; demos extremely well.
- **Signed feedback:** one thumbs-up/down per settlement, Ed25519-signed by the payer key, verified with `PublicKey.verifySignature`: ERC-8004-lite, no prose.
- **Budget caps:** buyer sets `MAX_TOTAL_CHARGE_USD` per run (Apify's `ACTOR_MAX_TOTAL_CHARGE_USD` pattern); `call_tool` refuses to exceed it; receipts show remaining budget.
- **arXiv 2605.11781 hardening (name-drop in pitch; judges' security sponsor is Halborn):**
  1. atomic `(nonce, resource)` idempotency claim before serving → kills the 248-grants-for-1-payment replay
  2. `Cache-Control: no-store, private` on all paid responses → kills cache leakage
  3. settle-before-serve for events > $0.01; verify-sync + settle-async below → bounded revert-grant risk
  4. ranking weighted by **settled on-chain volume per payTo** + metadata validation → Sybil/metadata-gaming resistance

---

## 10. Design system (designsystems.surf × house style)

Full token dump extracted from the live site by the design agent. The merge: **surf's catalog anatomy, re-typeset in Geist, retimed to Emil Kowalski.**

**Tokens:** `--bg #FAFAFA` · `--surface #FFF` · `--fg #0A0A0A` · `--fg-secondary #666` · `--muted #999` · `--border rgba(0,0,0,.08)` (hover `.12`) · `--tint rgba(0,0,0,.03)` · accents semantic-only: `--accent #2469FF` (surf's exact blue, <5% of surface) · `--success #008B37` (settlements) · `--error #E5484D`; 10%-alpha tints for chips. Primary buttons solid black. Radius 16 (cards) / 10 (inner) / 8 (controls) / 999 (pills, nav). Type: Geist Sans; **Geist Mono is the identity carrier**: every price, call count, latency, deploy hash, wallet address in mono; 11px uppercase micro-labels (+0.05em); scale 13/14/16/20/24/32/56; tracking −0.01 body → −0.04 hero; weights 400/500 only.

**Signature patterns (stolen from surf, rebuilt properly):**
1. **Mono stat fingerprint** on every card: `$0.005/call · 1.2K CALLS · 99.2% OK`: the grid reads like a table
2. **Hover variant swap:** rest = logo tile + name + price; hover reveals capability chips (`x402` `MCP` `FREE TRIAL`) + arrow: one card, absolutely-positioned meta layer, 160ms fade+4px translate (not surf's duplicated-DOM 400ms springs)
3. **Normalized logo tiles:** uniform rounded squares, monogram fallback on tinted bg: third-party tools look curated
4. **Hairline rows with revealed affordance:** detail-page endpoints and the **live settlement feed** (payer · tool · amount · deploy hash, new rows slide in 200ms, amounts in success-green, the only dense color on the page)
5. **Interleaved featured slot:** one accent-tinted card inline in the grid, parked on the demo-critical tool during judging
6. **Marquee logo wall** in hero: auto-scroll of seeded tool tiles, pause on hover: instant "this market has inventory"

**Motion (house law):** press `scale(0.97)` 100ms · hover reveals 160ms · everything ≤240ms custom-eased · `prefers-reduced-motion` honored. Landing (`/`) is refined-light with the marquee + a **live wire-log panel** rendering real 402 → PAYMENT-SIGNATURE → settle JSON. The protocol *is* the hero visual.

---

## 11. Build plan · 7 days, always demoable

**Day 0 · Sat Jul 19 · eligibility + keys (tonight)**
- [ ] QA-page + Telegram eligibility question posted · register hacker · draft BUIDL created
- [ ] console.cspr.build API key · faucet 5,000 CSPR into treasury key · generate agent/facilitator/payee PEMs
- [ ] Scaffold: pnpm monorepo (`web`, `tools`, `facilitator`, `agent`), Prisma + docker-compose Postgres (:5404), design tokens in globals.css

**Day 1 · Sun Jul 20 · mock loop end-to-end ← minimum viable demo exists**
- [ ] `FacilitatorClient` interface + mock impl; 402 → sign (real EIP-712, fake settle) → receipt → stats
- [ ] 4 seller tools live on :8403 behind `paymentMiddleware`; seed script (4 real + 10 fixture listings)
- [ ] `pnpm selftest`: offline proof · sign + verify EIP-712 `TransferAuthorization` with casper-eip-712, replay-guard test, no network

**Day 2 · Mon Jul 21 · the marketplace looks like a market**
- [ ] Catalog grid (surf card anatomy), search/filter/tags, tool detail page (hero stats · schema explorer · MCP snippet · price events · hairline endpoint rows)
- [ ] Publish flow: paste endpoint → manifest form → live in 60s (timed, it's a demo beat)

**Day 3 · Tue Jul 22 · agents can shop**
- [ ] `/api/discovery/{resources,search}` + `llms.txt`; MCP server at `/api/mcp` (`search_tools` · `get_tool` · `call_tool` · `get_receipts`) with budget cap
- [ ] Demo agent CLI: task → discover → pay → complete, pretty terminal reasoning log; test from Claude via MCP config

**Day 4 · Wed Jul 23 · real mode on Casper testnet ← the on-chain gate**
- [ ] Self-host facilitator (:8404, funded key); real WCSPR settlements; **benchmark settle latency** (unpublished; measure, then choose sync/async threshold)
- [ ] Deploy our own Cep18X402 token (`MART` test token) via shipped wasm → criterion 6 artifact
- [ ] Receipts deep-link testnet.cspr.live; start collecting the **proof table** (package hash, settlement deploy hashes)

**Day 5 · Thu Jul 24 · the two dashboards + polish**
- [ ] Publisher earnings dashboard (revenue, calls, 80/20 split math) · live settlement feed · SIWX session + signed feedback
- [ ] Full motion/design pass; landing page with marquee + wire-log hero; `/roadmap` page (criterion 7)

**Day 6 · Fri Jul 25 · ship the submission**
- [ ] Deploy web (Vercel) + tools/facilitator (Railway); mock mode public, real mode driven from our machine
- [ ] Demo video (script §12) · README (quickstart, architecture, proof table) · BUIDL page in KaJota format · X account + domain live
- [ ] End-to-end rehearsal: fresh clone → `pnpm db:up && pnpm dev` → agent completes task in mock; real-mode run recorded

**Day 7 · Sat Jul 26 · buffer only.** Submit by afternoon, deadline 23:59. No new features past Day 6.

---

## 12. Demo video (~3 min) · the money shot

1. **(0:00)** Problem: "Casper gave agents a way to pay six weeks ago. But there's nothing to buy." (cut to catalog grid scrolling)
2. **(0:25)** Publisher: paste endpoint → manifest → **published in 58 seconds**, listing goes live *unverified*
3. **(0:55)** Split screen. Left: agent terminal reasoning ("task needs a price feed… found `cspr-market-data` $0.002… paying"); right: marketplace live feed + wire-log showing the raw 402 → signed payload → settle
4. **(1:40)** The receipt: deploy hash → click → **testnet.cspr.live confirms it**. Listing flips to *verified*, stats tick up. "The payment is the review."
5. **(2:10)** Claude, via the copy-pasted MCP snippet, discovers and pays for the same tool: no code written
6. **(2:35)** Publisher dashboard: earnings accrued during this video · roadmap slide · "Casper has the rails. AgentifyOS is the market."

---

## 13. Risks & mitigations

| Risk | Mitigation |
|---|---|
| **Late-entry eligibility unknown** | Day-0 check; worst case → November Casper Hackathon with a 4-month head start. Decide by Day 1 evening |
| Hosted testnet facilitator = 25 req/day | self-host (:8404) as primary; hosted as fallback; mock mode immune |
| Casper settle latency unpublished | benchmark Day 4 first thing; verify-sync + settle-async pattern absorbs seconds-long finality |
| Faucet once-per-account | treasury key + programmatic fan-out (0.1 CSPR fixed fee); fund all demo keys Day 0, verify Day 4 |
| Casper Gateway similarity in judges' eyes | name the difference on a slide: custodial API-key tollbooth vs non-custodial market with reputation + publisher economics |
| "Original code" rule vs house templates | fresh repo, all buildathon work in it; note reused *concepts* (not code) in README like KaJota's diff transparency |
| Testnet congestion during judging | mock mode is a full product; NCTL docker local chain (`infra/local` pattern) as third fallback; pre-recorded real-mode segment in video |
| Scope creep | Day 1 mock loop is the real submission; every later day is upside. Protect it |

---

## 14. Stretch (only if ahead)

- **Odra `ToolRegistry` contract**: anchor manifest hashes on-chain at publish (Odra 2.9, llms.txt-assisted); makes listings tamper-evident and doubles criterion 6
- Embeddings-powered semantic search over manifests
- **Supplier onboarding of other finalists** (FORGE datasets, Sluice webhooks): even one converts criterion 8 from claim to fact
- Dynamic pricing per event by demand · agent spend-policy page (session keys narrative, Manifest 2026H2)

---

## 15. 30-second pitch

> "Six weeks ago Casper became the first WASM chain with live x402 payments: agents can finally *pay*. But pay for *what*? The entire supply side is a weather demo. **AgentifyOS is the market**: developers publish a paid tool in sixty seconds, and autonomous agents (holding their **own** wallets, no API keys, no accounts) discover it, inspect its schema, pay per call, and walk away with an on-chain receipt. Every settlement updates the listing's reputation, so **the payment is the review**. Watch my agent earn its answer: four tools, four payments, four receipts on testnet.cspr.live, and the developer got paid before this sentence ended. Casper built the rails. We built the economy on top."

---

## 16. Reference links (verified by research agents, 2026-07-19)

- **Hackathon:** https://dorahacks.io/hackathon/casper-agentic-buildathon-finals/detail · /tracks · /qa · Telegram t.me/CSPRDevelopers
- **Casper x402 (official):** https://github.com/make-software/casper-x402 · npm `@make-software/casper-x402` · facilitator docs https://docs.cspr.cloud/x402-facilitator-api/reference
- **Casper AI Toolkit:** https://www.casper.network/ai · launch PR (Chainwire, 2026-06-04) · Manifest roadmap https://www.casper.network/news/manifest
- **SDKs:** casper-js-sdk 5.0.12 · @casper-ecosystem/casper-eip-712 · @x402/{core,express,fetch,mcp} · Odra https://odra.dev/llms.txt
- **Chain:** RPC node.testnet.casper.network/rpc · faucet testnet.cspr.live/tools/faucet · console.cspr.build · MCP mcp.testnet.cspr.cloud/mcp
- **Patterns to emulate:** x402 Bazaar https://docs.cdp.coinbase.com/x402/bazaar · Apify PPE https://docs.apify.com/platform/actors/publishing/monetize/pay-per-event · Apify MCP https://docs.apify.com/platform/integrations/mcp
- **Competitor (in-event):** Casper Gateway https://dorahacks.io/buidl/46757 · cspr-gw.xyz · proof-bar example https://dorahacks.io/buidl/46798 (KaJota)
- **Security:** x402 attacks arXiv 2605.11781 · SIWX https://docs.x402.org/extensions/sign-in-with-x
- **Design:** https://designsystems.surf/ (token dump + pattern analysis in research notes)

_Plan drafted 2026-07-19 from a 5-agent research fan-out (hackathon brief · Casper ecosystem · x402 deep-dive · Apify/competitor mechanics · design language). Awaiting sign-off before build._
