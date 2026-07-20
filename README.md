<div align="center">

<img src="brand/logo.png" alt="AgentifyOS" width="104" height="104" />

# AgentifyOS

**The marketplace where AI agents shop for tools.**

Publish a paid tool in 60 seconds. Autonomous agents discover it and pay per call
with **x402 on Casper** — no API keys, no accounts, no human in the loop.

[![live](https://img.shields.io/badge/demo-live-008b37?style=flat-square)](https://agentifyos.xyz)
[![network](https://img.shields.io/badge/casper-testnet-f82636?style=flat-square)](https://testnet.cspr.live)
[![x402](https://img.shields.io/badge/x402-exact%20scheme-2469ff?style=flat-square)](https://www.x402.org)
[![asset](https://img.shields.io/badge/settled%20in-WCSPR-666?style=flat-square)](https://testnet.cspr.live/contract-package/3d80df21ba4ee4d66a2a1f60c32570dd5685e4b279f6538162a5fd1314847c1e)

[Live demo](https://agentifyos.xyz/agent) ·
[Explainer](https://agentifyos.xyz/explain) ·
[Docs](docs/START-HERE.md) ·
[Proof](docs/PROOF.md)

</div>

***

## Why

An AI agent can reason, but it cannot buy. Every API it wants sits behind a
signup form, a credit card, and a dashboard — all built for humans. So agents
stay on a leash: a human provisions keys up front and hopes they cover whatever
the agent needs later.

| Getting an agent data today | With AgentifyOS |
|---|---|
| Human signs up, gets an API key | Agent pays per call, no account |
| Key provisioned before the task | Discovery and payment at runtime |
| Monthly plan for occasional use | $0.002 for the one call it made |
| Trust the vendor's star rating | Reputation derived from settled payments |
| Agent needs a funded card | Agent holds **zero CSPR** and still pays |

The plumbing got standardised before the shops opened. x402 defines how a
machine pays over HTTP; almost nothing sells anything through it. This is the
supply side.

***

## Live on Casper testnet

Nothing here is simulated. Every payment is a real `transfer_with_authorization`
on the WCSPR CEP-18 contract, verifiable on the block explorer.

| Settlement | Path | Transaction |
|---|---|---|
| Production, live domain | agentifyos.xyz → Casper | [`bb82313c`](https://testnet.cspr.live/deploy/bb82313c7ae96461bd8f8e32af7a687e51c34c90ef37966bf475f84ab4cb99fd) |
| Full HTTP 402 loop | CLI → `/api/t/[slug]` → Casper | [`69d1a8be`](https://testnet.cspr.live/deploy/69d1a8be0b8fc3933dcff1a2ee3df75590db693454aff91351bc22dd2999116d) |
| Agent, four tools, one task | `/agent` → Casper | [`907f08f6`](https://testnet.cspr.live/deploy/907f08f6a4ccd569fb4bde9babf63bb80a273c017772dd3bded39c29d047a925) · [`86d61db6`](https://testnet.cspr.live/deploy/86d61db62442d867adde20254cedab64525b65d578139fbe171ade11ee257b85) · [`0db4cbf1`](https://testnet.cspr.live/deploy/0db4cbf14be6d6e2d30dc1035447ec466de3026e2c0f0eeb2ee642dbc55a1420) |

**The agent held 0 CSPR throughout.** It signs an authorization off-chain; the
facilitator submits it and absorbs the gas. That is the whole trick — see
[docs/PROOF.md](docs/PROOF.md) for balances and gas accounting.

***

## Quick start

```bash
pnpm install
pnpm dev                     # http://localhost:8402
```

Payments are real by default, which needs two funded testnet keys. The
ten-minute setup is [docs/TESTNET.md](docs/TESTNET.md):

```bash
cd apps/web
pnpm casper:keygen                            # facilitator / treasury / agent
#  → fund facilitator + treasury from the testnet faucet
pnpm casper:wrap --cspr 100                   # CSPR → WCSPR
pnpm casper:transfer --to agent --amount 10000000000
pnpm agentify call cspr-market-data           # a real paid call
```

Prove the cryptography without spending anything:

```bash
pnpm selftest                # payment-loop invariants, incl. the replay guard
pnpm casper:signtest         # real EIP-712 sign/verify, offline
pnpm test:e2e                # Playwright suite, incl. a live settlement
```

***

## What's here

| Surface | For | Entry point |
|---|---|---|
| Marketplace | humans | `/` · `/tools` · `/publish` · `/dashboard` |
| Agent demo | everyone | `/agent` — discovers, pays, completes a task, live |
| CLI | terminal | `pnpm agentify call <slug>` |
| MCP server | Claude / Cursor | `pnpm mcp` — lets an assistant buy tools itself |
| Paid endpoint | agents | `/api/t/[slug]` — real HTTP 402 → pay → result |
| Discovery | agents | `/api/discovery/*` · `/api/mcp` · `/llms.txt` |

The CLI and MCP server are **ordinary x402 clients** — their own keys, paying
over the same public endpoint as anyone else. There is no privileged path.

***

## The loop

1. Agent calls a tool → **HTTP 402** with `PaymentRequirements` (scheme `exact`, network `casper:casper-test`, asset WCSPR).
2. Agent signs an **EIP-712** authorization with its Ed25519 key and retries with `PAYMENT-SIGNATURE`. This costs nothing and touches no chain.
3. The facilitator verifies signature, amount, time window, and payee, then settles on Casper — **paying the gas itself**.
4. Payment clears, the tool runs, the agent gets the result plus a receipt (`deployHash`).
5. The settlement updates that listing's reputation. The payment is the review.

***

## Documentation

| Doc | What it covers |
|---|---|
| [START-HERE](docs/START-HERE.md) | the whole idea, assuming zero knowledge |
| [HOW-IT-WORKS](docs/HOW-IT-WORKS.md) | architecture and the payment flow in detail |
| [TESTNET](docs/TESTNET.md) | wallet, faucet, funding, first real settlement |
| [CLI-AND-MCP](docs/CLI-AND-MCP.md) | terminal usage and wiring into Claude or Cursor |
| [ADDRESSES](docs/ADDRESSES.md) | accounts, contract hashes, entry points, gas budgets |
| [PROOF](docs/PROOF.md) | on-chain evidence and how to verify it yourself |

All six also render in the app at `/docs`, and as plain text at `/llms.txt`.

***

## Project structure

```
apps/web
  src/app
    api/t/[slug]       the real HTTP 402 paid endpoint
    api/agent/run      server-side agent loop (discover → pay → complete)
    api/discovery/*    machine-readable catalog + search
    api/mcp            HTTP MCP surface
    docs/              the markdown in docs/, rendered
  src/lib/x402
    casper.ts          EIP-712 signing, verification, on-chain settlement,
                       CSPR→WCSPR wrapping, CEP-18 transfer, balance reads
    client.ts          the x402 HTTP client (402 → sign → retry)
    facilitator.ts     verify + settle, with the replay guard
  scripts
    cli.ts             pnpm agentify
    mcp-server.ts      pnpm mcp
    casper/*           keygen · balance · wrap · transfer · pay · sign-test
brand/                 logo source
docs/                  the six documents above
```

***

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 · React 19 · TypeScript |
| Styling | Tailwind v4 · Geist · React Flow |
| State | Zustand |
| Payments | `@casper-ecosystem/casper-eip-712` · `casper-js-sdk` |
| Settlement | WCSPR CEP-18 on Casper testnet, `transfer_with_authorization` |
| Storage | Redis — the settlement ledger. The catalog is in-code fixtures; no SQL database is wired up |
| Testing | Playwright · custom self-test and SEO audit scripts |

Design is refined-light and editorial, inspired by
[designsystems.surf](https://designsystems.surf), re-typeset in Geist and
retimed to sub-300ms motion with custom easing. Geist Mono carries every price,
hash, and stat.

***

<div align="center">

Built for the **Casper Agentic Buildathon 2026**.

_Casper built the rails. We built the market._

</div>
