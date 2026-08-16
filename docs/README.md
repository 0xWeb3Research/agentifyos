# AgentifyOS documentation

**The marketplace where AI agents shop for tools**: developers publish paid
tools, autonomous agents discover them and pay per call with x402 on Algorand.

Read in this order:

| # | Doc | What it covers | For |
|---|---|---|---|
| **1** | **[START-HERE.md](./START-HERE.md)** | The big picture from zero: what a blockchain is, what Algorand and USDC are, what x402 is, why AI agents need to pay for things, what we built, and how it was built. **Assumes no prior knowledge.** | everyone: start here |
| **2** | [HOW-IT-WORKS.md](./HOW-IT-WORKS.md) | The architecture: the payment flow step by step, the atomic group, the facilitator's role, wallets and identity, how reputation is derived. | understanding the system |
| **3** | [ALGORAND.md](./ALGORAND.md) | **The Algorand runbook**, and the default path: accounts, faucets, the USDC opt-in, the GoPlausible facilitator, and a first real settlement on Lora. | actually running it |
| **4** | [TESTNET.md](./TESTNET.md) | **The Casper runbook**, the alternate chain behind `CHAIN=casper`: keys, faucet, wrapping CSPR into WCSPR, a live payment, verifying it on cspr.live. | running the alternate chain |
| **5** | [CLI-AND-MCP.md](./CLI-AND-MCP.md) | Buying tools from a terminal, or letting Claude/Cursor buy them over MCP. | using it as a machine |
| **6** | [ADDRESSES.md](./ADDRESSES.md) | Every account, asset id, endpoint, port and env var, on both chains. | reference |
| **7** | [PROOF.md](./PROOF.md) | **Real on-chain settlements**: transaction ids, the three independent ways to verify one, and how to produce your own. | seeing that it works |

Also useful:

- [`../README.md`](../README.md): project overview and quickstart
- [`../CHANGELOG.md`](../CHANGELOG.md): what's been built, and what's pending
- [`../PLAN.md`](../PLAN.md): the hackathon plan and strategy
- [`../apps/web/CONTRACTS.md`](../apps/web/CONTRACTS.md): the internal API + design contracts used to coordinate the parallel build

---

## The 30-second version

An AI agent needs data it doesn't have. It searches our catalog, finds a tool,
and calls it. The tool replies **HTTP 402 Payment Required** with a price in
USDC. The agent signs a USDC transfer with its own key and retries. The
GoPlausible facilitator verifies the transaction group, sponsors the network
fee, and submits it to Algorand. The tool runs, and the agent gets its result
plus an on-chain receipt.

No API keys. No sign-up. No human. And because every settlement is public and
verifiable, **the payment is the review**: a listing's reputation is computed
from real money that really moved.
