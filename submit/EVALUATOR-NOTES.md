# Notes for the evaluator

**AgentifyOS is the marketplace where AI agents shop for tools.** A developer
lists a paid API in 60 seconds. An agent finds it mid-task, pays a fraction of a
cent in USDC, and gets on with the job. No signup, no API key, no human in the
loop.

x402 is the payment layer underneath that, not the product. The brief said five
things would be checked, so each one below starts with **what you can see**, then
says where the code is. The product story is in [PRODUCT.md](./PRODUCT.md) and
`deck.pdf`.

**The fastest possible check**, if you only do one thing:

```bash
curl -i https://agentifyos.xyz/api/t/algo-market-data
```

A real `402 Payment Required`, quoting 2000 microUSDC on Algorand testnet, with
the network, the asset, the payee and the facilitator's fee sponsor in it.

***

## 1. The x402 flow is live on Algorand testnet

### What you can see

Open <https://agentifyos.xyz/agent>, type a task, and watch the wire log: the
402, the signature, the settlement, the receipt. Or `curl` the endpoint above and
read the challenge yourself.

```
HTTP/1.1 402 Payment Required
payment-required: eyJ4NDAyVmVyc2lvbiI6MiwiZXJyb3IiOiJwYXltZW50X3JlcXVpcmVkIi...

{
  "x402Version": 2,
  "error": "payment_required",
  "accepts": [{
    "scheme": "exact",
    "network": "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=",
    "amount": "2000",
    "asset": "10458941",
    "payTo": "…",
    "maxTimeoutSeconds": 120,
    "extra": { "decimals": 6, "feePayer": "ZMFK2OI7ZBD2U27ISERZC4S6LKM6WMFJPZQ4MYNJDZ2VNBNMBA67RA22AA" }
  }],
  "extensions": { "bazaar": { … } }
}
```

`2000` is `$0.002` in microUSDC. `extra.feePayer` is not ours: it is read at
startup from the facilitator's `GET /supported`, and it is what makes the payment
gasless for the buyer.

### Where it lives

`apps/web/src/app/api/t/[slug]/route.ts`, dispatching to
`src/lib/x402/algorand-route.ts`. The challenge travels in the
`PAYMENT-REQUIRED` header, base64 JSON, which is where x402 v2 puts it and what
an SDK client actually reads. The body repeats it so `curl` stays readable.

***

## 2. A real x402 transaction, viewable on Lora

### What you can see

Six settlements on 17 August 2026. Rows 3 to 6 are a single agent run: one
natural-language task, four tools discovered and paid for in sequence against a
$0.10 budget.

| # | Tool | Price | Transaction |
|---|---|---|---|
| 1 | algo-market-data | $0.002 | [`KD6GTL4RAXJKJWEYSKUTBOX5ZWSMFXI6WENDZ4ZFMVXS4KEIEAGA`](https://lora.algokit.io/testnet/transaction/KD6GTL4RAXJKJWEYSKUTBOX5ZWSMFXI6WENDZ4ZFMVXS4KEIEAGA) |
| 2 | algo-market-data | $0.002 | [`WIJM6C3ZSY56Z55SNG7DG3KPVW5SBAGJA5WPQX2P7F75TDGHIJ4Q`](https://lora.algokit.io/testnet/transaction/WIJM6C3ZSY56Z55SNG7DG3KPVW5SBAGJA5WPQX2P7F75TDGHIJ4Q) |
| 3 | algo-market-data | $0.002 | [`K3NVOG7AGNC3PFGLNMWMXNZVZFSQ6AJJ36RTKAJXZELRRPCN3ESA`](https://lora.algokit.io/testnet/transaction/K3NVOG7AGNC3PFGLNMWMXNZVZFSQ6AJJ36RTKAJXZELRRPCN3ESA) |
| 4 | page-scraper | $0.005 | [`GMLZAZZQFMWVEPGBTIWVEAUT6QRW7GTFBXMUTMTNS2TPLONR6W7A`](https://lora.algokit.io/testnet/transaction/GMLZAZZQFMWVEPGBTIWVEAUT6QRW7GTFBXMUTMTNS2TPLONR6W7A) |
| 5 | text-summarizer | $0.010 | [`D6TUZOEVJSCYAU5U3ROQ4OFHTEPZ3ZDINTQNLEBGPDAUHAZJW3UA`](https://lora.algokit.io/testnet/transaction/D6TUZOEVJSCYAU5U3ROQ4OFHTEPZ3ZDINTQNLEBGPDAUHAZJW3UA) |
| 6 | rwa-attestor | $0.020 | [`HI4JXJ66QDIXOKM2NEBTGGLUNVLYJYCHWICZS2YOE7XLFCC7GMBQ`](https://lora.algokit.io/testnet/transaction/HI4JXJ66QDIXOKM2NEBTGGLUNVLYJYCHWICZS2YOE7XLFCC7GMBQ) |

If you would rather not trust an explorer we chose, read transaction 1 off the
public indexer:

```bash
curl -s https://testnet-idx.algonode.cloud/v2/transactions/KD6GTL4RAXJKJWEYSKUTBOX5ZWSMFXI6WENDZ4ZFMVXS4KEIEAGA
```

```
type    axfer          amount 2000 micro of ASA 10458941     fee 0
group   02BZJmMnkq3r6WoiGu3LjtyxCo4Si6KBy5wW02MDmh0=
note    x402-payment-v2-1786944043684
```

The group has exactly two members: GoPlausible's fee sponsor paying 2000
microALGO with note `x402-fee-payer`, and the buyer's USDC transfer with a fee of
**0**. Across all six settlements the buyer's USDC went 20.0000 → 19.9590 while
its ALGO stayed at 3.9990. The gasless claim is measured, not asserted.

To reproduce from a clean checkout, `docs/ALGORAND.md` is the ten-minute runbook
and the last step is one command, `pnpm algo:demo`.

### One thing we do not claim

Receipts return `facilitatorReceiptUrl: null`. GoPlausible's `/api/receipt/{txid}`
answers `receipts are available for Algorand, Base and Solana MainNet settlements
only`, so emitting a URL there would hand you a link that errors. The independent
check that does work on testnet is the public indexer above.

***

## 3. The payment goes through the GoPlausible facilitator

### What you can see

`pnpm algo:preflight` connects to the facilitator and prints the fee sponsor it
advertises. That same address then appears in every settled transaction group,
which you can confirm on Lora.

```
✓  facilitator reachable and serving this network  https://facilitator.goplausible.xyz
✓  facilitator sponsors the fee  ZMFK2OI7ZBD2U27ISERZC4S6LKM6WMFJPZQ4MYNJDZ2VNBNMBA67RA22AA
```

### Where it lives

There is exactly one settlement path and it is the facilitator.
`apps/web/src/lib/x402/algorand.ts`:

```ts
const facilitator = new HTTPFacilitatorClient({ url: TESTNET.facilitatorUrl });
const server = new x402ResourceServer(facilitator)
  .register(TESTNET.network, new ExactAvmScheme())
  .registerExtension(bazaarResourceServerExtension);
await server.initialize();
```

`TESTNET.facilitatorUrl` defaults to `https://facilitator.goplausible.xyz`
(`src/lib/chain.ts`). `verifyPayment` and `settlePayment` in the same file
delegate to it. We hold no facilitator key on Algorand and submit nothing
ourselves, and there is deliberately no fallback that would let us: if the
facilitator is unreachable the endpoint answers 503 naming it, rather than
pretending to charge.

***

## 4. `@x402-avm` dependencies are in package.json

`apps/web/package.json`:

```json
"@x402-avm/avm": "2.6.1",
"@x402-avm/core": "2.6.1",
"@x402-avm/extensions": "2.6.1",
"@x402-avm/fetch": "2.6.1",
"algosdk": "^3.6.0"
```

They are imported and executed, not declared and ignored:

| Package | Imported in | Doing what |
|---|---|---|
| `@x402-avm/core` | `x402/algorand.ts`, `x402/algorand-client.ts` | resource server, facilitator client, header codecs |
| `@x402-avm/avm` | `x402/algorand.ts`, `x402/algorand-client.ts`, `scripts/algorand/preflight.ts` | the AVM `exact` scheme, network constants, client signer |
| `@x402-avm/extensions` | `x402/algorand.ts` | the Bazaar discovery extension |
| `@x402-avm/fetch` | `x402/algorand-client.ts`, `scripts/algorand/pay-real.ts` | `wrapFetchWithPayment`, behind `paymentEnabledFetch()`. Runnable with `pnpm algo:pay --wrapped`, which settled transaction 2 above |
| `algosdk` | `x402/algorand.ts`, `scripts/algorand/*` | accounts, balances, ASA opt-in, funding transfers. Not the payment itself |

The previous submission carried `@x402/core` and `@x402/fetch` as dependencies
that nothing imported. Those are removed, along with `@make-software/casper-x402`.
Every package listed above is on an executed code path, and `--wrapped` exercises
the one that would otherwise be easiest to declare and ignore.

`pnpm algo:preflight` also asserts at runtime that our CAIP-2 network id and USDC
asset id still match the SDK's own constants, so a version bump cannot silently
change what we quote.

***

## 5. x402 is genuinely integrated

The honest summary of who does what:

| Step | Who |
|---|---|
| Decide the price and the payee | us |
| Build `PaymentRequirements` | `x402ResourceServer.buildPaymentRequirements` |
| Emit the 402, with headers | `createPaymentRequiredResponse` + `encodePaymentRequiredHeader` |
| Build and sign the payment group | `ExactAvmScheme` (client) via `x402HTTPClient.createPaymentPayload` |
| Encode the payment header | `encodePaymentSignatureHeader` |
| Match the payment to the requirements | `x402ResourceServer.findMatchingRequirements` |
| Verify | facilitator, via `x402ResourceServer.verifyPayment` |
| Settle and broadcast | facilitator, via `x402ResourceServer.settlePayment` |
| Sponsor the fee | facilitator |
| Catalog, discovery, the agent, reputation, receipts | us |

Nothing about the protocol is reimplemented. The one deliberate deviation from
the template's shape: the app is Next.js App Router, so instead of
`paymentMiddleware` from `@x402-avm/express` it drives the transport-agnostic
`x402ResourceServer` directly from a route handler. Same protocol, same SDK, one
fewer framework in the way.

### Where to read the code, in order

| File | Lines | What to look at |
|---|---|---|
| `apps/web/src/lib/chain.ts` | ~190 | which chain settles, and everything derived from it |
| `apps/web/src/lib/x402/algorand.ts` | ~380 | the resource server, verify, settle, accounts, opt-in |
| `apps/web/src/lib/x402/algorand-route.ts` | ~160 | the seller half, start to finish |
| `apps/web/src/lib/x402/algorand-client.ts` | ~210 | the buyer half, one step at a time |
| `apps/web/src/lib/x402/algorand-loop.ts` | ~110 | the on-site agent, paying over real HTTP |
| `apps/web/scripts/algorand/preflight.ts` | ~110 | every prerequisite, checked independently |

***

## Two things worth knowing about the mechanics

**The buyer pays no network fee, but is not at zero ALGO.** The facilitator
advertises a fee-sponsoring account; `ExactAvmScheme` builds a two-transaction
atomic group whose first leg is that sponsor's fee transaction and whose second is
the buyer's USDC transfer with a fee of 0. The buyer signs only its own leg. It
still holds Algorand's locked minimum balance of about 0.2 ALGO, which never
moves. We say "spends no ALGO", not "holds none", because the second would be
false.

**Receivers must opt into the asset.** Algorand will not credit USDC to an account
that has not opted into ASA 10458941. That applies to the buyer and to every
payee. On Casper each seeded publisher had its own derived account and nothing
needed to exist on-chain; on Algorand a payee must be real and opted in, so every
listing currently settles into the one treasury account we maintain. This is why
the 80/20 split is modelled in the dashboard rather than settled on-chain today.
`resolvePayTo()` in `src/lib/config.ts` is the single place that decision lives,
and per-seller payouts are the next item on the roadmap.

***

## Casper is still there, and switchable from the page

The nav has a chain picker. Choosing one writes a cookie that the server reads
per request, so the switch changes the whole stack on the same request, not a
badge:

| What | Algorand | Casper |
|---|---|---|
| Quoted amount for a $0.002 call | `2000` microUSDC | `86580087` motes of WCSPR |
| CAIP-2 network | `algorand:SGO1…` | `casper:casper-test` |
| Asset | ASA `10458941` | package `3d80df21…` |
| Signer | `@x402-avm` exact scheme | EIP-712 over Ed25519 |
| Who broadcasts | GoPlausible | our own facilitator key |
| Receipt link | Lora | cspr.live |

Verifiable in one command:

```bash
curl -s https://agentifyos.xyz/api/t/algo-market-data | jq -c '.accepts[0]'
curl -s -H 'Cookie: agentifyos-chain=casper' https://agentifyos.xyz/api/t/algo-market-data | jq -c '.accepts[0]'
```

`src/lib/chain-server.ts` resolves it, `src/components/chain-context.tsx` seeds
the browser from the same value, and `src/components/chain-switcher.tsx` is the
control. Algorand is the default, and a chain this deployment holds no keys for is
marked in the picker and answers 503 rather than pretending to charge.
