# On-chain proof

Real settlements, on two chains, with nothing simulated. **Algorand testnet is
the current default path**; the Casper transactions further down are genuine and
kept as the historical record of the original implementation.

---

## Algorand testnet · the current path

Network: `algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=` · asset USDC
([ASA 10458941](https://lora.algokit.io/testnet/asset/10458941), 6 decimals) ·
facilitator [GoPlausible](https://facilitator.goplausible.xyz) · explorer
[Lora](https://lora.algokit.io/testnet).

### Three independent ways to check one settlement

Only one of them is ours, which is the point.

| # | Source | Where | Whose record |
|---|---|---|---|
| 1 | **Algorand itself, via Lora** | `https://lora.algokit.io/testnet/transaction/<txid>` | the chain's |
| 2 | **The facilitator** | `https://facilitator.goplausible.xyz/api/receipt/<txid>` | GoPlausible's |
| 3 | **Our ledger** | `/dashboard`, or `GET /api/settlements` | ours |

Every receipt the app returns carries `txHash`, `explorerUrl`, and
`facilitatorReceiptUrl`, so a reader never has to take our ledger's word for
anything:

```bash
curl -s "https://facilitator.goplausible.xyz/api/receipt/$TXID"
curl -s "https://agentifyos.xyz/api/settlements?limit=5"
```

Lora reads the public indexer, which you can also query directly at
`https://testnet-idx.algonode.cloud/v2/transactions/<txid>` if you would rather
not trust an explorer either.

**What to look for on Lora.** The transaction sits in a **group of two**. One
member is a 0-ALGO payment from
`ZMFK2OI7ZBD2U27ISERZC4S6LKM6WMFJPZQ4MYNJDZ2VNBNMBA67RA22AA`, GoPlausible's fee
sponsor, to itself: that is the fee being paid for the buyer. The other is the
buyer's **USDC asset transfer** with a fee of **0**. Both share one group id, so
either both executed or neither did.

### Settled transactions

Six real settlements on Algorand testnet, 17 August 2026. Every one is an x402
payment: HTTP 402, a signed USDC transfer, settled by the GoPlausible
facilitator.

| # | Tool | Price | Path | Transaction |
|---|---|---|---|---|
| 1 | algo-market-data | $0.002 | `pnpm algo:demo` | [`KD6GTL4RAXJKJWEYSKUTBOX5ZWSMFXI6WENDZ4ZFMVXS4KEIEAGA`](https://lora.algokit.io/testnet/transaction/KD6GTL4RAXJKJWEYSKUTBOX5ZWSMFXI6WENDZ4ZFMVXS4KEIEAGA) |
| 2 | algo-market-data | $0.002 | `wrapFetchWithPayment` | [`WIJM6C3ZSY56Z55SNG7DG3KPVW5SBAGJA5WPQX2P7F75TDGHIJ4Q`](https://lora.algokit.io/testnet/transaction/WIJM6C3ZSY56Z55SNG7DG3KPVW5SBAGJA5WPQX2P7F75TDGHIJ4Q) |
| 3 | algo-market-data | $0.002 | agent run, step 1 | [`K3NVOG7AGNC3PFGLNMWMXNZVZFSQ6AJJ36RTKAJXZELRRPCN3ESA`](https://lora.algokit.io/testnet/transaction/K3NVOG7AGNC3PFGLNMWMXNZVZFSQ6AJJ36RTKAJXZELRRPCN3ESA) |
| 4 | page-scraper | $0.005 | agent run, step 2 | [`GMLZAZZQFMWVEPGBTIWVEAUT6QRW7GTFBXMUTMTNS2TPLONR6W7A`](https://lora.algokit.io/testnet/transaction/GMLZAZZQFMWVEPGBTIWVEAUT6QRW7GTFBXMUTMTNS2TPLONR6W7A) |
| 5 | text-summarizer | $0.010 | agent run, step 3 | [`D6TUZOEVJSCYAU5U3ROQ4OFHTEPZ3ZDINTQNLEBGPDAUHAZJW3UA`](https://lora.algokit.io/testnet/transaction/D6TUZOEVJSCYAU5U3ROQ4OFHTEPZ3ZDINTQNLEBGPDAUHAZJW3UA) |
| 6 | rwa-attestor | $0.020 | agent run, step 4 | [`HI4JXJ66QDIXOKM2NEBTGGLUNVLYJYCHWICZS2YOE7XLFCC7GMBQ`](https://lora.algokit.io/testnet/transaction/HI4JXJ66QDIXOKM2NEBTGGLUNVLYJYCHWICZS2YOE7XLFCC7GMBQ) |

<!-- ALGORAND-PROOF -->

Rows 3 to 6 are a single agent run: one natural-language task, four tools
discovered and paid for in sequence, metered against a $0.10 budget and stopping
with $0.063 unspent.

### The balances, before and after

The six payments total exactly $0.041, and that is exactly what moved.

| Account | USDC before | USDC after | ALGO before | ALGO after |
|---|---|---|---|---|
| agent (buyer) | 20.0000 | 19.9590 | 3.9990 | **3.9990** |
| treasury (seller) | 20.0000 | 20.0410 | 3.9990 | **3.9990** |

**Neither account's ALGO moved.** That is the gasless claim, measured rather than
asserted: six settlements, and the buyer's native balance is unchanged to the
microALGO.

### Reading transaction 1 on the public indexer

Not our server, not our database, and not even an explorer:

```bash
curl -s https://testnet-idx.algonode.cloud/v2/transactions/KD6GTL4RAXJKJWEYSKUTBOX5ZWSMFXI6WENDZ4ZFMVXS4KEIEAGA
```

```
type      axfer
sender    SMT5SJCV322CQ6SBYFCDBGWWXGOQULQ5CKXKJOHHTTZRDUDV2XDMLYYXQQ   the agent
receiver  W7TYQROP7L6O6QEBVR675D4O3DT2DQUMSX4UIRYNYWV2W26MKSH5IN3ERY   the treasury
amount    2000 micro of ASA 10458941                                    $0.002 in USDC
fee       0                                                             the buyer pays nothing
group     02BZJmMnkq3r6WoiGu3LjtyxCo4Si6KBy5wW02MDmh0=
note      x402-payment-v2-1786944043684
round     66389819
```

And the group it belongs to has exactly two members:

```
pay    sender ZMFK2OI7ZBD2…  fee 2000  note "x402-fee-payer-1786944043683"
axfer  sender SMT5SJCV322C…  fee    0  note "x402-payment-v2-1786944043684"
```

The `pay` is GoPlausible's fee sponsor covering both transactions. The `axfer` is
the buyer's USDC transfer with a fee of zero. They share one group id, so either
both executed or neither did. The `x402-payment-v2` note is the protocol's own
marker, written by the SDK and not by us.

### What is not here

- **No facilitator receipt links.** GoPlausible's `/api/receipt/{txid}` answers
  `receipts are available for Algorand, Base and Solana MainNet settlements
  only`, so on testnet there is nothing to link. `facilitatorReceipt()` returns
  null rather than handing out a URL that errors.
- **Not yet visible in the public Bazaar.** Listing happens when a resource is
  paid for at a publicly reachable URL. The six above settled against
  `http://localhost:8402`, and the production settlement below settled against
  `https://agentifyos.xyz`, which is the condition for listing. It had not
  appeared at <https://facilitator.goplausible.xyz/discovery/resources> when this
  was written, and we would rather say that than claim a listing nobody can see.

### Settled against production

The same handshake against the deployed domain, with no privileged shortcut:

```bash
cd apps/web && pnpm algo:pay --base https://agentifyos.xyz
```

| Tool | Price | Transaction |
|---|---|---|
| algo-market-data | $0.002 | [`5L67OPDLGB7HMD6VOSQNEPYUL6Z5PVRVEPM37BXXYBQBIV7D5SMA`](https://lora.algokit.io/testnet/transaction/5L67OPDLGB7HMD6VOSQNEPYUL6Z5PVRVEPM37BXXYBQBIV7D5SMA) |

The agent's ALGO balance was unchanged across it, same as every row above.

### Setup transactions

These are **not** x402 payments, and are listed separately so nothing here is
mistaken for one. They are the on-chain opt-ins that make the accounts able to
hold USDC at all, and they are worth checking because they prove the two demo
accounts are real and correctly configured.

| Account | What | Transaction id |
|---|---|---|
| treasury | opt in to ASA 10458941 | [`CUYJJA2YLWELL57FX3GTJETSPYWD2TENIT6SU7ZAPONYVSSD6OCA`](https://lora.algokit.io/testnet/transaction/CUYJJA2YLWELL57FX3GTJETSPYWD2TENIT6SU7ZAPONYVSSD6OCA) |
| agent | opt in to ASA 10458941 | [`QWS6XV3NYYF3I6CL7JYYAQ4EMQ44Z6H2JVPWSOSZXIR64JWLA43A`](https://lora.algokit.io/testnet/transaction/QWS6XV3NYYF3I6CL7JYYAQ4EMQ44Z6H2JVPWSOSZXIR64JWLA43A) |

Their effect is visible in the error the payment path returns as funding
progresses, which is itself a useful trace of how far the pipeline gets:

| State | What the facilitator's simulator says |
|---|---|
| before opt-in | `asset 10458941 missing from SMT5SJCV32…` |
| after opt-in, before funding | `underflow on subtracting 2000 from sender amount 0` |
| funded | settles, and a row appears in the table above |

The second error is emitted by Algorand's own simulator inside the facilitator.
Reaching it means the 402, the atomic group, the buyer's signature, the handoff
to the facilitator and its fee-leg signature all worked.

### Produce one yourself, in about a minute

With the two accounts from `pnpm algo:keygen` funded and opted in (the
[Algorand runbook](./ALGORAND.md) is the ten-minute version):

```bash
cd apps/web
pnpm algo:preflight          # every prerequisite, checked one line at a time
pnpm dev                     # in one terminal
pnpm algo:pay                # in another
```

`algo:pay` calls the public paid endpoint over HTTP with no privileged shortcut:
it takes the 402, signs a USDC transfer, retries, and prints the transaction id,
the Lora link, the facilitator's receipt link, and the agent's balance before and
after. Point it at a deployed instance with `--base https://agentifyos.xyz`.

The line that matters in its output is the last one: the agent's **ALGO balance
is unchanged**, because the facilitator paid the fee. Its USDC balance dropped by
exactly the quoted amount.

### What "the agent pays no fee" does and does not mean

| Claim | True? |
|---|---|
| The buying agent spends no ALGO on transaction fees | **yes**, the facilitator's sponsor pays them |
| The buying agent holds no ALGO at all | **no** |

Algorand locks a **minimum balance** against every account: 0.1 ALGO for
existing, plus 0.1 ALGO for holding one asset. So a buying agent keeps roughly
**0.2 ALGO locked** that it can never spend and never moves. That reserve is the
honest asterisk on "gasless", and the balance printed before and after a payment
is where you can see it sitting still.

---

## Casper testnet · the original path, historical

Every hash in this section is a **real transaction on Casper testnet**, executed
2026-07-19, when Casper was the only settlement chain. They still resolve on the
public explorer. They are kept here as evidence for the Casper path, which is
still selectable with `CHAIN=casper` and documented in the
[Casper runbook](./TESTNET.md).

Network: `casper-test` · protocol 2.2.2 · explorer [testnet.cspr.live](https://testnet.cspr.live)

### The headline

**An autonomous agent paid for four tools in one task, holding zero CSPR.**

| # | Tool | Price | Deploy |
|---|---|---|---|
| 1 | `algo-market-data` | $0.002 | [`907f08f6…a925`](https://testnet.cspr.live/deploy/907f08f6a4ccd569fb4bde9babf63bb80a273c017772dd3bded39c29d047a925) |
| 2 | `page-scraper` | $0.005 | [`86d61db6…7b85`](https://testnet.cspr.live/deploy/86d61db62442d867adde20254cedab64525b65d578139fbe171ade11ee257b85) |
| 3 | `text-summarizer` | $0.010 | [`0db4cbf1…1420`](https://testnet.cspr.live/deploy/0db4cbf14be6d6e2d30dc1035447ec466de3026e2c0f0eeb2ee642dbc55a1420) |
| 4 | `rwa-attestor` | $0.020 | [`3d438f24…acf2`](https://testnet.cspr.live/deploy/3d438f2451054c4bb482ff363a4612b0e1974c7777440638ae9d5d45b2c0acf2) |

Total paid **$0.037**, budget metered down from $0.100, four independent
`transfer_with_authorization` settlements.

### Setting up the economy

| Step | What happened | Deploy |
|---|---|---|
| **Wrap** | 100 CSPR → 100 WCSPR via Odra's proxy-caller **session** transaction (the payable `deposit` path a plain contract call cannot do) | [`4f837c6b…b897`](https://testnet.cspr.live/deploy/4f837c6bccf50174f0864b38b8bce42ebcc2ffa1553ea727bbf63c87175cb897) |
| **Fund agent** | 10 WCSPR treasury → agent (CEP-18 `transfer`) | [`d1e5f909…0966`](https://testnet.cspr.live/deploy/d1e5f9096ebedf979c983434f955320a48601ba21f0138b5b08d6b912b5c0966) |
| **First settlement** | The first real x402 payment | [`192a0328…7c79`](https://testnet.cspr.live/deploy/192a032853f7dd6d24974fe3cbb0a6468030c946f50ab573abade25b8ea47c79) |
| **From the web UI** | A settlement triggered by the `/agent` page in a browser | [`7bdd152d…f831`](https://testnet.cspr.live/deploy/7bdd152d37075053471edfa6ccdc03c35b41400d718a28bc68b820760639f831) |
| **Tuned gas** | Same settlement at a 4 CSPR budget instead of 7 | [`85f7fdb8…90fb`](https://testnet.cspr.live/deploy/85f7fdb83954c20f61775cbd7c455e8519f1e9431fcdb28b52ef58c7ec2790fb) |

There is no wrapping step and no gas budget in the Algorand equivalents of those
first two rows: `pnpm algo:optin` and `pnpm algo:fund --usdc 1` move USDC that is
already the settlement asset.

### What the balances prove

Measured before and after the first settlement:

| Account | Before | After | Meaning |
|---|---|---|---|
| Agent (buyer) | 10.0000 WCSPR | **9.9913** | paid 0.0087 WCSPR |
| Treasury (payee) | 90.0000 WCSPR | **90.0087** | received exactly that |
| **Agent CSPR** | **0** | **0** | **paid no gas at all** |
| Facilitator | 2000 CSPR | 1996.21 | absorbed the 3.79 CSPR fee |

> **That third row is the whole thesis.** The agent moved money while holding
> zero native currency. It signed an authorization; the facilitator paid the
> transaction fee. This is what makes pay-per-call viable for software: an
> agent never has to be topped up with a blockchain's native token.

Algorand reaches the same result by a different route, with one honest
difference: there the agent keeps ~0.2 ALGO of locked minimum balance, and pays
no fee out of it.

### Gas: measured, then tuned

From the on-chain execution results (`consumed` vs `cost`):

| Declared budget | Gas consumed | Charged |
|---|---|---|
| 7 CSPR (reference default) | 2.708 CSPR | **7.000** |
| **4 CSPR (ours, after measuring)** | 2.708 CSPR | **4.000** |

Casper debits the **full declared amount** and refunds only 75% of the unused
remainder; the rest is burned. So over-declaring destroys funds. Measuring real
consumption and tightening the budget cut the charge **43%** and moved the
transaction into the cheaper `wasm small` lane (5 CSPR cap, 40 txs per block
instead of 2).

### Verify any of it yourself

```bash
curl -s -X POST https://node.testnet.casper.network/rpc \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"info_get_transaction",
       "params":{"transaction_hash":{"Version1":"907f08f6a4ccd569fb4bde9babf63bb80a273c017772dd3bded39c29d047a925"},
                 "finalized_approvals":true}}' | jq '.result.execution_info'
```

Returns `block_height: 8553980`, `error_message: null`, `consumed: 2707839794`.

Or read current balances straight from the chain:

```bash
cd apps/web && pnpm casper:balance
```

---

Account and asset references for both chains are in
[ADDRESSES.md](./ADDRESSES.md). The default runbook is the
[Algorand runbook](./ALGORAND.md); the alternate one is the
[Casper runbook](./TESTNET.md).
