## Algorand is now the default settlement chain

The thing standing between an agent and a paid API was never cryptography. It was
the account: a signup form, a card, a dashboard, all built for a human. AgentifyOS
now closes that gap on Algorand, with x402 settled in USDC through the hosted
[GoPlausible facilitator](https://facilitator.goplausible.xyz).

**Why this matters as a product, not just as plumbing:**

- **Sub-cent pricing actually survives.** The buyer's transaction fee is sponsored
  by the facilitator, so a $0.002 call is a $0.002 call. Nothing eats the margin on
  the way through, which is the only reason a developer would bother listing a tool
  worth half a cent.
- **An agent needs one asset, not two.** It holds USDC and signs a transfer. It
  never has to be topped up with a gas token to spend the money it already has.
  That removes the babysitting step that quietly kills autonomy.
- **A price is a dollar.** USDC has six decimals, so $0.005 quotes exactly `5000`
  atomic units. No oracle in the pricing path, nothing approximate, and a budget
  cap an agent builder can reason about.

### Measured, not asserted

Six real settlements on testnet, plus two against the deployed domain with no
privileged shortcut:

| | |
|---|---|
| Settlements | 8, priced $0.002 to $0.020 |
| Buyer's USDC | 20.0000 → 19.9590 |
| Buyer's ALGO | 3.9990 before, 3.9990 after |
| Against production | [`5L67OPDL…`](https://lora.algokit.io/testnet/transaction/5L67OPDLGB7HMD6VOSQNEPYUL6Z5PVRVEPM37BXXYBQBIV7D5SMA) and [`VUML2MX5…`](https://lora.algokit.io/testnet/transaction/VUML2MX5KRZJREHAZUQDH2FLTKWULHRBQ6HSXTZ7IAABSPSAYLVA), thousands of rounds apart |

Four of those were a single agent run: one task, four tools discovered and paid for
in sequence against a $0.10 budget. Every payment is a two transaction atomic group,
the facilitator's fee leg plus the buyer's USDC transfer with a fee of zero, so
either both execute or neither does. [PROOF](https://agentifyos.xyz/docs) reads the
first one straight off the public indexer rather than off our own ledger.

### The chain became a choice

Settlement used to be a build time constant. It is now a per request one: a switcher
in the nav re-quotes every price and its units, swaps the network and asset, changes
which signer moves the money, repoints every explorer link, and even serves a
different demo film so the run on screen settles in the asset the page is quoting.
Casper is still fully supported behind that switch.

### What we are not claiming

We expected resources to list in the facilitator's public Bazaar as a side effect
of being paid at a publicly reachable URL. Both production settlements above did
exactly that, and we still do not appear in `/discovery/resources`, in
`/discovery/merchants`, or under our own payout address. So the prediction is
corrected rather than quietly dropped: we tested it, and it did not happen.
Receipts are mainnet only too, so on testnet we link the public indexer instead of
a URL that would error.

### Try it

```bash
cd apps/web
pnpm algo:preflight   # checks accounts, opt-ins, facilitator, SDK constants
pnpm algo:demo        # funds the agent, pays, prints the proof
```

[Live demo](https://agentifyos.xyz/agent) · [Runbook](https://agentifyos.xyz/docs)
