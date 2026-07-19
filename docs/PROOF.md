# On-chain proof — real settlements on Casper testnet

Every hash below is a **real transaction on Casper testnet**, executed
2026-07-19. Click any of them; they resolve on the public explorer. Nothing here
is simulated.

Network: `casper-test` · protocol 2.2.2 · explorer [testnet.cspr.live](https://testnet.cspr.live)

---

## The headline

**An autonomous agent paid for four tools in one task, holding zero CSPR.**

| # | Tool | Price | Deploy |
|---|---|---|---|
| 1 | `cspr-market-data` | $0.002 | [`907f08f6…a925`](https://testnet.cspr.live/deploy/907f08f6a4ccd569fb4bde9babf63bb80a273c017772dd3bded39c29d047a925) |
| 2 | `page-scraper` | $0.005 | [`86d61db6…7b85`](https://testnet.cspr.live/deploy/86d61db62442d867adde20254cedab64525b65d578139fbe171ade11ee257b85) |
| 3 | `text-summarizer` | $0.010 | [`0db4cbf1…1420`](https://testnet.cspr.live/deploy/0db4cbf14be6d6e2d30dc1035447ec466de3026e2c0f0eeb2ee642dbc55a1420) |
| 4 | `rwa-attestor` | $0.020 | [`3d438f24…acf2`](https://testnet.cspr.live/deploy/3d438f2451054c4bb482ff363a4612b0e1974c7777440638ae9d5d45b2c0acf2) |

Total paid **$0.037**, budget metered down from $0.100, four independent
`transfer_with_authorization` settlements.

## Setting up the economy

| Step | What happened | Deploy |
|---|---|---|
| **Wrap** | 100 CSPR → 100 WCSPR via Odra's proxy-caller **session** transaction (the payable `deposit` path a plain contract call cannot do) | [`4f837c6b…b897`](https://testnet.cspr.live/deploy/4f837c6bccf50174f0864b38b8bce42ebcc2ffa1553ea727bbf63c87175cb897) |
| **Fund agent** | 10 WCSPR treasury → agent (CEP-18 `transfer`) | [`d1e5f909…0966`](https://testnet.cspr.live/deploy/d1e5f9096ebedf979c983434f955320a48601ba21f0138b5b08d6b912b5c0966) |
| **First settlement** | The first real x402 payment | [`192a0328…7c79`](https://testnet.cspr.live/deploy/192a032853f7dd6d24974fe3cbb0a6468030c946f50ab573abade25b8ea47c79) |
| **From the web UI** | A settlement triggered by the `/agent` page in a browser | [`7bdd152d…f831`](https://testnet.cspr.live/deploy/7bdd152d37075053471edfa6ccdc03c35b41400d718a28bc68b820760639f831) |
| **Tuned gas** | Same settlement at a 4 CSPR budget instead of 7 | [`85f7fdb8…90fb`](https://testnet.cspr.live/deploy/85f7fdb83954c20f61775cbd7c455e8519f1e9431fcdb28b52ef58c7ec2790fb) |

---

## What the balances prove

Measured before and after the first settlement:

| Account | Before | After | Meaning |
|---|---|---|---|
| Agent (buyer) | 10.0000 WCSPR | **9.9913** | paid 0.0087 WCSPR |
| Treasury (payee) | 90.0000 WCSPR | **90.0087** | received exactly that |
| **Agent CSPR** | **0** | **0** | **paid no gas at all** |
| Facilitator | 2000 CSPR | 1996.21 | absorbed the 3.79 CSPR fee |

> **That third row is the whole thesis.** The agent moved money while holding
> zero native currency. It signed an authorization; the facilitator paid the
> transaction fee. This is what makes pay-per-call viable for software — an
> agent never has to be topped up with a blockchain's native token.

---

## Gas: measured, then tuned

From the on-chain execution results (`consumed` vs `cost`):

| Declared budget | Gas consumed | Charged |
|---|---|---|
| 7 CSPR (reference default) | 2.708 CSPR | **7.000** |
| **4 CSPR (ours, after measuring)** | 2.708 CSPR | **4.000** |

Casper debits the **full declared amount** and refunds only 75% of the unused
remainder — the rest is burned. So over-declaring destroys funds. Measuring real
consumption and tightening the budget cut the charge **43%** and moved the
transaction into the cheaper `wasm small` lane (5 CSPR cap, 40 txs per block
instead of 2).

---

## Verify any of it yourself

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

Account addresses are in [ADDRESSES.md](./ADDRESSES.md); the full runbook is in
[TESTNET.md](./TESTNET.md).
