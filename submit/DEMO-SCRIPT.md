# Demo script

Five minutes, for the mentoring round. The shape is: make them feel the problem,
show the product solving it, then prove the money was real.

Lead with the product. The evaluators will check the x402 integration
themselves, and [EVALUATOR-NOTES.md](./EVALUATOR-NOTES.md) answers that in
writing, so do not spend the demo reading code aloud.

***

## Before you start

Open these tabs in this order, so you never search for anything live:

1. `https://agentifyos.xyz` (the catalog)
2. `https://agentifyos.xyz/agent` (the demo, not yet run)
3. `https://lora.algokit.io/testnet/transaction/KD6GTL4RAXJKJWEYSKUTBOX5ZWSMFXI6WENDZ4ZFMVXS4KEIEAGA`
4. A terminal, in `apps/web`, with nothing running

Have a fallback: if the live run fails, the six settled transactions in
`docs/PROOF.md` are already on chain and prove the same thing. Say so plainly
rather than retrying into silence.

***

## 0:00 · The problem, in one breath

> An AI agent can reason, but it cannot buy. Every API it wants is behind a
> signup form and a credit card built for a human. So today somebody has to guess
> in advance which tools an agent will need, provision the keys, and hope.
>
> We built the other side of that: a marketplace where the agent shops for
> itself.

Do not explain x402 yet. Explain it when they see a price appear.

## 0:30 · The catalog (tab 1)

Scroll the catalog. Point at one listing.

> Fourteen paid tools. Each one has a price, a schema, and an address that gets
> paid. Publishing one is a manifest and a price, not a billing system. That is
> the pitch to a developer: you have something worth half a cent a call, and
> right now there is no way to sell it.

Click a listing, show the price and the input schema.

## 1:15 · The agent buys things (tab 2) · the important 90 seconds

Type the task rather than using a preset, so it is obviously live:

```
Get the live ALGO price, scrape https://algorand.co/blog,
summarize it, and attest the summary.
```

Set the budget to `$0.10`. Run it.

While it runs, narrate the wire log as it appears:

> It picked four tools out of the catalog on its own. Watch the second line: the
> server just answered **HTTP 402, Payment Required**, with a price of two
> thousand microUSDC. That is two tenths of a cent.
>
> Now it signs a USDC transfer for exactly that. No account was created. No key
> was issued. It just paid.
>
> And there is the settlement, on Algorand.

When it finishes:

> Four tools, four payments, three point seven cents, and it stopped with six
> cents of its budget unspent. **The budget is the leash, not a person.**

## 2:45 · Prove the money moved (tab 3)

Click through to Lora from the receipt, or use the pre-opened tab.

> This is the block explorer, not our dashboard. A USDC transfer of two thousand
> micro-units, from the agent to the seller.
>
> Look at the fee: **zero**. The payment ships as an atomic group of two. The
> second transaction is the buyer's. The first is the facilitator's, paying the
> network fee on its behalf.
>
> That is why an agent needs one asset, not two. It never has to go and acquire
> ALGO before it can spend a dollar. Across our six settlements the buyer's ALGO
> balance did not move at all.

## 3:30 · It is an open endpoint, not a demo button (terminal)

```bash
curl -i https://agentifyos.xyz/api/t/algo-market-data
```

> No browser, no session, nothing of ours in the loop. Anyone's agent gets the
> same 402, with the network, the asset and the payee in it. The CLI and the MCP
> server that plugs into Claude are just ordinary clients of this same endpoint.

If there is time, run `pnpm algo:demo` and let it settle live.

## 4:15 · The business, and what is next

> We take twenty percent of what settles. Nothing settles, we earn nothing.
>
> The interesting number is not ours. GoPlausible's facilitator is clearing
> twelve and a half thousand x402 payments a day, from a hundred and twenty seven
> merchants, and ninety nine percent of the listed resources are on Algorand.
> Twelve thousand payments a day against a hundred sellers is not a demand
> problem. It is a supply problem. We are building the supply.
>
> Next is wallet checkout with Pera, so you could pay for one of these yourself
> from your own wallet, and per-seller payouts so the eighty twenty split settles
> on chain instead of being modelled.

***

## Questions to expect, and honest answers

**"Is this actually on Algorand, or a mock?"**
Six settlements on testnet, transaction ids in `docs/PROOF.md`, each one
checkable on Lora and on the public indexer. The demo you just watched settled
four of them.

**"Does the payment really go through GoPlausible?"**
It is the only settlement path. We hold no facilitator key on Algorand and submit
nothing ourselves. `pnpm algo:preflight` prints the fee sponsor address the
facilitator advertises, and that same address appears in every transaction group.

**"Are the tools real, or stubs?"**
The handlers are deterministic first-party implementations, so the demo runs
offline and reproducibly. The payment layer is what is real. A third-party
listing would proxy to its own origin, and the manifest already carries that
field.

**"Why not mainnet?"**
Same code path and one environment variable. We kept it on testnet because
nothing here should move real money before wallet checkout and per-seller payouts
land.

**"So the 80/20 split is not enforced on-chain?"**
Correct, and the deck says so. Today the payment goes to one treasury and the
split is shown in the dashboard. Per-seller payouts need each seller to opt into
USDC once, and `resolvePayTo()` is the single place that changes.

**"What happens if the facilitator is down?"**
The paid endpoint answers 503 naming the facilitator, rather than pretending to
charge. We deliberately do not fall back to settling it ourselves, because that
would mean holding keys we told you we do not hold.

**"What did you actually build, versus the SDK?"**
Every line of the payment protocol is `@x402-avm`. We built the market: the
catalog, discovery, the agent, reputation from settled payments, and the receipts.
The one-line version is on slide 11.

***

## If something breaks

| Symptom | Say this, then move on |
|---|---|
| The agent run errors | "The six settlements in PROOF are already on chain, let me show you one." Go to tab 3. |
| The site is slow to wake | Talk over it: the catalog tab is already loaded, use that. |
| Lora will not load | The public indexer is the fallback: `testnet-idx.algonode.cloud/v2/transactions/<txid>`. |
| Asked for something not built | Say it is not built, say where it would go, move on. The roadmap slide is the honest answer, not an improvised one. |
