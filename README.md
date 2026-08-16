<div align="center">

<img src="brand/logo.png" alt="AgentifyOS" width="104" height="104" />

# AgentifyOS

**The marketplace where AI agents shop for tools.**

Publish a paid tool in 60 seconds. Autonomous agents discover it and pay per call
with **x402 on Algorand**: no API keys, no accounts, no human in the loop.

[![live](https://img.shields.io/badge/demo-live-008b37?style=flat-square)](https://agentifyos.xyz)
[![network](https://img.shields.io/badge/algorand-testnet-000000?style=flat-square)](https://lora.algokit.io/testnet)
[![x402](https://img.shields.io/badge/x402-exact%20scheme-2469ff?style=flat-square)](https://www.x402.org)
[![asset](https://img.shields.io/badge/settled%20in-USDC-2775ca?style=flat-square)](https://lora.algokit.io/testnet/asset/10458941)
[![facilitator](https://img.shields.io/badge/facilitator-GoPlausible-6f42c1?style=flat-square)](https://facilitator.goplausible.xyz)

[Live demo](https://agentifyos.xyz/agent) ·
[Explainer](https://agentifyos.xyz/explain) ·
[Algorand runbook](docs/ALGORAND.md) ·
[Proof](docs/PROOF.md)

</div>

***

## Why

An AI agent can reason, but it cannot buy. Every API it wants sits behind a
signup form, a credit card, and a dashboard, all built for humans. So agents
stay on a leash: a human provisions keys up front and hopes they cover whatever
the agent needs later.

| Getting an agent data today | With AgentifyOS |
|---|---|
| Human signs up, gets an API key | Agent pays per call, no account |
| Key provisioned before the task | Discovery and payment at runtime |
| Monthly plan for occasional use | $0.002 for the one call it made |
| Trust the vendor's star rating | Reputation derived from settled payments |
| Agent needs a funded card | Agent holds USDC and pays no network fees |

The plumbing got standardised before the shops opened. x402 defines how a
machine pays over HTTP; almost nothing sells anything through it. This is the
supply side.

***

## Live on Algorand testnet

Nothing here is simulated. Every payment is a real USDC asset transfer, settled
by the [GoPlausible facilitator](https://facilitator.goplausible.xyz) and
verifiable on [Lora](https://lora.algokit.io/testnet).

| Piece | Value |
|---|---|
| Network | `algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=` |
| Asset | USDC, [ASA 10458941](https://lora.algokit.io/testnet/asset/10458941), 6 decimals |
| Scheme | `exact`, AVM profile: signed ASA transfer in an atomic group |
| Facilitator | `https://facilitator.goplausible.xyz`, hosted, no key or signup |
| Fee | sponsored by the facilitator, not paid by the buyer |

**The buying agent spends no ALGO.** It signs a USDC transfer; the facilitator
groups it with its own fee transaction, simulates, and submits. The agent's only
ALGO is Algorand's locked minimum balance, which never moves.

See [docs/PROOF.md](docs/PROOF.md) for settled transactions and how to check
each one yourself.

***

## Quick start

```bash
pnpm install
pnpm dev                     # http://localhost:8402
```

Payments are real by default, which needs two funded testnet accounts. The
ten-minute setup is [docs/ALGORAND.md](docs/ALGORAND.md):

```bash
cd apps/web
pnpm algo:keygen                              # treasury + agent, paste into .env
#  → fund both with testnet ALGO   https://lora.algokit.io/testnet/fund
pnpm algo:optin                               # both accounts opt into ASA 10458941
#  → then fund treasury with USDC  https://faucet.circle.com  (Algorand → TestNet)
#    opt-in first: Algorand cannot credit an asset to an account that skipped it
pnpm algo:preflight                           # check every prerequisite at once
pnpm algo:demo                                # tops up the agent, pays, prints the proof
```

Prove the cryptography without spending anything:

```bash
pnpm selftest                # payment-loop invariants, incl. the replay guard
pnpm algo:preflight          # SDK constants, facilitator, accounts, opt-ins
pnpm test:e2e                # Playwright suite
```

***

## What's here

| Surface | For | Entry point |
|---|---|---|
| Marketplace | humans | `/` · `/tools` · `/publish` · `/dashboard` |
| Agent demo | everyone | `/agent`: discovers, pays, completes a task, live |
| CLI | terminal | `pnpm agentify call <slug>` |
| MCP server | Claude / Cursor | `pnpm mcp`: lets an assistant buy tools itself |
| Paid endpoint | agents | `/api/t/[slug]`: real HTTP 402 → pay → result |
| Discovery | agents | `/api/discovery/*` · `/api/mcp` · `/llms.txt` |

The CLI, the MCP server, and even the on-site agent demo are **ordinary x402
clients**: their own keys, paying over the same public endpoint as anyone else,
over real HTTP. There is no privileged path.

***

## The loop

1. Agent calls a tool → **HTTP 402** with `PaymentRequirements` in the
   `PAYMENT-REQUIRED` header (scheme `exact`, network `algorand:SGO1…`, asset
   USDC), plus a Bazaar declaration describing how to call the tool.
2. Agent builds a **two-transaction atomic group**: the facilitator's fee
   transaction, unsigned, and its own USDC transfer, signed. It retries with
   `PAYMENT-SIGNATURE`. This costs nothing and touches no chain.
3. The facilitator verifies the group, signs the fee leg, **simulates it against
   a node**, and submits. It pays the fee.
4. Payment clears, the tool runs, the agent gets the result plus a receipt with
   the transaction id, a Lora link, and the facilitator's own receipt URL.
5. The settlement updates that listing's reputation. The payment is the review.
   It also lists the resource in the facilitator's public
   [Bazaar](https://facilitator.goplausible.xyz/discovery/resources), as a side
   effect of being paid.

***

## Documentation

| Doc | What it covers |
|---|---|
| [START-HERE](docs/START-HERE.md) | the whole idea, assuming zero knowledge |
| [HOW-IT-WORKS](docs/HOW-IT-WORKS.md) | architecture and the payment flow in detail |
| [ALGORAND](docs/ALGORAND.md) | accounts, faucets, opt-in, first real settlement |
| [CLI-AND-MCP](docs/CLI-AND-MCP.md) | terminal usage and wiring into Claude or Cursor |
| [ADDRESSES](docs/ADDRESSES.md) | accounts, asset ids, endpoints, budgets |
| [PROOF](docs/PROOF.md) | on-chain evidence and how to verify it yourself |
| [TESTNET](docs/TESTNET.md) | the alternate Casper path, behind `CHAIN=casper` |

All of them also render in the app at `/docs`, and as plain text at `/llms.txt`.

***

## Project structure

```
apps/web
  src/app
    api/t/[slug]       the real HTTP 402 paid endpoint
    api/agent/run      the agent runner (discover → pay → complete)
    api/discovery/*    machine-readable catalog + search
    api/mcp            HTTP MCP surface
    docs/              the markdown in docs/, rendered
  src/lib
    chain.ts           which chain settles, and everything derived from it
    discovery.ts       one machine-readable record per paid resource
    x402/algorand.ts         resource server, facilitator client, accounts
    x402/algorand-route.ts   the seller half: quote, verify, settle, deliver
    x402/algorand-client.ts  the buyer half: 402, sign, retry, receipt
    x402/algorand-loop.ts    the agent runner, paying over real HTTP
    x402/settlement.ts       the ledger row and receipt both chains produce
    x402/casper*.ts          the same three roles on Casper
  scripts
    cli.ts             pnpm agentify
    mcp-server.ts      pnpm mcp
    algorand/*         keygen · balance · optin · fund · pay · preflight
    casper/*           keygen · balance · wrap · transfer · pay · sign-test
contracts/tool-registry  our Casper smart contract (Rust)
docs/                  the documents above
```

***

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 · React 19 · TypeScript |
| Styling | Tailwind v4 · Geist · React Flow |
| State | Zustand |
| Payments | `@x402-avm/core` · `@x402-avm/avm` · `@x402-avm/fetch` · `@x402-avm/extensions` |
| Chain access | `algosdk` for accounts, balances, ASA opt-in and funding |
| Settlement | USDC (ASA 10458941) on Algorand testnet, `exact` scheme, atomic group |
| Facilitator | GoPlausible, hosted: verify, settle, fee sponsorship, Bazaar listing |
| Alternate chain | WCSPR CEP-18 on Casper testnet, `transfer_with_authorization` |
| Storage | Redis: the settlement ledger. The catalog is in-code fixtures |
| Testing | Playwright · custom self-test, preflight, and SEO audit scripts |

***

## Switching chains

There is a chain picker in the nav. Choosing one writes a cookie, and the server
resolves it per request, so the switch changes **everything at once**: the price
each listing quotes and the units it quotes in, the CAIP-2 network in every 402,
the asset, the payee, which signer moves the money, where receipts resolve, the
address book, the discovery feed, and the diagrams.

```bash
curl -s localhost:8402/api/t/algo-market-data | jq -c '.accepts[0] | {network, amount, asset}'
# {"network":"algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=","amount":"2000","asset":"10458941"}

curl -s -H 'Cookie: agentifyos-chain=casper' localhost:8402/api/t/algo-market-data | jq -c '.accepts[0] | {network, amount, asset}'
# {"network":"casper:casper-test","amount":"86580087","asset":"3d80df21ba4e…"}
```

`CHAIN=algorand` (the default) or `CHAIN=casper` sets what a visitor sees before
they choose. The picker marks a chain this deployment holds no keys for, and the
paid endpoint answers 503 with the reason rather than pretending to charge.

The 402 handshake is identical either way; the two paths differ only in how a
payment is signed and broadcast.

***

<div align="center">

_The rails were standardised. We built the market._

</div>
