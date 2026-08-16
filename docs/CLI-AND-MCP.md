# CLI & MCP · using the marketplace as a machine

Two ways to buy tools without opening a browser. Both are **real x402 clients**:
they hold their own key, get an HTTP 402, sign it, retry, and settle on-chain.
Nothing is short-circuited internally; this is the same path any third-party
agent would take.

Both follow `CHAIN`. On the default, **Algorand**, they sign a USDC transfer and
the GoPlausible facilitator sponsors the network fee. With `CHAIN=casper` they
sign an EIP-712 authorization and our own facilitator pays the gas. Everything
below works either way; the chain-specific bits are called out.

---

## The CLI

```bash
cd apps/web
pnpm agentify <command>
```

| Command | What it does |
|---|---|
| `agentify tools` | list the catalog |
| `agentify search <query>` | search it |
| `agentify call <slug> [--k=v …]` | **pay for a tool** and print the result + receipt |
| `agentify balance` | on-chain balances: ALGO + USDC, or CSPR + WCSPR on Casper |
| `agentify receipts` | recent settlements |

Options: `--key=<role>` (which key signs, default `agent`), `--max=<usd>` (refuse
to pay more than this, default `1`). Point it elsewhere with `AGENTIFYOS_URL`.

On Algorand a role is an account loaded from `ALGO_AGENT_MNEMONIC` or
`ALGO_TREASURY_MNEMONIC` in `apps/web/.env`. On Casper it is a `.pem` file in
`apps/web/keys/`. Same flag, different key store.

### A real payment, start to finish

```console
$ pnpm agentify call algo-market-data

  paying for algo-market-data on Algorand testnet
  wallet <the agent's Algorand address>
  holds USDC; the facilitator sponsors the network fee

  REQ    GET https://agentifyos.xyz/api/t/algo-market-data
  402    payment required: 2000 microUSDC (~$0.0020) → <treasury>…
  SIG    signed a 2-transaction group as <agent>…
  PAID   settled on Algorand testnet · <txid>

  result
    { "symbol": "CSPR", "priceUsd": …, … }

  receipt
    cost      $0.0020
    transaction id <txid>
    explorer  https://lora.algokit.io/testnet/transaction/<txid>
    receipt   https://facilitator.goplausible.xyz/api/receipt/<txid>
```

Two links, on purpose. `explorer` is Algorand's own record on
[Lora](https://lora.algokit.io/testnet); `receipt` is **GoPlausible's**, served
from their records rather than ours, so nothing here has to be taken on trust.
On Casper the receipt line is absent and the explorer link points at a deploy on
cspr.live.

The `SIG` step names what actually got signed: a **two-transaction atomic group**
whose other member is the facilitator's fee transaction, left unsigned for the
facilitator to sign. The agent's ALGO balance is the same after the call as
before it.

Pass tool inputs as flags; they become query parameters:

```bash
pnpm agentify call page-scraper --url=https://algorand.co
```

### Checking the wallet

```console
$ pnpm agentify balance

  Algorand testnet balances

  treasury          <algo> ALGO      <usdc> USDC   <address>…
  agent             <algo> ALGO      <usdc> USDC   <address>…

  fund ALGO: https://lora.algokit.io/testnet/fund
  fund USDC: https://faucet.circle.com
```

An account that has not opted into ASA `10458941` prints `not opted in` where the
USDC figure goes, which is the failure worth catching before you spend anything:
Algorand will not credit an asset to an account that has not opted in. Fix it with
`pnpm algo:optin`.

The ALGO column is not meant to reach zero. Roughly 0.2 ALGO per account is
Algorand's **locked minimum balance** (0.1 to exist, 0.1 more to hold one asset).
It never moves and it is not spent on fees.

---

## The MCP server

[MCP](https://modelcontextprotocol.io) is the standard that lets Claude and
Cursor use external tools. This server gives them the ability to **buy** one.

```bash
pnpm mcp        # stdio server; logs to stderr
```

### Tools it exposes

| Tool | Spends money? | Purpose |
|---|---|---|
| `search_tools` | no | find tools by free text |
| `get_tool` | no | price, schema, stats for one tool |
| **`call_tool`** | **yes** | pay for a tool and return its result + a verifiable transaction id |
| `get_balance` | no | this wallet's on-chain balances |
| `list_settlements` | no | recent marketplace payments |

The read-only tools are annotated `readOnlyHint`, so hosts can auto-approve
them. **`call_tool` is deliberately not**: it's marked destructive so the client
asks before spending. Wiring that distinction in is the point: the model can
browse freely and must ask to buy.

`call_tool` streams progress notifications so the client doesn't look stuck, and
finishes in a few seconds on Algorand, where there is no gas budget and no block
to wait out. Casper settlements take ~15 seconds. Both are well inside the SDK's
60-second default timeout.

Its description, its spend cap, and the explorer it names all come from the
active chain, so a model reading the tool list is told which chain it is about to
settle on.

#### `call_tool` returns

```json
{
  "result": { "symbol": "CSPR", "priceUsd": …, "…": "…" },
  "paid": {
    "costUsd": 0.002,
    "txHash": "<algorand transaction id>",
    "explorer": "https://lora.algokit.io/testnet/transaction/<txid>",
    "facilitatorReceipt": "https://facilitator.goplausible.xyz/api/receipt/<txid>",
    "network": "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI="
  }
}
```

`txHash` was called `deployHash` when Casper was the only chain. With
`CHAIN=casper` it carries a deploy hash, `explorer` points at cspr.live, and
`facilitatorReceipt` is `null`: we are the facilitator there, so there is no
independent record to link.

#### `get_balance` returns

```json
{
  "address": "<the agent's Algorand address>",
  "algo": "<microALGO / 1e6, 4dp>",
  "usdc": "<microUSDC / 1e6, 4dp>",
  "optedIntoUsdc": true,
  "network": "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=",
  "explorer": "https://lora.algokit.io/testnet/account/<address>"
}
```

`usdc` is `null` and `optedIntoUsdc` is `false` when the account has not opted
into ASA `10458941`, which is the first thing to check when a payment fails. On
Casper the same tool returns `cspr` and `wcspr` instead, with a public key and an
account hash.

### The spend cap, and why it doesn't read the wire

`AGENTIFYOS_MAX_USD` caps every call. A model-supplied `maxUsd` can only **lower**
it, never raise it. The cap is re-checked against **local, trusted** decimals
before anything is signed, not against the `extra.decimals` in the 402: that
field is server-supplied, and a hostile marketplace could advertise 18 decimals to
make a large amount look like cents. On Algorand the conversion is exact anyway
(USDC, 6 decimals, one dollar); on Casper it goes through an illustrative CSPR
price.

### Install it

**Claude Code**

```bash
claude mcp add-json agentifyos '{
  "type": "stdio",
  "command": "pnpm",
  "args": ["--dir", "/ABSOLUTE/PATH/TO/agentifyos/apps/web", "mcp"],
  "env": { "AGENTIFYOS_MAX_USD": "0.10" }
}' --scope user
```

**Claude Desktop**, in `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "agentifyos": {
      "command": "/absolute/path/to/node",
      "args": ["/ABSOLUTE/PATH/TO/agentifyos/apps/web/node_modules/.bin/tsx",
               "/ABSOLUTE/PATH/TO/agentifyos/apps/web/scripts/mcp-server.ts"],
      "env": {}
    }
  }
}
```

> Use an **absolute path** for `command`. A GUI-launched app inherits a minimal
> `PATH` and won't find a version-managed `node`. Run `which node` and paste
> that. Then fully quit and reopen Claude Desktop; closing the window isn't enough.
> Server logs land in `~/Library/Logs/Claude/mcp-server-agentifyos.log`.

**Cursor**: same `mcpServers` block in `~/.cursor/mcp.json`.

The server reads `apps/web/.env`, so the keys and the chain follow from there. An
`env` block in the client config overrides it per client.

### Configuration

| Variable | Default | Meaning |
|---|---|---|
| `AGENTIFYOS_URL` | `https://agentifyos.xyz` | marketplace base URL; set to `http://localhost:8402` to run against a local dev server |
| `AGENTIFYOS_KEY` | `agent` | which role signs: an env mnemonic on Algorand, a `keys/*.pem` file on Casper |
| `AGENTIFYOS_MAX_USD` | `0.10` | hard spend cap per call |
| `CHAIN` | `algorand` | which chain settles; `casper` selects the alternate path |

### Try it without a client

```bash
npx @modelcontextprotocol/inspector --cli pnpm mcp --method tools/list
```

Or drive it with raw JSON-RPC:

```bash
{ echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"x","version":"1"}}}'
  sleep 2
  echo '{"jsonrpc":"2.0","method":"notifications/initialized"}'
  echo '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"call_tool","arguments":{"slug":"algo-market-data"}}}'
  sleep 40; } | pnpm mcp
```

---

## Prerequisites

Both need a funded, opted-in agent account. If `pnpm agentify balance` shows
`not opted in`, or `0.0000 USDC`, follow the
[Algorand runbook](./ALGORAND.md): `pnpm algo:keygen`, both faucets,
`pnpm algo:optin`, `pnpm algo:fund --usdc 1`. `pnpm algo:preflight` checks all of
it at once and names the fix for whatever is missing.

On `CHAIN=casper` the equivalent is the [Casper runbook](./TESTNET.md):
`pnpm casper:keygen`, the faucet, and wrapped WCSPR.

Either way the marketplace has to be reachable: `pnpm dev` locally, or leave
`AGENTIFYOS_URL` pointing at the hosted instance.

## Why this matters

Everything here goes through the **same public HTTP endpoint** the website uses.
There's no privileged internal path, which means the marketplace genuinely works
for third parties, and an AI assistant can buy data on a public blockchain
without a human, an account, or an API key anywhere in the loop.
