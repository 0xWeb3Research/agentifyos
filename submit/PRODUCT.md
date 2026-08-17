# AgentifyOS

**The marketplace where AI agents shop for tools.**

A developer lists a paid API in 60 seconds. An agent finds it mid-task, pays a
fraction of a cent, and gets on with the job. No signup, no API key, no human in
the loop.

Live on Algorand testnet, settled in USDC through the GoPlausible x402
facilitator.

***

## The problem

An AI agent can reason, but it cannot buy.

Every API an agent might want sits behind a signup form, a credit card and a
dashboard, all of it built for a human with a company card. So agents work on a
leash: a person guesses in advance which tools the agent will need, provisions
keys, and hopes.

That hurts three ways at once:

| Who | What breaks |
|---|---|
| The agent | Discovers a useful API mid-task and cannot use it. No account, no way to open one. |
| The seller | Has something worth $0.005 a call. Billing infrastructure costs more than it would earn, so it never ships. |
| Both | Agents want thousands of tiny calls across many vendors. Subscriptions want one big commitment to one. |

This is not a technology gap. Payments work fine. It is a **market gap**: there
is nowhere a machine can shop.

***

## Who it is for

### The developer with an API

**Today.** Has something worth $0.005 a call. Building signup, billing, quotas
and invoicing to sell it costs more than it would ever earn, so it never ships.

**With us.** Fills in a manifest, sets a price, publishes. Gets paid per call in
USDC, settled on-chain, with no account system to build or run.

### The agent builder

**Today.** Pre-provisions every key the agent might need, hands it credentials it
should not hold, and pays monthly for tools it used twice.

**With us.** Gives the agent a wallet and a budget. It discovers tools at
runtime, pays for exactly what it uses, and stops when the budget runs out.

**The same listing serves both.** More listings make the catalog worth shopping;
more agents shopping makes it worth listing on. Every call in between is a
settled payment, and a fifth of it is our revenue.

***

## The product

| Surface | Who uses it | What it does |
|---|---|---|
| **Catalog** | developers, buyers | Browse and search 14 listings by category, price ceiling and tag. Every listing carries its schema, example output and price. |
| **Publish** | developers | A manifest, a price, a payout address. The listing is live and machine-discoverable immediately. |
| **Agent demo** | everyone | Type a task in plain English. Watch an agent plan it, buy the tools it needs, and show every payment on the wire. |
| **Dashboard** | developers | Earnings per listing, settled calls, and the reputation those payments produced. |
| **CLI and MCP** | agent builders | `agentify call <slug>`, or wire the MCP server into Claude or Cursor and let the assistant buy tools itself. |
| **Discovery API** | agents | The whole catalog as machine-readable records, plus `llms.txt`, so an agent can shop without a browser. |

**Reputation is the payment.** There are no reviews to game: a listing's standing
is derived from calls that actually settled on-chain, and faking that costs real
money.

***

## How it works

1. **Find.** The agent searches the catalog mid-task and picks a tool on price
   and schema.
2. **Ask.** It calls the tool. The server answers `402 Payment Required` with a
   price and a payee.
3. **Pay.** It signs a USDC transfer for exactly that amount. Off-chain,
   instant, and it costs nothing.
4. **Settle.** A facilitator checks it, submits it, and covers the network fee.
5. **Deliver.** The tool runs. The agent gets the result and a receipt anyone can
   verify.

**What a buyer needs:** a wallet with USDC, and a budget. No account, no key, no
card, and no ALGO, because the facilitator pays the network fee.

**What a seller needs:** an address that can receive USDC. Payment lands
directly and we never custody it.

***

## Why now

The rails got standardised. Nobody opened the shops.

Agents became buyers: tool use went from a demo to the default, and agents now
run long tasks needing data they were never provisioned for. Then x402
standardised payment, so a machine can be quoted a price and pay it inside the
same request.

What is missing is anything to buy. Read from the facilitator's own registry at
`facilitator.goplausible.xyz/discovery/all` on 17 August 2026:

| | |
|---|---|
| x402 settlements in 24 hours | **12,601** |
| Merchants selling, worldwide | **127** |
| Listed resources on Algorand | **99%** (12,511 of 12,524) |
| Facilitators serving them | **1** |

Twelve thousand payments a day against a hundred and twenty seven sellers is not
a demand problem. **It is a supply problem, and it is almost entirely on
Algorand.** That gap is the business.

***

## Why Algorand

The chain choice is a product decision, not a preference.

| What a micro-payment market needs | What Algorand gives | Why a user feels it |
|---|---|---|
| Prices that are actually prices | USDC as a native asset, 6 decimals | $0.005 is 5000 units, exactly. No oracle, no conversion table, no drift between the quote and the charge. |
| Buyers who hold one thing | Fee sponsorship inside an atomic group | An agent funds a USDC balance and nothing else. Onboarding drops from two assets to one. |
| Fees that do not eat the sale | A flat fee near zero, paid by the facilitator | A $0.002 call is viable. Where fees are variable and high, it simply is not. |
| Settlement inside a request | Instant finality, seconds not minutes | Payment fits inside the HTTP round trip, so an agent is never left holding a pending call. |
| Someone else to run the plumbing | GoPlausible's hosted facilitator | No key, no signup, and no infrastructure of ours in the settlement path. |

The previous version of this project settled on another chain, and the port took
a chain abstraction rather than a rewrite. Everything above is why Algorand is
now the default, not merely the newest option.

***

## The business

**We take a cut of what settles. Nothing settles, we earn nothing.**

| | |
|---|---|
| Revenue model | **80 / 20.** The publisher keeps 80% of every call; the marketplace takes 20%, and only on money that actually moved. |
| No floor | **$0.002 works.** No minimum charge, no monthly fee and no invoice, because settlement costs the seller nothing to receive. |
| Aligned | **Usage, not seats.** A listing nobody calls costs us nothing and earns us nothing. |

### Why it compounds

- **Reputation cannot be moved.** A listing's standing comes from settled
  payments, so it cannot be carried to a competitor or bought.
- **Discovery is the moat.** Agents shop where the catalog is. Publishers list
  where the agents are.
- **Every call is a signal.** What agents actually pay for, and at what price, is
  demand data nobody else holds.

### Where it honestly stands

- The 80/20 split is **modelled and shown in the dashboard**. On-chain, payment
  currently goes to a single treasury.
- Per-seller payouts are the next step, and need each seller to opt into USDC
  once.
- Testnet only, by design. No real money has changed hands.

***

## Proof it works

Six real settlements on Algorand testnet, 17 August 2026. Rows 3 to 6 are a
single agent run: one natural-language task, four tools discovered and paid for
in sequence against a $0.10 budget.

| # | Tool | Price | Transaction |
|---|---|---|---|
| 1 | algo-market-data | $0.002 | [`KD6GTL4RAXJK…`](https://lora.algokit.io/testnet/transaction/KD6GTL4RAXJKJWEYSKUTBOX5ZWSMFXI6WENDZ4ZFMVXS4KEIEAGA) |
| 2 | algo-market-data | $0.002 | [`WIJM6C3ZSY56…`](https://lora.algokit.io/testnet/transaction/WIJM6C3ZSY56Z55SNG7DG3KPVW5SBAGJA5WPQX2P7F75TDGHIJ4Q) |
| 3 | algo-market-data | $0.002 | [`K3NVOG7AGNC3…`](https://lora.algokit.io/testnet/transaction/K3NVOG7AGNC3PFGLNMWMXNZVZFSQ6AJJ36RTKAJXZELRRPCN3ESA) |
| 4 | page-scraper | $0.005 | [`GMLZAZZQFMWV…`](https://lora.algokit.io/testnet/transaction/GMLZAZZQFMWVEPGBTIWVEAUT6QRW7GTFBXMUTMTNS2TPLONR6W7A) |
| 5 | text-summarizer | $0.010 | [`D6TUZOEVJSCY…`](https://lora.algokit.io/testnet/transaction/D6TUZOEVJSCYAU5U3ROQ4OFHTEPZ3ZDINTQNLEBGPDAUHAZJW3UA) |
| 6 | rwa-attestor | $0.020 | [`HI4JXJ66QDIX…`](https://lora.algokit.io/testnet/transaction/HI4JXJ66QDIXOKM2NEBTGGLUNVLYJYCHWICZS2YOE7XLFCC7GMBQ) |

Two more settled against **<https://agentifyos.xyz>** itself rather than a dev
server, thousands of rounds apart, so the deployment takes real payments as a
matter of course: [`5L67OPDLGB7H…`](https://lora.algokit.io/testnet/transaction/5L67OPDLGB7HMD6VOSQNEPYUL6Z5PVRVEPM37BXXYBQBIV7D5SMA)
and [`VUML2MX5KRZJ…`](https://lora.algokit.io/testnet/transaction/VUML2MX5KRZJREHAZUQDH2FLTKWULHRBQ6HSXTZ7IAABSPSAYLVA).

**The buyer paid no network fee, and we can show it rather than say it.** Across
all six settlements the buyer's USDC went 20.0000 → 19.9590 while its ALGO stayed
at 3.9990, unchanged to the microALGO.

`docs/PROOF.md` reads transaction 1 straight off the public Algorand indexer,
including the two-transaction group and the buyer's fee of zero.

***

## Where it stands

### Working today

- A catalog of 14 paid listings, discoverable by humans and machines
- Real x402 settlement in USDC on Algorand testnet, 6 transactions on chain
- An agent that plans a task, buys four tools and respects a budget
- CLI and MCP server, both ordinary x402 clients with their own keys
- A chain picker that moves the whole product between two chains

### Next, in order

1. **Wallet checkout** with Pera and Defly, so a buyer pays from their own wallet
   instead of a demo account.
2. **Per-seller payouts**, turning the 80/20 split from modelled into settled.
3. **Mainnet**, which is the same code path and one environment variable.
4. **Cross-market discovery**, so agents shop every x402 seller, not only ours.

***

## Try it

| | |
|---|---|
| Prototype | <https://agentifyos.xyz> |
| Agent demo | <https://agentifyos.xyz/agent> |
| The paid endpoint, returns a real 402 | <https://agentifyos.xyz/api/t/algo-market-data> |
| Machine-readable catalog | <https://agentifyos.xyz/api/discovery/resources> |
| Repo | <https://github.com/0xWeb3Research/agentifyos> |

A five-minute guided walkthrough is in [DEMO-SCRIPT.md](./DEMO-SCRIPT.md).
