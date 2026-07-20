# CLI & MCP · using the marketplace as a machine

Two ways to buy tools without opening a browser. Both are **real x402 clients**:
they hold their own Casper key, get an HTTP 402, sign it, retry, and settle
on-chain. Nothing is short-circuited internally; this is the same path any
third-party agent would take.

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
| `agentify balance` | on-chain CSPR + WCSPR balances |
| `agentify receipts` | recent settlements |

Options: `--key=<role>` (which key signs, default `agent`), `--max=<usd>` (refuse
to pay more than this). Point it elsewhere with `AGENTIFYOS_URL`.

### A real payment, start to finish

```console
$ pnpm agentify call cspr-market-data

  paying for cspr-market-data
  wallet 01e565e859f9bab3f7cb…  (holds WCSPR, no CSPR needed)

  REQ    GET https://agentifyos.xyz/api/t/cspr-market-data   +0ms
  402    payment required: 86580087 atomic WCSPR (~$0.0020)  +50ms
  SIG    signed EIP-712 authorization as 0041611f2c09…       +58ms
  PAID   settled: e50c18e49e666b66…                      +11823ms

  result
    { "symbol": "CSPR", "priceUsd": 0.0244, … }

  receipt
    cost      $0.0020
    deploy    e50c18e49e666b666b1cbe2001bc27db439fa9461e76df2ac974864253f5fa55
    explorer  https://testnet.cspr.live/deploy/e50c18e4…
```

Pass tool inputs as flags; they become query parameters:

```bash
pnpm agentify call page-scraper --url=https://casper.network/blog
```

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
| **`call_tool`** | **yes** | pay for a tool and return its result + deploy hash |
| `get_balance` | no | this wallet's on-chain CSPR/WCSPR |
| `list_settlements` | no | recent marketplace payments |

The read-only tools are annotated `readOnlyHint`, so hosts can auto-approve
them. **`call_tool` is deliberately not**: it's marked destructive so the client
asks before spending. Wiring that distinction in is the point: the model can
browse freely and must ask to buy.

`call_tool` takes ~15 seconds (it waits for on-chain finality) and streams
progress notifications so the client doesn't look stuck. That's well inside the
SDK's 60-second default timeout.

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

### Configuration

| Variable | Default | Meaning |
|---|---|---|
| `AGENTIFYOS_URL` | `https://agentifyos.xyz` | marketplace base URL; set to `http://localhost:8402` to run against a local dev server |
| `AGENTIFYOS_KEY` | `agent` | which key in `keys/` signs payments |
| `AGENTIFYOS_MAX_USD` | `0.10` | hard spend cap per call |

### Try it without a client

```bash
npx @modelcontextprotocol/inspector --cli pnpm mcp --method tools/list
```

Or drive it with raw JSON-RPC:

```bash
{ echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"x","version":"1"}}}'
  sleep 2
  echo '{"jsonrpc":"2.0","method":"notifications/initialized"}'
  echo '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"call_tool","arguments":{"slug":"cspr-market-data"}}}'
  sleep 40; } | pnpm mcp
```

Verified response (a real settlement, triggered over MCP):

```json
{
  "result": { "symbol": "CSPR", "priceUsd": 0.0246, … },
  "paid": {
    "costUsd": 0.002,
    "deployHash": "37e9859c2e297d157fc51d7c138e1c4a8dc753a161dc38431493f645bbd3c65a",
    "explorer": "https://testnet.cspr.live/deploy/37e9859c…",
    "network": "casper:casper-test"
  }
}
```

---

## Prerequisites

Both need a funded agent key. If `pnpm agentify balance` shows `0.0000 WCSPR`,
follow [TESTNET.md](./TESTNET.md): you need a key (`pnpm casper:keygen`), some
wrapped WCSPR, and the marketplace running (`pnpm dev`).

## Why this matters

Everything here goes through the **same public HTTP endpoint** the website uses.
There's no privileged internal path, which means the marketplace genuinely works
for third parties, and an AI assistant can buy data on a public blockchain
without a human, an account, or an API key anywhere in the loop.
