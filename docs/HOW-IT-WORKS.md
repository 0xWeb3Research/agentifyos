# How AgentifyOS works

A plain-English tour of what happens when an AI agent buys a tool, and where the
facilitator, the wallet, and the money actually sit.

Algorand is the default settlement chain, so that is the flow described first.
Casper is still fully supported behind `CHAIN=casper`; its flow is §8.

---

## 1. The one-sentence version

An agent asks a tool for data → the tool replies **HTTP 402 Payment Required**
with a price in USDC → the agent **signs a USDC transfer** with its own key →
the **GoPlausible facilitator** groups that transfer with its own fee
transaction, simulates the group, and submits it to **Algorand** → the tool runs
and returns the result plus a **receipt** carrying the transaction id. No API
keys, no accounts, no human.

This is the **x402** protocol (HTTP's long-reserved `402` status code, finally
used) running on **Algorand testnet**, with the `exact` scheme in its AVM
profile.

---

## 2. What actually moves

**USDC, ASA `10458941` on Algorand testnet, 6 decimals.** An ASA (Algorand
Standard Asset) is a token defined by the chain itself rather than by a contract
you deploy, so there is no settlement contract of ours in the payment path and
nothing to audit there.

Because USDC is a dollar with six decimals, a listing priced at $0.005 quotes
exactly `5000` atomic units. No price oracle, no conversion, no rounding.
`toAtomic()` in `src/lib/chain.ts` is the whole of the pricing maths.

Two consequences worth stating plainly, because they are what a reader coming
from the Casper path will look for:

- **There is no wrapping step.** On Casper you must first turn CSPR into WCSPR
  through a session transaction before anything can be paid. On Algorand the
  asset you hold is already the asset you spend.
- **Every account that receives USDC must opt into ASA `10458941` first.**
  Algorand will not credit an asset to an account that has not opted in. That
  applies to the buying agent and to every payee. `pnpm algo:optin` does it once
  per account; `pnpm algo:preflight` checks it before you spend anything.

---

## 3. The atomic group, and who pays the fee

`@x402-avm/avm` builds a **two-transaction atomic group**:

| Index | Transaction | Signed by | Fee |
|---|---|---|---|
| 0 | 0-ALGO payment, the facilitator's sponsor to itself | the facilitator | carries the pooled fee for both |
| 1 | USDC asset transfer, buyer → payee | the buyer | 0 |

Both transactions share one Algorand group id, so either both execute or neither
does. The buyer signs index 1 and leaves index 0 unsigned; the facilitator signs
index 0, simulates the group against a node, and only then submits it.

The sponsor address is not ours and not hardcoded in the payment path. It is
read at startup from `GET https://facilitator.goplausible.xyz/supported`, as
`kinds[].extra.feePayer`, and it currently resolves to
`ZMFK2OI7ZBD2U27ISERZC4S6LKM6WMFJPZQ4MYNJDZ2VNBNMBA67RA22AA`. That value is
copied into every 402 as `extra.feePayer`, which is what tells the client to
build a group with a fee payer rather than pay the fee itself.

> **The buying agent spends no ALGO on fees.** It does still need about
> **0.2 ALGO of Algorand's locked minimum balance**: 0.1 base, plus 0.1 more for
> holding one asset. That is a reserve the protocol locks, not a spend. It never
> moves, and it is the only ALGO the agent ever touches.

The facilitator cannot cheat either. It can only submit the group the buyer
signed, for the exact asset, amount, and payee in that signed transaction; the
one transaction it adds is its own fee payment to itself.

---

## 4. The payment flow, step by step

```
AGENT (Algorand key + USDC, opted in)                 TOOL / MARKET             GOPLAUSIBLE FACILITATOR   ALGORAND
│                                                     │                         │                         │
│ 1. GET /api/t/page-scraper?url=...                  │                         │                         │
│─────────────────────────────────────────────────────▶                         │                         │
│                                                     │ initialize(): GET /supported → feePayer           │
│ 2. 402 Payment Required                             │                         │                         │
│    PAYMENT-REQUIRED: base64({ accepts: [{           │                         │                         │
│      scheme:"exact", network:"algorand:SGO1...",    │                         │                         │
│      amount:"5000", asset:"10458941", payTo,        │                         │                         │
│      extra:{ decimals:6, feePayer } }] })           │                         │                         │
◀─────────────────────────────────────────────────────│                         │                         │
│ 3. build the atomic group: index 0 the              │                         │                         │
│    sponsor's fee txn (unsigned), index 1            │                         │                         │
│    our USDC transfer (signed, fee 0)                │                         │                         │
│ 4. GET again + PAYMENT-SIGNATURE: base64()          │                         │                         │
│─────────────────────────────────────────────────────▶                         │                         │
│                                                     │ 5. POST /verify ────────▶ group id, amount, asset │
│                                                     │                         │ payee, opt-in, balance  │
│                                                     │ 6. POST /settle ────────▶ signs index 0,          │
│                                                     │                         │ simulates, submits ─────▶ the group
│                                                     │                         ◀───────── transaction id │ executes, or
│ 7. 200 OK { result, receipt{ txHash } }             │                         │                         │ nothing does
│    + PAYMENT-RESPONSE: base64(settle)               │                         │                         │
◀─────────────────────────────────────────────────────│                         │                         │
│ receipt.txHash → Lora: /testnet/transaction/<txid>  │                         │                         │
```

Verification happens inside the facilitator, so unlike the Casper path there is
no separate verify step of ours to show. The wire-log panel on `/agent` renders
exactly these steps live: request, 402, sign, settle, result, receipt.

---

## 5. The wire, exactly

x402 v2 carries the protocol in headers. Our 402 also repeats the challenge in
the JSON body so `curl` and these docs stay readable, but **the header is
authoritative** and an SDK client never reads the body.

**The challenge**, `PAYMENT-REQUIRED` on the 402 response, base64 JSON:

```json
{
  "x402Version": 2,
  "error": "payment_required",
  "resource": { "url": "…/api/t/algo-market-data", "mimeType": "application/json" },
  "accepts": [{
    "scheme": "exact",
    "network": "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=",
    "amount": "2000",
    "asset": "10458941",
    "payTo": "<treasury address>",
    "maxTimeoutSeconds": 120,
    "extra": { "decimals": 6, "feePayer": "ZMFK2OI7ZBD…" }
  }],
  "extensions": { "bazaar": { "…": "how to call this tool" } }
}
```

**The payment**, `PAYMENT-SIGNATURE` on the retried request, base64 JSON:

```json
{
  "x402Version": 2,
  "accepted": { "scheme": "exact", "network": "algorand:SGO1…", "amount": "2000", "…": "…" },
  "payload": {
    "paymentGroup": ["<base64 msgpack txn 0>", "<base64 msgpack txn 1>"],
    "paymentIndex": 1
  }
}
```

`paymentGroup` is the encoded atomic group and `paymentIndex` says which member
is the buyer's transfer. Those bytes *are* the payment: anyone holding them could
settle it, which is why the wire log reports the group's shape and never its
contents.

**The settlement**, `PAYMENT-RESPONSE` on the 200, base64 JSON:

```json
{
  "success": true,
  "transaction": "<algorand transaction id>",
  "network": "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=",
  "payer": "<buyer address>"
}
```

**The receipt**, in the 200's JSON body next to the tool's result, is ours
rather than the protocol's:

```json
{
  "settlementId": "stl_…",
  "tool": "algo-market-data",
  "costUsd": 0.002,
  "payer": "<buyer address>",
  "txHash": "<algorand transaction id>",
  "resultHash": "<sha256 of the delivered result>",
  "network": "algorand:SGO1…",
  "mode": "real",
  "explorerUrl": "https://lora.algokit.io/testnet/transaction/<txid>",
  "facilitatorReceiptUrl": "https://facilitator.goplausible.xyz/api/receipt/<txid>",
  "createdAt": "…"
}
```

`txHash` is the one field name that changed with this chain: it was `deployHash`
when Casper was the only path. It now carries an Algorand transaction id or a
Casper deploy hash depending on `CHAIN`. `facilitatorReceiptUrl` is new, and is
null on Casper, where we are the facilitator and so have no independent record to
point at.

A **mock** settlement (`MODE=mock`) carries a deterministic pseudo-hash and a
**null** `explorerUrl`, deliberately: a fabricated hash must never be presented
as a verifiable on-chain link.

---

## 6. Wallets and identity: what you actually need

There are two very different "wallets" here; don't conflate them:

| Who | Holds | Needs a browser wallet? | Used for |
|---|---|---|---|
| **The agent** (the buyer) | an Algorand keypair, as a 25-word mnemonic in the environment | **No** | signing the USDC transfer; its address **is** its identity |
| **The treasury** | the same, plus the USDC everyone is paid into | No | receiving payments, stocking the agent |
| **You, the human** | a browser, for two faucets | Yes, briefly | claiming testnet ALGO and USDC once |

So: **agents never use a browser wallet.** That is the whole point of x402. You
need a browser twice, once at
[lora.algokit.io/testnet/fund](https://lora.algokit.io/testnet/fund) for ALGO and
once at [faucet.circle.com](https://faucet.circle.com) (pick Algorand →
TestNet) for USDC. Everything after that is headless keypairs. Full setup is in
the [Algorand runbook](./ALGORAND.md).

**There is no facilitator role of ours on Algorand.** GoPlausible runs that half,
so `pnpm algo:keygen` generates two accounts, not three. Secrets are 25-word
mnemonics in `apps/web/.env`, never files on disk: a hosted deploy has no
filesystem to ship a key file to.

---

## 7. The facilitator, and the mock/real seam

The **facilitator** verifies a payment and puts it on-chain. On Algorand we use
[GoPlausible](https://facilitator.goplausible.xyz): hosted, no API key, no
signup, and no quota to manage.

| Route | What it does |
|---|---|
| `POST /verify` | checks the group before anything is submitted |
| `POST /settle` | signs the fee transaction, simulates, submits, returns the transaction id |
| `GET /supported` | which networks and schemes it serves, and the `extra.feePayer` address |
| `GET /health` | liveness |
| `GET /discovery/resources` | the public Bazaar: every resource that has been paid for at least once |
| `GET /api/receipt/{txid}` | its own record of a settled payment, independent of our ledger |

`getResourceServer()` in `src/lib/x402/algorand.ts` memoizes one initialized
`x402ResourceServer`. `initialize()` is not optional: it is the call that fetches
`/supported`, and requirements built before it completes would omit
`extra.feePayer`. The client would then build a group with no fee payer, and a
buyer holding no spendable ALGO would fail for a reason that looks like anything
but the real one. A failed init is discarded rather than cached, so the next
request retries instead of pinning a dead server.

When the facilitator is unreachable we answer **503 `facilitator_unavailable`**,
not a payment error. The difference matters to a retrying agent: it means "come
back", not "your payment was wrong".

There is also an offline harness (`pnpm selftest`, `pnpm algo:preflight`) that
proves the invariants without spending anything. Those are *test* tools; the
product path is real settlement, not simulation.

---

## 8. The alternate chain: Casper

Selected with `CHAIN=casper`, unchanged by the Algorand port, and documented in
full in the [Casper runbook](./TESTNET.md).

The 402 handshake is identical. What differs is how a payment is signed and
broadcast:

| | Algorand (default) | Casper (`CHAIN=casper`) |
|---|---|---|
| Asset | USDC, ASA `10458941`, 6 decimals | WCSPR, a CEP-18 token, 9 decimals |
| Price maths | exact: $0.005 is 5000 units | via an illustrative CSPR price |
| What the buyer signs | an ASA transfer inside an atomic group | an EIP-712 `TransferAuthorization` |
| How it settles | facilitator signs the fee leg, simulates, submits | facilitator submits `transfer_with_authorization` |
| Who pays the fee | GoPlausible's sponsor account | our own funded facilitator key |
| Prerequisite | both sides opted into the ASA | CSPR wrapped into WCSPR first |
| Explorer | [Lora](https://lora.algokit.io/testnet) | [cspr.live](https://testnet.cspr.live) |
| Keys | 25-word mnemonics in env | `.pem` files in `apps/web/keys/` |
| Roles | treasury, agent | facilitator, treasury, agent |

On Casper the settlement smart contract is a **CEP-18 token** extended with a
**`transfer_with_authorization`** entry point, Casper's analog of Ethereum's
EIP-3009 gasless transfer. The agent signs an authorization off-chain (_"move N
WCSPR from me to this address, valid for 60s, nonce X"_); our facilitator submits
it and pays the gas; the contract verifies the signature on-chain and moves the
tokens. Same outcome as the atomic group, reached a different way: the payer
signs like a message, not a transaction.

> **We also wrote and deployed our own Casper contract:** the `ToolRegistry` at
> package `9c1b0ac3…720a18`, which anchors each tool's manifest hash on-chain and
> makes listings tamper-evident. Source in `contracts/tool-registry/`, addresses
> in [ADDRESSES.md](./ADDRESSES.md). It is not in the payment path on either
> chain.

---

## 9. Reputation: "the payment is the review"

There are no star ratings to game. Every listing's reputation (total calls,
distinct paying wallets, success rate, revenue) is **derived from settled
payments**. A tool flips to **verified** only after its first real settlement
clears. The payment record *is* the usage record, so the market's trust signal is
unforgeable ledger data, not prose reviews.

Discovery works the same way. Registering `bazaarResourceServerExtension`
attaches a machine-readable call signature to every 402; the buyer echoes it back
with the payment, and the facilitator catalogs the resource when the payment
settles. Publishing to the public Bazaar is a side effect of being paid, so
there is nothing to register and nothing to keep in sync.

---

## 10. Component map

```
apps/web
  src/app
    api/t/[slug]        the paid endpoint: returns 402, then verifies + settles
    api/agent/run       drives an agent through discover → pay → complete
    api/discovery/*     machine-readable catalog + search (for agents)
    api/settlements     our own ledger of settled payments
    api/mcp             MCP surface: search_tools / get_tool / call_tool
    llms.txt            agent-discovery manifest
    (pages)             landing, /tools, /tools/[slug], /agent, /publish, /dashboard, /docs
  src/lib
    chain.ts                 which chain is active, and everything derived from it:
                             CAIP-2 id, asset, explorer links, atomic-unit maths
    config.ts                role accounts, resolvePayTo(), real-mode readiness
    discovery.ts             one machine-readable record per paid resource
    x402/algorand.ts         resource server, facilitator client, accounts,
                             balances, ASA opt-in, USDC and ALGO transfers
    x402/algorand-route.ts   the seller half: quote, verify, settle, deliver
    x402/algorand-client.ts  the buyer half: 402, sign the group, retry, receipt
    x402/algorand-loop.ts    the agent runner, paying over real HTTP
    x402/settlement.ts       the ledger row and receipt both chains produce
    x402/casper*.ts          the same three roles on Casper
  scripts
    algorand/*    keygen · balance · optin · fund · pay · preflight
    casper/*      keygen · balance · wrap · transfer · pay · sign-test · fund
```

`algorand-loop.ts` pays over the wire to our own `/api/t/[slug]` rather than
running the handshake in-process. That is deliberate: the agent demo then
exercises the same public endpoint an outside buyer would, with no privileged
shortcut, and the settlement is recorded once, by the seller, rather than by both
halves of a loop talking to itself.

---

See the **[Algorand runbook](./ALGORAND.md)** for the exact steps from zero to a
real settlement you can open on Lora, and **[PROOF.md](./PROOF.md)** for the
three independent ways to verify one.
