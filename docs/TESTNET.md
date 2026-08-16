# Casper runbook

Zero to a **real on-chain x402 settlement** you can open on
[testnet.cspr.live](https://testnet.cspr.live). Everything here moves real
testnet value; nothing is simulated.

Algorand is the default chain. This page is the **alternate** one, selected with
`CHAIN=casper`: WCSPR on Casper testnet, settled by a facilitator we run
ourselves. For the default path see the [Algorand runbook](./ALGORAND.md).

> **"Devnet"?** Casper has **mainnet** and **testnet** (plus an optional local
> node). This guide targets **testnet**: free tokens, real chain.

---

## Before you start: this is not what the hosted demo runs

The open demo at **[agentifyos.xyz/agent](https://agentifyos.xyz/agent)** runs
the default chain, so its payments settle in USDC on Algorand and link to
[Lora](https://lora.algokit.io/testnet), not to cspr.live. Nothing on this page
is needed to watch that.

The safety mechanics are the same on either chain: payments settle from a
**shared testnet wallet**, never yours; anonymous runs draw on a **global daily
budget** (`DEMO_DAILY_USD_CAP`, default $2/day) so the wallet cannot be drained;
and it is **testnet** throughout, so the tokens are worthless practice tokens.
Signing in with **Casper Wallet** when the page prompts proves who you are, costs
no gas, moves nothing from your account, and skips the shared cap.

The rest of this guide is for running your **own** instance on Casper, from your
**own** keys.

---

## 0. What you need

| | |
|---|---|
| **Node 20+ / pnpm** | already set up in this repo |
| **Casper Wallet** (browser extension) | **only** to pull free CSPR from the faucet ([casperwallet.io](https://www.casperwallet.io)) |
| `CHAIN=casper` in `apps/web/.env` | otherwise every command settles on Algorand |
| Time | ~10 minutes |

**Important:** the *agents never use a browser wallet*. They sign with headless
Ed25519 keypairs (`.pem` files). Casper Wallet is only how *you* claim faucet
tokens once. See [HOW-IT-WORKS.md](./HOW-IT-WORKS.md).

> Casper secrets are PEM files on disk, which is the opposite of the Algorand
> path, where the keys are 25-word mnemonics held in the environment. Each chain
> keeps its own convention; nothing is shared between them.

---

## 1. Generate the keypairs

```bash
cd apps/web
pnpm casper:keygen
```

Creates three real Ed25519 keys in `apps/web/keys/` (gitignored):

| Role | Purpose | Needs |
|---|---|---|
| **facilitator** | submits settlements on-chain, **pays gas** | ~200 CSPR |
| **treasury** | wraps CSPR→WCSPR, funds agents | ~200 CSPR |
| **agent** | signs x402 payments (the buyer) | WCSPR only (no gas!) |

The command prints each account's public key + a cspr.live link. **Copy the
facilitator and treasury public keys**; you'll fund those next.

> Casper needs a facilitator role of its own because we run that half. On
> Algorand there is no such role: GoPlausible runs the facilitator, so only
> `treasury` and `agent` exist there.

---

## 2. Get testnet CSPR  ← the only step that needs you

The faucet funds *the wallet you sign in with*, so it's a two-hop:

1. Open **[testnet.cspr.live/tools/faucet](https://testnet.cspr.live/tools/faucet)**, sign in with Casper Wallet.
2. Click **Request tokens** → **5,000 CSPR**, once per account, lifetime (repeat requests fail with `User error: 1`).
3. In Casper Wallet, **send CSPR to the two accounts** from step 1:
   - → **facilitator** public key: ~**200 CSPR**
   - → **treasury** public key: ~**200 CSPR**

> **Send at least 2.5 CSPR to each.** On Casper an account doesn't exist until
> it's funded, and `native_transfer_minimum_motes` is 2,500,000,000. A smaller
> transfer won't bring the account into existence. 200 each is comfortable.

Confirm it landed:

```bash
pnpm casper:balance
#   facilitator      200.0000 CSPR   01e3d2d1883d…
#   treasury         200.0000 CSPR   014ea619c544…
#   agent              0.0000 CSPR   01e565e859f9…   ← agent needs no CSPR
```

Already holding CSPR in one of the roles? `pnpm casper:fund` moves native CSPR
between them without another faucet claim.

> Need more than 5,000? Email `casper-testnet@make.services`. There is no
> programmatic faucet API.

---

## 3. Wrap CSPR → WCSPR

Casper settles in **WCSPR**, an x402-enabled CEP-18 token (package
`3d80df21…4847c1e`, active version 8). You mint it 1:1 by depositing CSPR.

```bash
pnpm casper:wrap --role treasury --cspr 100
```

Verify the construction first without spending anything:

```bash
pnpm casper:wrap --role treasury --cspr 100 --dry-run
```

<details>
<summary><b>Why this is a session transaction, not a contract call</b> (the subtle part)</summary>

`deposit` is an **Odra payable** entry point. It declares *zero* args on-chain,
but it reads an **undeclared `cargo_purse` URef** arg. Casper 2.0 has **no
attached-value primitive for stored-contract calls**, which is why
`casper-js-sdk`'s `ContractCallBuilder` has no value setter, by design. A plain
contract call would succeed and mint you **0 WCSPR**.

The correct path is Odra's **`proxy_caller_with_return.wasm`** run as a *session*
transaction: it creates a purse, transfers `attached_value` into it, and injects
`cargo_purse` into the call. We ship that wasm at
`apps/web/scripts/casper/wasm/`. WCSPR mints to `get_caller()`: the **signing
account**.

One gotcha baked into the code: the inner `args` value must be Casper `Bytes`
(a length-prefixed `List<U8>`), *not* a `ByteArray`: a ByteArray omits the
length prefix and fails `Bytes::from_bytes` inside the proxy caller.
</details>

**Alternative:** [Casper Delta](https://casperdelta.xyz/) exposes a WCSPR
faucet/wrap tool on testnet; verify it targets package `3d80df21…` before relying on it.

> There is no wrapping step on Algorand. USDC is already the settlement asset
> there, and a listing priced at $0.005 quotes exactly 5000 atomic units.

---

## 4. Fund the agent with WCSPR

The buying agent needs WCSPR (and **no CSPR at all**; the facilitator pays gas,
which is the whole point of x402):

```bash
pnpm casper:transfer --to agent --amount 10000000000   # 10 WCSPR (9 decimals)
```

---

## 5. Run a real settlement 🎯

```bash
pnpm casper:pay
```

The agent signs an EIP-712 `TransferWithAuthorization`; the facilitator submits
`transfer_with_authorization` on-chain and pays gas:

```
  → agent signs EIP-712 authorization…
    signature 010aa99b6cc09d89b746… (65 bytes)
  → facilitator settles on-chain (transfer_with_authorization)…

  ✅ SETTLED on Casper testnet
     deploy   9ecbdb7576daf5e8726bf2fb…
     explorer https://testnet.cspr.live/deploy/9ecbdb75…
```

**Open that explorer link. That's your real on-chain proof.**

Options: `--amount <atomic>` (default `8658008`), `--to 00<accounthash>`.

---

## 6. Run the marketplace against Casper testnet

```bash
cp .env.example .env    # then set MODE=real and CHAIN=casper
pnpm dev                # http://localhost:8402
```

`CHAIN=casper` is what switches the paid endpoints, the CLI, and the MCP server
onto this path; without it they quote USDC on Algorand. Mirror it as
`NEXT_PUBLIC_CHAIN=casper` so the browser names the same chain the server
settles on.

Then open **`/agent`**, give the agent a task, and every payment it makes is a
real Casper testnet settlement with a live deploy hash.

The receipt field carrying that hash is called **`txHash`** on both chains; it
holds a Casper deploy hash here and an Algorand transaction id on the default
path. (It was named `deployHash` before Algorand existed.)

---

## 7. Verify the crypto without spending anything

These run fully offline (real keys, real EIP-712, no chain, no funds):

```bash
pnpm casper:signtest   # EIP-712 digest → sign → verify → tamper-reject
pnpm selftest          # payment-loop invariants incl. replay guard
```

---

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Payments quote USDC, not WCSPR | `CHAIN=casper` is unset; the default is Algorand. |
| `Purse not found` (-32026) | account is unfunded; that's a 0 balance, not an error. Fund it (§2). |
| Wrap succeeds but WCSPR balance is 0 | you called `deposit` as a plain contract call. Must be the **session/proxy_caller** path (§3). |
| `out of gas` on wrap | raise gas: the 184 KB session wasm needs ~20 CSPR. Tune from the failed execution cost. |
| Settlement reverts | agent has no WCSPR (§4), or the authorization expired (`validBefore` must be >6s out). |
| Faucet says `User error: 1` | already claimed: one per account, lifetime. |
| Facilitator can't pay | needs ~7 CSPR gas **per settlement**; top it up. |

---

## Reference

| | |
|---|---|
| Network / CAIP-2 | `casper-test` / `casper:casper-test` |
| RPC (no auth) | `https://node.testnet.casper.network/rpc` |
| Explorer | `https://testnet.cspr.live` |
| WCSPR package | `3d80df21ba4ee4d66a2a1f60c32570dd5685e4b279f6538162a5fd1314847c1e` (v8 → `contract-032706ae…c35f4a`) |
| Payment entry point | `transfer_with_authorization(from: Key, to: Key, value: U256, valid_after: U64, valid_before: U64, nonce: List<U8>, public_key: PublicKey, signature: List<U8>)` |
| Wrap entry point | `deposit()`: Odra payable, via proxy_caller session wasm |
| Settlement gas | ~7 CSPR per settlement (facilitator pays) |
| Faucet | 5,000 CSPR, once per account, Casper Wallet sign-in |
| Selected by | `CHAIN=casper` (the default is `algorand`) |

**Note on the hosted facilitator:** Casper runs one at
`x402-facilitator.cspr.cloud`, but its free **testnet quota is 25 calls/day**
(~12 payments). We **self-host** instead: our facilitator key + the public RPC,
no API key, no quota. On Algorand we don't host anything: GoPlausible's
facilitator is hosted, unmetered, and needs no key.

### ⚠️ Gas budgets burn what you overpay

Casper mainnet/testnet run `pricing_handling = payment_limited`. You declare a
payment up front, **the full amount is debited**, and only **75% of the unused
remainder is refunded**; the remaining 25% is burned. Overestimating destroys
CSPR rather than merely delaying it.

Our defaults follow the reference implementation (**7 CSPR** per settlement,
**20 CSPR** for the wrap session), which are deliberately safe rather than tight.
Since the faucet is a one-time 5,000 CSPR grant, it's worth **measuring actual
consumption on your first successful run** (the explorer shows gas consumed vs.
cost paid) and lowering `FACILITATOR_GAS_MOTES` / `WRAP_GAS_MOTES` in `.env`
toward the real figure. For scale, a measured CEP-18 call consumed ~0.39 CSPR of
gas, but cost its sender 0.92 CSPR because it budgeted 2.5.

This whole section has no Algorand equivalent: there is no gas budget to declare
there, and no fee for the buyer to overpay, because the facilitator sponsors it.
