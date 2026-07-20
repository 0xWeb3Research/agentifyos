# Start here · the whole thing, from zero

You need **no blockchain knowledge** to read this. It explains the problem we're
solving, what Casper and x402 actually are, what we built, and how it was built.

Roughly a 20-minute read. Skip to [Part 6](#part-6--what-we-built) if you only
want the product.

---

## The one-paragraph version

AI agents are starting to do real work on their own, but they **can't buy
anything**. Every payment system on earth assumes a human is behind it. A new
internet standard called **x402** fixes that by reviving an HTTP status code
that sat unused for 25 years: a server can reply *"402 Payment Required, here's
the price,"* and software can pay it in a fraction of a second with no account,
no API key, and no human. **AgentifyOS** is a marketplace built on that: a
place where developers publish paid tools and autonomous agents discover them,
pay per call, and get results. Payments settle on the **Casper** blockchain.

---

## Part 1 · Why AI agents can't pay for things

This is the actual problem, and it's more specific than "crypto for AI."

Imagine an agent working on a task. Halfway through, it realizes it needs data
it doesn't have: a web page scraped, a document verified, a price checked.
There's a service that does exactly this. **The agent cannot buy it.** Here's
why, at four separate layers:

**1. API keys assume a human already signed up.** To use a new service, someone
must create an account, attach a credit card, generate a key, store it securely,
and wire it into the agent's environment. None of that can happen mid-task.
Apify (which sells 20,000+ automation tools) names exactly this as the
blocker: agents need *"creating accounts, attaching billing, issuing and storing
credentials, rotating secrets, and wiring them into the runtime."*

> The consequence is the important part: **an agent's universe of tools is fixed
> in advance by whatever a human thought to set up.** It can never discover and
> use something new on its own.

**2. Card payments break below about 30 cents.** Card fees are a percentage
*plus* a fixed amount per transaction. A $0.002 API call costs orders of
magnitude more to process than it's worth. Real x402 payments average roughly
**$0.14–$0.20**, an amount no card network can profitably handle.

**3. Chargebacks assume a human who got defrauded.** The entire dispute system
asks "did the cardholder authorize this?" When an agent authorizes 10,000
payments a day, that question stops meaning anything.

**4. Subscriptions price the wrong thing.** An agent might call a tool once,
ever. Or 50,000 times in an hour and never again. Monthly seats don't fit.

**What's actually needed:** a way for software to pay a stranger a fraction of a
cent, instantly, mid-task, with no prior relationship.

---

## Part 2 · HTTP 402, and the protocol that finally used it

### The status code that waited 25 years

You know **404 Not Found**. There's also **402 Payment Required**, and its
official definition in the HTTP standard ([RFC 9110 §15.5.3](https://www.rfc-editor.org/rfc/rfc9110.html#name-402-payment-required))
is a single sentence:

> "The 402 (Payment Required) status code is reserved for future use."

That's it. The web's authors left a slot for digital payments and the payment
system never arrived. Every candidate either died or couldn't move a cent
economically.

**Two things changed at once:** a rail where sub-cent payments actually settle
(stablecoins), and a customer with no human to fall back on (autonomous agents).
402 was a hole waiting for both halves.

### x402, in five steps

**x402** is an open standard created by Coinbase in May 2025. The flow:

1. The agent makes a normal request: `GET /api/scrape?url=…` (no key, no account).
2. The server replies **`402 Payment Required`** with machine-readable terms: price, which token, which chain, who to pay.
3. The agent's wallet **signs a payment authorization** (just a signature, nothing on-chain yet).
4. The agent **retries the same request**, attaching the signature in a `PAYMENT-SIGNATURE` header.
5. A **facilitator** verifies it and settles it on-chain; the server returns the data plus a receipt.

Round trip, no signup, typically ~1–2 seconds. **There are no protocol fees**:
you pay only the network's transaction cost.

### Who's behind it

On **July 14, 2026** (five days before this was written), the **x402
Foundation** launched under the Linux Foundation with **40 members**, including
**Visa, Mastercard, American Express, Stripe, Adyen, Google, AWS, Cloudflare,
Shopify, Circle**. And **Casper**.

Note the irony worth appreciating: **the card networks helped ratify the
standard that routes around cards.**

### The honest part: is this real yet?

You should hear the skeptical case, because it's the reason this project exists.

| Source | Figure | Kind |
|---|---|---|
| x402.org dashboard | 75M transactions, $24M volume (30 days) | vendor self-reported, **raw** |
| Visa + Artemis | **$15M adjusted volume** lifetime since May 2025 | independent, **wash-trading excluded** |
| Artemis (Mar 2026) | **~$28,000/day** of genuine volume | independent |

Artemis found roughly **half of all x402 transactions are artificial**
(self-dealing or wash trading). Their verdict: *"The x402 'agent payments' boom
is still mostly a mirage."*

**But here's the fact that matters most, and it's the entire thesis of this
project.** When Apify added 20,000 payable tools on June 30, 2026, that was a
**10× increase in the protocol's total endpoint count**, meaning x402 had
roughly **2,000 payable endpoints in the whole world** before one company showed
up. Artemis diagnosed the same thing: *"the merchants that x402 is designed to
serve are still rare."*

> **This is a supply problem, not a demand problem.** The plumbing got built and
> standardized before the shops opened. Forty of the biggest payment and cloud
> companies ratified a standard for a network with almost nothing to buy on it.
>
> A marketplace is precisely the missing piece. That's what we built.

---

## Part 3 · The minimum blockchain you need to understand

Only four ideas. You can skip the rest of crypto entirely.

**A keypair is an identity.** You generate two linked numbers: a **private key**
(secret) and a **public key** (shareable). Anything signed by the private key
can be verified by anyone holding the public key, and can't be forged. **This is
how an agent has an identity without registering anywhere**: its public key
*is* its account.

**An account is derived from the public key.** On Casper, hashing the public key
gives an **account hash**, the address funds are tracked against. No sign-up
exists; the account is just math.

**A transaction costs a fee ("gas").** Writing to a blockchain costs a small
amount of the network's native token, paid by whoever submits the transaction.
Crucially, **that doesn't have to be the person paying**, which is the trick
that makes x402 work (Part 5).

**A smart contract is a program that lives on the chain.** It holds data (like
"who owns how many tokens") and exposes functions anyone can call. Nobody can
change its rules once deployed.

That's genuinely all you need.

---

## Part 4 · What Casper is, and why we're on it

**Casper** is a public **proof-of-stake** blockchain (mainnet since 2021),
governed by the Casper Association. Practically, four things matter here:

**1. Contracts are WebAssembly, not Solidity.** Ethereum contracts run on the
EVM; Casper contracts are written in **Rust** and compiled to **WebAssembly
(WASM)**, the same portable format browsers run. Developers usually use the
**Odra** framework, which makes Rust contracts far less painful. (This detail
bites us later: see Part 7's hardest bug.)

**2. No gas auction, so costs are predictable.** Ethereum runs an auction where
fees spike with demand. Casper prices gas at a flat **1 mote per gas unit**, and
the multiplier that would let that float is **pinned at 1**; it cannot move.
Some operations are exactly fixed: a native transfer is **always 0.1 CSPR**.
**For machine payments this matters enormously**: an agent can compute what a
call costs *before* paying, rather than hoping.

> ⚠️ **One sharp edge, and it costs real money.** You declare a payment amount
> up front and **the full amount is debited regardless of what you use**. Only
> **75% of the unused remainder is refunded**; the other 25% is burned. So
> overestimating doesn't just waste time, it destroys funds. A measured mainnet
> example: a call that consumed 0.39 CSPR of gas cost its sender 0.92 CSPR
> because they budgeted 2.5. Budget close to actual.

**3. Fast, final blocks.** Casper 2.0 ("Condor") replaced its old consensus with
**Zug**, giving *deterministic finality*. The distinction is worth getting right:

> Bitcoin's finality is a **weather forecast**: after six blocks a reversal is
> very unlikely, but never impossible. Zug's finality is a **receipt**: once
> two-thirds of validators sign, the block is final *by the rules of the
> protocol*, not by probability. Waiting ten more blocks adds nothing.

The **minimum** block time is 8 seconds (we measured live blocks at 8.001s,
flat). We verified both networks running protocol **2.2.2**.

**4. Money is CSPR, measured in motes.** 1 CSPR = 1,000,000,000 motes (like
dollars and cents, but nine decimal places).

**Accounts and purses** are a Casper quirk worth knowing: your balance lives in
a **purse**. A brand-new account that's never received funds **has no purse at
all**, so asking for its balance returns *an error*, not zero. (We hit this;
our code now reports it as 0.)

### Why Casper for agents

In **June 2026**, Casper shipped an "AI Toolkit" with a production x402
facilitator live on mainnet, which it **describes as** the first
WebAssembly-native L1 with live x402 payments. (Worth flagging honestly: that
claim comes from Casper's own press release on a paid newswire, and Concordium,
also WASM-native, announced x402 support in December 2025. Attribute the claim;
don't repeat it as established fact.)

Setting the marketing aside, the architecture genuinely fits: predictable
non-auction fees, deterministic finality in seconds, and first-party x402
support. Casper is also an x402 Foundation member.

And the strategic gap: Casper's rails went live, but **almost nothing exists to
buy on them yet**. Same supply problem as Part 2, in miniature.

---

## Part 5 · The smart contract, and the clever trick

### What actually moves

Payments don't settle in CSPR directly. They settle in **WCSPR** ("Wrapped
CSPR"), a token that follows **CEP-18**, Casper's fungible-token standard
(equivalent to Ethereum's ERC-20). A CEP-18 contract is basically a ledger: a
big dictionary of *account → balance*.

You get WCSPR by **depositing CSPR** into the contract, which mints it 1:1. We
verified this on-chain: the contract's total supply exactly equals the CSPR
locked inside it.

### The trick that makes agent payments possible

The token has a special function: **`transfer_with_authorization`**.

Normally, to move tokens you submit a transaction and pay gas, meaning **the
payer needs the native coin**. That would be terrible for agents: every agent
would need CSPR topped up just to spend its tokens.

Instead:

1. The **agent signs a message** saying *"move 0.002 WCSPR from me to this
   address, valid for 60 seconds, reference number X."* Signing is free and
   offline. **The agent never touches the blockchain.**
2. The **facilitator** submits that signature to `transfer_with_authorization`
   **and pays the gas itself.**
3. The **contract verifies the signature on-chain** and moves the tokens.

> **The agent needs zero CSPR.** It holds only the tokens it spends and a
> keypair. Someone else pays the transaction fee. This is what makes
> pay-per-call practical for software.
>
> And the facilitator can't cheat: it can only relay a payment the agent
> already signed, for the exact amount and recipient specified.

We verified this contract on live testnet: all eight arguments match our
implementation exactly, and it shows real `AuthorizationUsed` events. **This
flow is in active use on Casper today.**

---

## Part 6 · What we built

**AgentifyOS** is a two-sided marketplace where **the customer is a machine**.

**For developers (supply):** publish a tool in about 60 seconds. Paste your
endpoint, describe its inputs and outputs, set a price per call. That single
manifest becomes three things at once: a human listing page, a machine-readable
discovery record, and a tool your agent can call.

**For agents (demand):** an agent searches the catalog over HTTP or **MCP**
(see the glossary), reads a tool's schema and price, calls it, hits the 402,
pays, and gets its result plus an on-chain receipt, **with no key, no account,
and no human in the loop.**

### The idea that ties it together: *the payment is the review*

Star ratings can be faked. Ours can't, because **we don't have any**. A
listing's reputation is computed entirely from **settled payments**: real
calls, distinct paying wallets, success rate, revenue. A tool becomes
**verified** only after its first real settlement clears.

You can't fake it without actually paying for it. The payment record *is* the
usage record.

### What you can click

| Page | What it does |
|---|---|
| `/` | The pitch, with a live x402 wire-log showing one real payment end to end |
| `/tools` | The catalog: search and filter by category and price |
| `/tools/[slug]` | A listing: stats, input/output schema, pricing, copy-paste integration snippets |
| **`/agent`** | **The demo.** Give an agent a task and watch it discover tools, sign payments, and settle, with the raw protocol streaming beside it |
| `/publish` | Publish a tool, with a live preview of your listing |
| `/dashboard` | Publisher earnings, per-tool stats, and a live settlement feed |

Plus the machine-facing surface agents actually use: a real 402 endpoint, a
discovery API, an MCP server, and an `llms.txt`.

---

## Part 7 · How this was built

Honest account, including what went wrong.

### The approach: research first, then parallel build

**1. Research before code.** Five agents ran in parallel investigating the
hackathon rules, the Casper ecosystem, the x402 protocol, Apify's marketplace
mechanics, and the target design language. That's where the "supply-side gap"
insight came from, and it reshaped the entire pitch.

**2. Lock the foundation by hand.** I built the shared contracts myself (the
data types, the payment engine, the design tokens, and one finished reference
page), so everything downstream had a fixed target.

**3. Then parallelize.** Six agents built the remaining pages, the API surface,
and the test suite simultaneously, each against a written contract document and
a locked visual exemplar. All six integrated with **zero type errors** on the
first try; the contracts did their job.

**4. Verify everything against reality.** Two more agents read the actual Casper
SDK source and queried the **live testnet node** to confirm the contract's
functions rather than trusting documentation.

### The design

Refined-light and editorial, inspired by [designsystems.surf](https://designsystems.surf),
re-typeset in **Geist** and retimed to **Emil Kowalski's** motion rules
(everything under 300ms, custom easing curves, buttons that scale to 0.97 when
pressed). The signature move: **monospace carries every number** (prices, call
counts, hashes, wallet addresses), so the interface reads like a ledger.

### Three bugs worth telling you about

**The duplicate-key bug.** The settlement feed threw React key errors. The cause
was my own seed data: the random generator was seeded by *summing character
codes*, which is order-insensitive, so `":12"` and `":21"` produced identical
IDs. Fixed by switching to an order-sensitive hash.

**The signature that throws instead of returning false.** Casper's
`verifySignature` doesn't return `false` for a bad signature; it **throws an
exception**. Code that trusted the return value would treat invalid signatures
as valid. Every verification path now treats a throw as a rejection.

**The hardest one: you can't attach money to a contract call.** To wrap CSPR
into WCSPR, you call `deposit` and attach CSPR. But the Casper JS SDK has **no
method to attach value to a contract call**. I checked the source. It looked
like a missing feature.

It isn't. **Casper 2.0 has no attached-value mechanism for contract calls at
all**, by design. Odra works around it by shipping a small "proxy caller"
program: you run *that* as a one-off session, it creates a purse, moves your
CSPR into it, and hands it to the contract. So wrapping isn't a contract call at
all; it's a **session transaction**. Two research agents and a read through
Odra's source to find that. It now works, verified by building and signing a
real transaction.

### How it's tested

- **6/6** offline payment-loop tests (including a replay-attack guard)
- **5/5** browser end-to-end tests
- **Real cryptography proven offline**: a real Casper key signs the real
  EIP-712 structure the on-chain contract validates, and tampering is rejected
- **Live testnet reads** confirming balances and contract functions
- Clean TypeScript and a clean browser console on every page

---

## Part 8 · Where it stands right now

**Real and working:** real Casper keypairs; real EIP-712 payment signing; real
signature verification; the on-chain settlement call; CSPR→WCSPR wrapping; live
balance reads. Run the agent demo and you'll see a genuine signature, genuinely
verified, against the real testnet contract.

**The one thing missing: money.** The faucet that hands out free test tokens
requires a browser wallet sign-in, so the accounts need funding before the first
payment can clear. Until then the demo stops with an honest message,
*"facilitator unfunded (0.00 CSPR, needs ~7)"*, rather than pretending.

**[TESTNET.md](./TESTNET.md) is the 10-minute fix.** Everything before and after
that step is already built.

---

## Glossary

| Term | Meaning |
|---|---|
| **Agent** | Software that pursues a goal on its own, deciding what to do next |
| **x402** | The standard for paying over HTTP using status code 402 |
| **Facilitator** | The service that verifies a payment and puts it on-chain, paying the gas |
| **MCP** | *Model Context Protocol*, Anthropic's open standard (Nov 2024) for connecting AI models to tools. "USB-C for AI tools": ~97M monthly SDK downloads. It solved *discovery*; x402 adds *payment* |
| **CSPR / mote** | Casper's coin; 1 CSPR = 1,000,000,000 motes |
| **WCSPR** | "Wrapped CSPR", a CEP-18 token minted 1:1 from CSPR; what payments settle in |
| **CEP-18** | Casper's fungible-token standard (like ERC-20) |
| **Gas** | The fee to write to the chain; here, always paid by the facilitator |
| **Account hash** | An address derived by hashing a public key |
| **Purse** | Where a Casper account's balance lives; unfunded accounts have none |
| **Testnet** | A free practice copy of the blockchain. Real software, worthless tokens |
| **Deploy hash** | The ID of a submitted transaction; look it up on testnet.cspr.live |
| **Stablecoin** | A token pegged to a currency (e.g. $1), so prices don't swing |
| **Odra** | The Rust framework most Casper contracts are written with |
| **AP2** | Google's protocol proving a *human* authorized a purchase. Complements x402: **AP2 authorizes, x402 settles** |

---

## Just want to see it?

The agent demo is live and open — **[agentifyos.xyz/agent](https://agentifyos.xyz/agent)**.
No wallet, no setup: type a task, press run, and watch an agent pay for tools and
settle on Casper testnet, with every payment linking to the block explorer. It
runs on a shared testnet wallet with a daily budget, so it's real but can't be
drained. Full explanation in **[TESTNET.md](./TESTNET.md)**.

---

## Where to go next

- **[HOW-IT-WORKS.md](./HOW-IT-WORKS.md)**: the architecture in technical detail
- **[TESTNET.md](./TESTNET.md)**: get a real payment onto the chain
- **[../CHANGELOG.md](../CHANGELOG.md)**: everything built, and what's pending

---

*Casper built the rails. We built the market.*
