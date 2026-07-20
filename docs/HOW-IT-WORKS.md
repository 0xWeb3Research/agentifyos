# How AgentifyOS works

A plain-English tour of what happens when an AI agent buys a tool, and where the
smart contract, the wallet, and the money actually sit.

---

## 1. The one-sentence version

An agent asks a tool for data → the tool replies **HTTP 402 Payment Required** →
the agent **signs a payment** with its own key → a **facilitator settles it on
Casper** by calling a token smart contract → the tool runs and returns the result
plus an on-chain **receipt**. No API keys, no accounts, no human.

This is the **x402** protocol (HTTP's long-reserved `402` status code, finally
used) running on **Casper**.

---

## 2. Is there a smart contract? Yes.

**The settlement smart contract is a CEP-18 token** (Casper's fungible-token
standard, the equivalent of ERC-20) that has been extended with a
**`transfer_with_authorization`** entry point — Casper's analog of Ethereum's
EIP-3009 "gasless transfer". That entry point is the whole trick:

- The **agent signs** an authorization off-chain: _"move N WCSPR from me to the
  tool's payout address, valid for the next 60s, nonce = X."_ It signs with its
  own Ed25519 key. **It never touches gas and never needs a browser wallet.**
- The **facilitator submits** that signed authorization to the token contract's
  `transfer_with_authorization` entry point in a real Casper deploy, and **pays
  the gas** itself. The contract verifies the signature on-chain and moves the
  tokens.

So the money movement is a genuine on-chain contract call, but the *payer* signs
like a message, not a transaction. That's what makes machine-to-machine
micropayments practical.

### Which contract, exactly?

The token is **"Wrapped CSPR" (WCSPR)** — an x402-enabled CEP-18. Two options,
both documented in [TESTNET.md](./TESTNET.md):

| Option | What it is | Why |
|---|---|---|
| **Use the existing testnet WCSPR** | Casper's reference x402 token, already deployed at package `3d80df21…4847c1e` | fastest — nothing to deploy |
| **Deploy our own CEP-18** | `agentifyos` runs the reference `Cep18X402.wasm` under our own account | gives us a **contract package hash to show judges** (hackathon criterion: "working deployed contracts on Casper testnet") |

> **We also wrote and deployed our own contract:** the `ToolRegistry` at package
> `9c1b0ac3…720a18`, which anchors each tool's manifest hash on-chain and makes
> listings tamper-evident. Source in `contracts/tool-registry/`, addresses in
> [ADDRESSES.md](./ADDRESSES.md) §2b. Wiring it into the publish flow is next,
> not required for payments.

### What's live right now?

The **real Casper integration is built and verified**: real Ed25519 keys, real
EIP-712 payment signing, on-chain settlement via `transfer_with_authorization`,
CSPR→WCSPR wrapping through Odra's proxy-caller session wasm, and live balance
reads — all checked against the public testnet node. The contract's
`transfer_with_authorization` entry point was confirmed on-chain (arg names and
types match our implementation exactly) and shows live `AuthorizationUsed`
events, so this exact flow works on testnet today.

The only thing between this and a settlement you can click is **funding**: the
faucet requires a Casper Wallet sign-in, so the facilitator and treasury accounts
need CSPR before the first payment clears. See [TESTNET.md](./TESTNET.md).

There's also an offline harness (`pnpm selftest`, `pnpm casper:signtest`) that
proves the cryptography without spending anything. That's a *test* tool — the
product path is real on-chain settlement, not simulation.

---

## 3. The payment flow, step by step

```
 AGENT (holds an Ed25519 keypair + WCSPR balance)          TOOL / MARKETPLACE            FACILITATOR                 CASPER TESTNET
   │                                                              │                          │                            │
   │ 1. GET /api/t/page-scraper?url=…                             │                          │                            │
   │─────────────────────────────────────────────────────────────▶                          │                            │
   │ 2. 402 Payment Required                                      │                          │                            │
   │    { scheme:"exact", network:"casper:casper-test",           │                          │                            │
   │      amount, asset:WCSPR, payTo }                            │                          │                            │
   │◀─────────────────────────────────────────────────────────────                          │                            │
   │ 3. sign authorization (EIP-712 typed data over               │                          │                            │
   │    TransferAuthorization) with the agent's key               │                          │                            │
   │ 4. GET again + header  PAYMENT-SIGNATURE: base64(payload)    │                          │                            │
   │─────────────────────────────────────────────────────────────▶ 5. POST /verify ─────────▶ (checks sig, amount,      │
   │                                                              │                          │   balance, time window)    │
   │                                                              │ 6. POST /settle ─────────▶ submit deploy: token       │
   │                                                              │                          │  .transfer_with_authorization ▶ (contract verifies
   │                                                              │                          │   (facilitator pays gas)   │   sig, moves WCSPR)
   │                                                              │                          │◀── deploy hash + finality ─│
   │ 7. 200 OK  { result, receipt{ deployHash, resultHash } }     │                          │                            │
   │◀─────────────────────────────────────────────────────────────                          │                            │
   │    receipt.deployHash → testnet.cspr.live/deploy/<hash>      │                          │                            │
```

The exact wire format (the `402` body, the `PAYMENT-SIGNATURE` payload, `/verify`
and `/settle` responses) is what the **wire-log panel** on the `/agent` page
renders live — the protocol is the hero visual.

---

## 4. Wallets & identity — what you actually need

There are **two very different "wallets"** here; don't conflate them:

| Who | Holds | Needs a browser wallet? | Used for |
|---|---|---|---|
| **The agent** (the buyer) | an **Ed25519 keypair** (a `.pem` file on disk / env) | **No** | signing payment authorizations; its public key **is** its identity |
| **The facilitator** | a funded Ed25519 keypair (`.pem`) | No | submitting settle deploys and paying gas |
| **You, the human** | **Casper Wallet** browser extension | Yes | using the testnet **faucet** to get free CSPR, then funding the keys above |

So: **agents never use a browser wallet** — that's the whole point of x402. You
only need **Casper Wallet** once, to pull testnet CSPR from the faucet. Everything
after that is headless keypairs. Full setup is in [TESTNET.md](./TESTNET.md).

Casper keypairs use the **same Ed25519 curve** the app already signs with, via
`casper-js-sdk` (`PrivateKey.generate(KeyAlgorithm.ED25519)` → `.toPem()`), and
signatures are verified with `PublicKey.verifySignature(...)`.

---

## 5. The facilitator (and the mock/real seam)

The **facilitator** is the party that verifies a payment and submits it on-chain.
It's the only component that needs funds, because **it pays the gas** — which is
precisely why the paying agent doesn't need any CSPR at all.

We **self-host** it (`src/lib/x402/casper.ts` + our facilitator key + the public
testnet RPC). Casper also runs a hosted one at `x402-facilitator.cspr.cloud`, but
its free testnet quota is **25 calls/day** (~12 payments), so self-hosting is both
cheaper and unmetered.

Verification is real: the facilitator recomputes the EIP-712 digest, checks the
signature against the payer's public key, confirms the payee, amount, and validity
window, and confirms the public key derives to the payer's account hash — then
submits `transfer_with_authorization` and waits for finality. The contract
re-verifies the signature on-chain before moving any tokens, so the facilitator
is never trusted with funds; it can only relay a payment the agent already signed.

---

## 6. Reputation — "the payment is the review"

There are no star ratings to game. Every listing's reputation — total calls,
distinct paying wallets, success rate, revenue — is **derived from settled
payments**. A tool flips to **verified** only after its first real settlement
clears the facilitator. The payment record *is* the usage record, so the market's
trust signal is unforgeable ledger data, not prose reviews.

---

## 7. Component map

```
apps/web
  src/app
    api/t/[slug]        the paid endpoint — returns 402, then verifies+settles
    api/agent/run       drives an agent through discover → pay → complete
    api/discovery/*     machine-readable catalog + search (for agents)
    api/mcp             MCP server: search_tools / get_tool / call_tool
    llms.txt            agent-discovery manifest
    (pages)             landing, /tools, /tools/[slug], /agent, /publish, /dashboard, /roadmap
  src/lib/x402
    casper.ts           REAL Casper engine — EIP-712 signing, verification,
                        on-chain transfer_with_authorization settlement,
                        CSPR→WCSPR wrapping, CEP-18 transfer, balance reads
    payment.ts          x402 wire types + Ed25519 signing primitives
    facilitator.ts      verify/settle seam used by the paid routes
    loop.ts             the full paid-call engine + a task planner
  scripts/casper
    keygen · balance · wrap · transfer · pay-real · sign-test   (see TESTNET.md)
    wasm/proxy_caller_with_return.wasm   (Odra payable-call shim)
```

---

See **[TESTNET.md](./TESTNET.md)** for the exact steps to go from zero to a real
on-chain settlement you can open on testnet.cspr.live.
