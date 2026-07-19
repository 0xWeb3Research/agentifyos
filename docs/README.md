# AgentifyOS documentation

**The marketplace where AI agents shop for tools** — developers publish paid
tools, autonomous agents discover them and pay per call with x402 on Casper.

Read in this order:

| # | Doc | What it covers | For |
|---|---|---|---|
| **1** | **[START-HERE.md](./START-HERE.md)** | The big picture from zero: what a blockchain is, what Casper is, what x402 is, why AI agents need to pay for things, what we built, and how it was built. **Assumes no prior knowledge.** | everyone — start here |
| **2** | [HOW-IT-WORKS.md](./HOW-IT-WORKS.md) | The architecture: the payment flow step by step, the smart contract's role, wallets and identity, the facilitator, how reputation is derived. | understanding the system |
| **3** | [PROOF.md](./PROOF.md) | **Real on-chain settlements** — deploy hashes on testnet.cspr.live, balance deltas, gas measurements. | seeing that it works |
| **4** | [ADDRESSES.md](./ADDRESSES.md) | Every account, contract hash, entry point, port and env var. | reference |
| **5** | [CLI-AND-MCP.md](./CLI-AND-MCP.md) | Buying tools from a terminal, or letting Claude/Cursor buy them over MCP. | using it as a machine |
| **6** | [TESTNET.md](./TESTNET.md) | Zero to a **real on-chain settlement** on Casper testnet: keys, faucet, wrapping CSPR→WCSPR, running a live payment, verifying it on the explorer. | actually running it |

Also useful:

- [`../README.md`](../README.md) — project overview and quickstart
- [`../CHANGELOG.md`](../CHANGELOG.md) — what's been built, and what's pending
- [`../PLAN.md`](../PLAN.md) — the hackathon plan and strategy
- [`../apps/web/CONTRACTS.md`](../apps/web/CONTRACTS.md) — the internal API + design contracts used to coordinate the parallel build

---

## The 30-second version

An AI agent needs data it doesn't have. It searches our catalog, finds a tool,
and calls it. The tool replies **HTTP 402 Payment Required** with a price. The
agent signs a payment authorization with its own key and retries. A facilitator
verifies the signature and settles it on Casper by calling a token contract. The
tool runs, and the agent gets its result plus an on-chain receipt.

No API keys. No sign-up. No human. And because every settlement is public and
verifiable, **the payment is the review** — a listing's reputation is computed
from real money that really moved.
