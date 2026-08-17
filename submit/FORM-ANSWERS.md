# Form answers

Brainwave 2026 · Resubmission Track. Paste-ready. Four fields marked **FILL IN**
are the only ones nobody else can answer.

***

## The fields

### Full Name *
```
FILL IN
```

### Email Address *
```
sidharthpunathil714@gmail.com
```
The form is signed in with this Google account. Use the same address unless you
want correspondence elsewhere.

### Contact Number *
```
FILL IN
```

### Team Name *
```
FILL IN
```

### PPT/PDF Submission for Blockchain Track *
Upload **`submit/deck.pdf`**. 12 slides, landscape, 0.34 MB, well inside the
10 MB limit. Rebuild with `node build-deck.mjs` if anything changes.

### Prototype Link *
```
https://agentifyos.xyz
```

### Github Repo *
```
https://github.com/0xWeb3Research/agentifyos
```
The repo moved from `sidharthpunathil/agentifyos`, which still redirects. Submit
the canonical URL above so the link does not depend on a redirect.

***

## If there is a free-text field

**One line:**

> AgentifyOS is the marketplace where AI agents shop for tools: a developer lists
> a paid API in 60 seconds, and an agent finds it mid-task and pays a fraction of
> a cent for it, with no signup, no API key and no human in the loop.

**One paragraph:**

> An AI agent can reason, but it cannot buy, because every API it wants is behind
> a signup form built for a human. x402 standardised how a machine pays over
> HTTP, but almost nothing sells anything through it. AgentifyOS is the supply
> side: a catalog of 14 paid tools that agents discover and pay for per call, in
> USDC on Algorand, settled through the GoPlausible facilitator. The buyer pays
> no network fee, so an agent needs one asset rather than two. Six payments have
> settled on testnet and every one is verifiable on Lora. We take 20% of what
> settles, and nothing else.

***

## What changed since the last round

> The previous submission settled on Casper. This one settles on Algorand
> testnet: payments are USDC (ASA 10458941) moved through the hosted GoPlausible
> facilitator, using the `@x402-avm/core`, `/avm`, `/fetch` and `/extensions`
> SDKs. The buyer signs an ASA transfer inside a two-transaction atomic group and
> the facilitator sponsors the network fee, so an agent pays in USDC and spends
> no ALGO. Six payments have settled and each is verifiable on Lora and on the
> public indexer. Algorand is the default; the Casper path is still selectable
> from a picker in the nav, so nothing was thrown away.

***

## A tour, if an evaluator asks what to click

Five minutes, in this order. The narrated version is in
[DEMO-SCRIPT.md](./DEMO-SCRIPT.md).

| # | Open | What it shows |
|---|---|---|
| 1 | <https://agentifyos.xyz> | 14 paid listings, each with a price, a schema and a payout address |
| 2 | <https://agentifyos.xyz/agent> | Type a task. An agent plans it, buys four tools, and shows every payment on the wire |
| 3 | [`KD6GTL4RAXJK…` on Lora](https://lora.algokit.io/testnet/transaction/KD6GTL4RAXJKJWEYSKUTBOX5ZWSMFXI6WENDZ4ZFMVXS4KEIEAGA) | A settled USDC transfer, with the buyer's fee at **0** |
| 4 | `curl -i https://agentifyos.xyz/api/t/algo-market-data` | A real HTTP 402, with the network, asset and payee in it |
| 5 | <https://agentifyos.xyz/dashboard> | Earnings and settled calls, the reputation those payments produced |

***

## Answering the brief's five checks

[EVALUATOR-NOTES.md](./EVALUATOR-NOTES.md) has the full version with file
pointers. In short:

| Check | Where it is satisfied |
|---|---|
| x402 flow live on Algorand testnet | `GET /api/t/[slug]` answers a real 402; six payments have settled |
| A real x402 transaction on lora.algokit.io/testnet | six of them, listed in `docs/PROOF.md` |
| Payment goes through the GoPlausible facilitator | it is the only settlement path; we hold no facilitator key |
| `@x402-avm` dependencies in package.json | core, avm, fetch and extensions, all 2.6.1, all imported and executed |
| x402 genuinely integrated, not decorative | the SDK builds the challenge, signs the group, verifies and settles |
