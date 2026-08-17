# AgentifyOS · submission package

**The marketplace where AI agents shop for tools.** A developer lists a paid API
in 60 seconds. An agent finds it mid-task, pays a fraction of a cent, and gets on
with the job.

Live on Algorand testnet, settled in USDC through the GoPlausible x402
facilitator. Six real settlements, verifiable on Lora.

For **Brainwave 2026, Blockchain track, resubmission**. Due **19 August 2026**.

***

## Open these in this order

| If you have | Read | Why |
|---|---|---|
| 30 seconds | this page | the product, the proof, the links |
| 5 minutes | [deck.pdf](./deck.pdf) | the full story, 12 slides |
| 10 minutes | [PRODUCT.md](./PRODUCT.md) | the same story in writing, with the numbers |
| You are grading it | [EVALUATOR-NOTES.md](./EVALUATOR-NOTES.md) | the five checks from the brief, answered |
| You are presenting it | [DEMO-SCRIPT.md](./DEMO-SCRIPT.md) | five minutes, tab by tab, with the likely questions |
| You are submitting it | [FORM-ANSWERS.md](./FORM-ANSWERS.md) · [CHECKLIST.md](./CHECKLIST.md) | paste-ready fields, and what is left |

***

## The 30-second version

An AI agent can reason, but it cannot buy. Every API it wants is behind a signup
form built for a human, so agents run on a leash: somebody provisions keys in
advance and hopes they cover the task.

x402 standardised how a machine pays over HTTP. Almost nothing sells anything
through it. **We built the supply side.**

| | |
|---|---|
| Listings in the catalog | 14, from 6 publishers, $0.002 to $0.020 |
| Settlements on Algorand testnet | 6, all verifiable on Lora |
| What the buyer paid in network fees | **$0.00**, the facilitator sponsors it |
| Revenue model | 80/20, on money that actually moved |

***

## Try it yourself

```bash
curl -i https://agentifyos.xyz/api/t/algo-market-data
```

That returns a real `402 Payment Required`, quoting 2000 microUSDC on Algorand
testnet. No browser, no session, no privileged path: it is the same endpoint the
agent, the CLI and the MCP server all pay.

| | |
|---|---|
| Prototype | <https://agentifyos.xyz> |
| Agent demo, the thing to actually watch | <https://agentifyos.xyz/agent> |
| A settled payment on Lora | [`KD6GTL4RAXJK…`](https://lora.algokit.io/testnet/transaction/KD6GTL4RAXJKJWEYSKUTBOX5ZWSMFXI6WENDZ4ZFMVXS4KEIEAGA) |
| Repo | <https://github.com/0xWeb3Research/agentifyos> |
| Runbook, clone to settlement in ten minutes | `docs/ALGORAND.md` |
| On-chain evidence | `docs/PROOF.md` |

***

## Rebuilding the deck

`deck.html` is the source. Its images live in `assets/` and are referenced
relatively, so the file stays readable; the renderer loads from `file://` and
embeds them into the PDF. Rendering uses the Playwright the repo already
installs for its e2e suite.

```bash
cd apps/web && npx playwright install chromium   # once, if not already present
cd ../../submit && node build-deck.mjs
```

Writes `deck.pdf` here: 12 slides, landscape, 0.76 MB, well under the form's
10 MB limit, with every link clickable.

### Refreshing the screenshots

The deck shows the real product and a real settled transaction, so the images go
stale when either changes. With the dev server running:

```bash
node capture-shots.mjs && node build-deck.mjs
```

That recaptures the catalog, the agent demo mid-run, and the transaction on
Lora, then rebuilds. The agent capture settles real payments, which is the
point: the slide shows a run that actually happened. Set `PROOF_TX` to feature a
different transaction.

***

This folder is gitignored. It is the wrapper around the product, not part of it.
