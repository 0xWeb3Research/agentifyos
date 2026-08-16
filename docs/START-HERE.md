# Start here · the whole thing, from zero

You need **no blockchain knowledge** to read this. It explains the problem we're
solving, what Algorand and x402 actually are, what we built, and how it was
built.

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
pay per call, and get results. Payments settle in **USDC on the Algorand**
blockchain, and the buying agent pays no transaction fee at all.

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
**$0.14 to $0.20**, an amount no card network can profitably handle.

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
3. The agent's wallet **signs a payment** (a signature over a transaction it never broadcasts; nothing has touched the chain yet).
4. The agent **retries the same request**, attaching the signed payment in a `PAYMENT-SIGNATURE` header.
5. A **facilitator** verifies it and settles it on-chain; the server returns the data plus a receipt.

Round trip, no signup, typically ~1–2 seconds. **There are no protocol fees**:
you pay only the network's transaction cost, and on our chain you don't even pay
that (Part 5).

### Who's behind it

On **July 14, 2026** (five days before this was written), the **x402
Foundation** launched under the Linux Foundation with **40 members**, including
**Visa, Mastercard, American Express, Stripe, Adyen, Google, AWS, Cloudflare,
Shopify, Circle**. Casper, the chain this project started on and still supports,
is a member too.

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

**An account is derived from the public key.** On Algorand the public key is
encoded directly into the address you share, as capital letters and digits with
a checksum on the end. No sign-up exists; the account is just math. In our setup
a whole account is stored as a **25-word mnemonic**, which is the same private
key written in words you can copy without a typo.

**A transaction costs a fee.** Writing to a blockchain costs a small amount of
the network's native coin, on Algorand called **ALGO**. Crucially, **the fee
doesn't have to be paid by the person spending the money**, and that is the trick
that makes x402 work (Part 5).

**A token is not always a smart contract.** On many chains a token like a dollar
stablecoin is a program someone deployed. On Algorand it can be an **ASA**, an
Algorand Standard Asset: a token the chain itself understands, with an id
instead of a contract. The USDC we settle in is **ASA 10458941** on testnet.
Nothing has to be deployed, and there is no token contract of ours in the payment
path to trust or audit.

That's genuinely all you need.

---

## Part 4 · What Algorand is, and why we're on it

**Algorand** is a public proof-of-stake blockchain. Rather than list its
specifications, here are the four properties that decide how a machine payment
works on it, because those are the ones this project actually leans on.

**1. Tokens are first-class, so a dollar stays a dollar.** USDC on Algorand
testnet is ASA `10458941` with **6 decimals**. That means a price of **$0.005 is
exactly `5000` atomic units**: no price feed, no conversion, no rounding. A
listing quotes a number of dollars and the chain moves that number of dollars.

> This is a bigger deal than it sounds. On our alternate chain, prices in dollars
> have to be converted into a volatile coin at an illustrative rate, so every
> receipt is only approximately the price on the listing. Here the receipt and
> the listing are the same number.

**2. Transactions can be grouped, and the group is atomic.** You can hand the
network two transactions with one shared **group id**, and the network either
executes both or executes neither. No coordination, no escrow, no contract.

**3. A fee can be paid by someone other than the sender.** Inside such a group,
one transaction can carry the fee for the whole group while another carries a fee
of **zero**. So a transaction can be *sent* by one account and *paid for* by a
different one.

**4. An account must opt into an asset, and keeps a locked minimum.** Algorand
will not credit an asset to an account that hasn't said it wants it. Every
account, buyer and seller alike, must **opt into ASA 10458941** once before any
USDC can reach it. Holding assets also raises the account's **minimum balance**,
the amount the protocol locks and never lets you spend: **0.1 ALGO** to exist,
plus **0.1 ALGO** for holding one asset.

> ⚠️ **The opt-in is the single most common way a first demo dies.** If the payer
> or the payee skipped it, the payment fails deep inside the facilitator with
> `asset 10458941 missing from <address>`, which reads like a bug in the protocol
> and is really a missing one-line setup step. `pnpm algo:optin` does it and
> `pnpm algo:preflight` checks it before you spend anything.

### Why Algorand for agents

Put properties 2 and 3 together and you get exactly the shape x402 needs: an
agent can sign a payment and have somebody else pay the network fee, with no
contract in between and no way for that somebody to alter what was signed. Add
property 1 and the price an agent reads is the price it pays, to the cent.

The honest asterisk, stated plainly because you'll see it in a balance:

| Claim | True? |
|---|---|
| The buying agent spends **no ALGO on fees** | **yes** |
| The buying agent holds **no ALGO at all** | **no** |

An agent needs roughly **0.2 ALGO of locked minimum balance** (0.1 to exist, 0.1
for holding USDC). That is a reserve, not a spend. It never moves, and it is the
only ALGO the agent will ever touch.

### What about Casper?

This project started on **Casper**, and that path still works and is still
supported: set `CHAIN=casper` and everything settles there instead, in a wrapped
token called WCSPR, with a facilitator we run and fund ourselves. The
[Casper runbook](./TESTNET.md) is the guide, and [PROOF.md](./PROOF.md) keeps the
real Casper transactions from that era. Algorand is the default because the
mechanics above delete the wrapping step, delete the buyer's fee, and make the
price exact. The one thing they add is the opt-in, which is a single command you
run once per account.

---

## Part 5 · The atomic group, and the clever trick

### What actually moves

**USDC.** Not a wrapper, not a derivative, not a token minted by us. The agent
holds USDC, the seller receives USDC, and the amount is the price on the listing.

That sentence hides a step you'd have on other chains and don't have here.
On Casper, payments settle in **WCSPR**, which you get by depositing CSPR into a
contract that mints it 1:1, and depositing is itself an awkward transaction that
took us two research agents and a read through a framework's source to get right.
On Algorand **that step simply does not exist.** You get USDC from a faucet and
spend USDC. It is the clearest simplification of the whole port.

### The trick that makes agent payments possible

Normally, to move a token you submit a transaction and pay the fee, which means
**the payer needs the native coin**. That would be miserable for agents: every
agent would need topping up with ALGO just to spend its dollars.

Instead, the payment is built as a **two-transaction atomic group**:

| Index | Transaction | Signed by | Fee |
|---|---|---|---|
| 0 | a 0-ALGO payment from the facilitator's sponsor account to itself | the facilitator | carries the pooled fee for both |
| 1 | the USDC transfer, agent → seller | **the agent** | 0 |

And the sequence:

1. The **agent builds the group and signs only index 1**, its own USDC transfer,
   with a fee of zero. Signing is free and offline. **The agent never broadcasts
   anything.**
2. The agent sends the whole group back over HTTP in the `PAYMENT-SIGNATURE`
   header.
3. The **facilitator signs index 0**, the fee transaction, **simulates the group
   against a node** to see it succeed before it costs anything, and only then
   submits it.
4. Because the two share a group id, either both execute or neither does.

> **The agent spends zero ALGO on fees.** It holds USDC, a keypair, and the small
> locked minimum balance from Part 4. Someone else pays the network fee. This is
> what makes pay-per-call practical for software.
>
> And the facilitator can't cheat: it can only submit the transfer the agent
> already signed, for the exact amount, asset, and recipient in it. The one
> transaction it adds is its own fee payment to itself.

### Who the facilitator is

**[GoPlausible](https://facilitator.goplausible.xyz)**, hosted, with no API key
and no signup. We don't run it, don't fund it, and don't hold a key for it. Its
fee-sponsoring address is not hardcoded anywhere in the payment path: the app
asks for it at startup with `GET /supported` and copies whatever it answers into
every 402.

That means the "the agent pays no fee" claim is checkable by a stranger. Look up
any settled payment on the block explorer, find the group, and see the fee
transaction sent by the sponsor rather than by the buyer.

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

The same trick handles discovery. Every 402 we send carries a machine-readable
description of how to call the tool, the buyer echoes it back with the payment,
and the facilitator lists the resource in its **public catalog** when the payment
settles. Being listed is a side effect of being paid, so there is nothing to
register and nothing to keep in sync.

### What you can click

| Page | What it does |
|---|---|
| `/` | The pitch, with a live x402 wire-log showing one real payment end to end |
| `/tools` | The catalog: search and filter by category and price |
| `/tools/[slug]` | A listing: stats, input/output schema, pricing, copy-paste integration snippets |
| **`/agent`** | **The demo.** Give an agent a task and watch it discover tools, sign payments, and settle, with the raw protocol streaming beside it |
| `/publish` | Publish a tool, with a live preview of your listing |
| `/dashboard` | Publisher earnings, per-tool stats, and a live settlement feed |
| `/explain` | The address book: every account and asset the running instance uses |
| `/docs` | These documents, rendered |

Plus the machine-facing surface agents actually use: a real 402 endpoint, a
discovery API, an MCP server, and an `llms.txt`.

---

## Part 7 · How this was built

Honest account, including what went wrong.

### The approach: research first, then parallel build

**1. Research before code.** Five agents ran in parallel investigating the
hackathon rules, the ecosystem, the x402 protocol, Apify's marketplace
mechanics, and the target design language. That's where the "supply-side gap"
insight came from, and it reshaped the entire pitch.

**2. Lock the foundation by hand.** I built the shared contracts myself (the
data types, the payment engine, the design tokens, and one finished reference
page), so everything downstream had a fixed target.

**3. Then parallelize.** Six agents built the remaining pages, the API surface,
and the test suite simultaneously, each against a written contract document and
a locked visual exemplar. All six integrated with **zero type errors** on the
first try; the contracts did their job.

**4. Verify everything against reality.** Two more agents read the actual chain
SDK source and queried a **live testnet node** to confirm behaviour rather than
trusting documentation.

### The design

Refined-light and editorial, inspired by [designsystems.surf](https://designsystems.surf),
re-typeset in **Geist** and retimed to **Emil Kowalski's** motion rules
(everything under 300ms, custom easing curves, buttons that scale to 0.97 when
pressed). The signature move: **monospace carries every number** (prices, call
counts, hashes, wallet addresses), so the interface reads like a ledger.

### Three bugs worth telling you about (from the Casper build)

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

### And two the Algorand port taught us

**Initialising the resource server is not optional.** The fee sponsor's address
arrives from the facilitator's `/supported` endpoint. Build a 402 before that
call finishes and the challenge goes out without `extra.feePayer`; the buyer then
builds a group with nobody paying the fee, and an agent holding no spendable ALGO
fails for a reason that looks like anything except the real one. The resource
server is now initialised once, memoized, and a failed initialisation is thrown
away rather than cached, so the next request retries instead of pinning a dead
server.

**Opt-in reaches further than you expect.** It applies to the payee too, which
quietly rules out the demo's per-seller payout addresses: on Casper each seeded
publisher has a derived account and nothing needs to exist on-chain for the demo
to read one, but on Algorand a payee must be a real account that has opted in
before it can be paid at all. So every listing settles into the one treasury
account we actually maintain, and splitting revenue per seller is a mainnet
concern that starts with each seller opting in. One function, `resolvePayTo()`,
is where that decision lives, rather than scattered through the routes.

### How it's tested

- **Offline payment-loop tests**, including a replay-attack guard (`pnpm selftest`)
- **A preflight** that checks every prerequisite independently, so a failure names
  its own fix: the SDK's network constant, the asset id, the facilitator, both
  keys, both opt-ins, the agent's USDC, the payee address, and the mode
  (`pnpm algo:preflight`)
- **Browser end-to-end tests** (`pnpm test:e2e`)
- **Live testnet reads** confirming balances and asset holdings
- Clean TypeScript and a clean browser console on every page

---

## Part 8 · Where it stands right now

**Real and working:** real Algorand accounts; the real x402 v2 handshake over
real HTTP; a genuine two-transaction atomic group signed by the agent; verify,
simulate, and settle through the hosted GoPlausible facilitator; USDC moving from
buyer to treasury; live balance and opt-in reads. Run `pnpm algo:pay` and the
last thing it prints is the agent's balance before and after: USDC down by the
price, ALGO unchanged.

**What still needs a human:** both faucets. Testnet ALGO comes from
[lora.algokit.io/testnet/fund](https://lora.algokit.io/testnet/fund) and testnet
USDC from [faucet.circle.com](https://faucet.circle.com), and both want a browser
rather than an API. That is a ten-minute, one-time step, and it's the whole of
the setup that isn't a command.

**[ALGORAND.md](./ALGORAND.md) is that ten minutes**, in order, with a
troubleshooting table for each way it can go wrong. Everything before and after
those two faucet visits is already built.

---

## Glossary

| Term | Meaning |
|---|---|
| **Agent** | Software that pursues a goal on its own, deciding what to do next |
| **x402** | The standard for paying over HTTP using status code 402 |
| **Facilitator** | The service that verifies a payment and puts it on-chain, paying the network fee. On Algorand that's GoPlausible, hosted by someone else |
| **MCP** | *Model Context Protocol*, Anthropic's open standard (Nov 2024) for connecting AI models to tools. "USB-C for AI tools": ~97M monthly SDK downloads. It solved *discovery*; x402 adds *payment* |
| **Stablecoin** | A token pegged to a currency (e.g. $1), so prices don't swing |
| **USDC** | The dollar stablecoin we settle in. 6 decimals, so $0.005 is 5000 atomic units |
| **ALGO / microALGO** | Algorand's native coin; 1 ALGO = 1,000,000 microALGO. Pays fees, which our agent doesn't |
| **ASA** | *Algorand Standard Asset*: a token the chain understands natively, identified by a number. USDC on testnet is ASA 10458941 |
| **Opt-in** | A one-time transaction by which an account agrees to hold an asset. Required before it can receive any |
| **Minimum balance** | ALGO the protocol locks in an account and won't let it spend: 0.1 to exist, 0.1 more per asset held |
| **Atomic group** | Up to a handful of transactions sharing one group id, executed all together or not at all |
| **Fee sponsor** | The account whose transaction carries the pooled fee for a group, so another member can pay 0 |
| **Transaction id** | The ID of a submitted Algorand transaction; look it up on lora.algokit.io/testnet |
| **Lora** | AlgoKit's block explorer, where every receipt of ours links |
| **Testnet** | A free practice copy of the blockchain. Real software, worthless tokens |
| **CSPR / mote** | *Casper only.* Casper's coin; 1 CSPR = 1,000,000,000 motes |
| **WCSPR / CEP-18** | *Casper only.* "Wrapped CSPR", minted 1:1 from CSPR, following Casper's fungible-token standard; what payments settle in there |
| **Deploy hash** | *Casper only.* The ID of a submitted transaction; look it up on testnet.cspr.live |
| **AP2** | Google's protocol proving a *human* authorized a purchase. Complements x402: **AP2 authorizes, x402 settles** |

---

## Just want to see it?

The agent demo is live and open: **[agentifyos.xyz/agent](https://agentifyos.xyz/agent)**.
No wallet, no setup: type a task, press run, and watch an agent pay for tools and
settle in USDC on Algorand testnet, with every payment linking to
[Lora](https://lora.algokit.io/testnet), the block explorer. It runs on a shared
testnet wallet with a daily budget, so it's real but can't be drained. Full
explanation in **[ALGORAND.md](./ALGORAND.md)**.

---

## Where to go next

- **[ALGORAND.md](./ALGORAND.md)**: get a real payment onto the chain, in ten minutes
- **[HOW-IT-WORKS.md](./HOW-IT-WORKS.md)**: the architecture in technical detail
- **[PROOF.md](./PROOF.md)**: how to verify a settlement three independent ways
- **[TESTNET.md](./TESTNET.md)**: the alternate Casper path, behind `CHAIN=casper`
- **[../CHANGELOG.md](../CHANGELOG.md)**: everything built, and what's pending

---

*The rails were standardised. We built the market.*
