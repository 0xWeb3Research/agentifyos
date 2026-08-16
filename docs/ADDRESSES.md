# Addresses & on-chain reference

Every account, asset, contract, and endpoint AgentifyOS touches. **Testnet only
on both chains; nothing here touches mainnet.** Everything below is public and
safe to share.

Algorand is the default chain and comes first. Casper is the alternate, behind
`CHAIN=casper`, and starts at §2.

---

## 1. Algorand testnet · the default

### 1.1 Network

```
chain             Algorand testnet
CAIP-2 id         algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=
algod             https://testnet-api.algonode.cloud     (public, no auth)
indexer           https://testnet-idx.algonode.cloud
explorer          https://lora.algokit.io/testnet        (Lora, AlgoKit's explorer)
ALGO faucet       https://lora.algokit.io/testnet/fund   (browser login, no API)
USDC faucet       https://faucet.circle.com              (pick Algorand → TestNet)
```

The CAIP-2 id is `algorand:<base64 genesis hash>`, the same constant
`ALGORAND_TESTNET_CAIP2` exports from `@x402-avm/avm`. `src/lib/chain.ts`
repeats it as a literal so client components can read it without pulling in the
SDK, and `pnpm algo:preflight` asserts the two still agree.

### 1.2 The settlement asset

```
asset             USDC (USD Coin)
ASA id            10458941
decimals          6
explorer          https://lora.algokit.io/testnet/asset/10458941
```

Six decimals and a dollar peg mean pricing is exact: **$0.005 is `5000` atomic
units**, with no oracle and no rounding in the path.

> **Opt-in is mandatory.** Algorand will not credit an asset to an account that
> has not opted into it, so the buying agent *and* every receiving address must
> opt into ASA `10458941` once. `pnpm algo:optin` does it; `pnpm algo:preflight`
> checks it. A payee that skipped it fails inside the facilitator's simulate step
> with `asset 10458941 missing from <address>`.

### 1.3 The facilitator · GoPlausible

Hosted, no API key, no signup, no quota. We run nothing here.

```
base URL          https://facilitator.goplausible.xyz
```

| Route | What it does |
|---|---|
| `POST /verify` | checks a submitted payment group before anything is broadcast |
| `POST /settle` | signs the fee transaction, simulates the group, submits it, returns the transaction id |
| `GET /supported` | networks and schemes served, plus `kinds[].extra.feePayer` |
| `GET /health` | liveness |
| `GET /discovery/resources` | the public Bazaar: every resource paid for at least once |
| `GET /api/receipt/{txid}` | the facilitator's own record of a settled payment |

#### The fee sponsor

This is the one fixed Algorand address in this document, and it is not ours:

```
fee sponsor       ZMFK2OI7ZBD2U27ISERZC4S6LKM6WMFJPZQ4MYNJDZ2VNBNMBA67RA22AA
source            GET /supported → kinds[].extra.feePayer
explorer          https://lora.algokit.io/testnet/account/ZMFK2OI7ZBD2U27ISERZC4S6LKM6WMFJPZQ4MYNJDZ2VNBNMBA67RA22AA
```

Every settlement of ours is an atomic group whose index 0 is a 0-ALGO payment
from that account to itself, carrying the pooled fee. The buyer's USDC transfer
is index 1, signed with a fee of 0. `pnpm algo:balance` prints this address after
the roles, so the sponsorship claim is checkable rather than asserted.

Read at runtime, never hardcoded in the payment path. Override it for a
different facilitator with `X402_FACILITATOR_URL`.

### 1.4 Our accounts · per deployment

There are **two** roles on Algorand, and no facilitator role: GoPlausible runs
that half.

| Role | What it does | Needs |
|---|---|---|
| **treasury** | receives every payment, and stocks the agent with USDC | ~0.3 ALGO, USDC from the faucet, opted in |
| **agent** | the buyer: signs the USDC transfer | ~0.3 ALGO, USDC from the treasury, opted in |

**No addresses are printed here on purpose.** They are generated per deployment
by `pnpm algo:keygen`, which prints two accounts and the exact `.env` lines to
paste. Secrets are 25-word mnemonics held in the environment, not files on disk:
a hosted deploy has no filesystem to ship a key file to.

Where a running instance's own addresses surface:

| Where | What it shows |
|---|---|
| `pnpm algo:balance` | both roles, ALGO and USDC, opt-in state, Lora links, plus the fee sponsor |
| `pnpm algo:preflight` | the same addresses, each with the check that depends on it |
| `GET /api/discovery/resources` | `payTo` on every listing: the treasury address the 402 quotes |
| `/explain` | the rendered address book, straight from runtime config |
| any receipt | `payer`, plus `explorerUrl` and `facilitatorReceiptUrl` |

> **About the ALGO balance.** The agent spends **no ALGO on fees**, but it is not
> empty: Algorand locks a **minimum balance** of 0.1 ALGO for the account plus
> 0.1 ALGO for holding one asset, so roughly **0.2 ALGO stays locked** and never
> moves. Fund each account with ~0.3 ALGO and the difference covers the one-time
> opt-in transaction.

Every listing currently settles into the one treasury account. On Algorand a
payee must exist on-chain and be opted into USDC before it can be paid at all,
so per-seller payout accounts are a mainnet concern; `resolvePayTo()` in
`src/lib/config.ts` is the single place that decision lives.

### 1.5 Explorer URL patterns · Lora

| What | URL |
|---|---|
| Transaction | `https://lora.algokit.io/testnet/transaction/{txid}` |
| Account | `https://lora.algokit.io/testnet/account/{address}` |
| Asset | `https://lora.algokit.io/testnet/asset/{id}` |
| Application | `https://lora.algokit.io/testnet/application/{id}` |

Built by `explorerTx()`, `explorerAccount()`, and `explorerAsset()` in
`src/lib/chain.ts`, so a receipt and this table cannot drift apart.

### 1.6 Packages

```
@x402-avm/core        2.6.1   resource server, client, header codecs
@x402-avm/avm         2.6.1   the AVM exact scheme, network constants, signers
@x402-avm/fetch       2.6.1   the client wrapper
@x402-avm/extensions  2.6.1   the Bazaar discovery extension
algosdk               3.x     accounts, balances, ASA opt-in, funding transfers
```

`algosdk` never builds the payment. The SDK constructs and signs the group;
algosdk covers only the operator-facing work the protocol has no opinion about.

### 1.7 Environment

| Variable | Default | Meaning |
|---|---|---|
| `CHAIN` | `algorand` | the settlement chain; `casper` selects §2 |
| `NEXT_PUBLIC_CHAIN` | `algorand` | so the browser names the chain the server settles on |
| `MODE` | `mock` | `real` settles on-chain; mock settles in-process |
| `ALGO_TREASURY_MNEMONIC` | - | 25 words, from `pnpm algo:keygen` |
| `ALGO_AGENT_MNEMONIC` | - | 25 words, from `pnpm algo:keygen` |
| `ALGO_TREASURY_ADDRESS` | - | the payee every listing quotes; unset means `/api/t/*` answers 503 |
| `ALGO_AGENT_ADDRESS` | - | public, for display |
| `NEXT_PUBLIC_ALGO_TREASURY_ADDRESS` | - | mirrors the above into the browser bundle |
| `NEXT_PUBLIC_ALGO_AGENT_ADDRESS` | - | same |
| `X402_FACILITATOR_URL` | `https://facilitator.goplausible.xyz` | the facilitator |
| `ALGOD_TESTNET_URL` | `https://testnet-api.algonode.cloud` | algod node |
| `ALGO_USDC_ASSET_ID` | `10458941` | the settlement ASA |
| `NEXT_PUBLIC_ALGO_FACILITATOR_ADDRESS` | the sponsor in §1.3 | only for display, if GoPlausible rotates it |

Full setup, in order, is the [Algorand runbook](./ALGORAND.md).

---

## 2. Casper testnet · `CHAIN=casper`

The original implementation, unchanged. Private keys here are **PEM files in
`apps/web/keys/`** (gitignored), which is the opposite convention to Algorand's
mnemonics-in-env.

Generated 2026-07-19 via `pnpm casper:keygen`.

### 2.1 The three demo accounts

| Role | What it does | Needs |
|---|---|---|
| **Facilitator** | Submits every settlement on-chain and **pays the gas** | ~2,000 CSPR |
| **Treasury** | Wraps CSPR → WCSPR, then funds agents with WCSPR | ~2,000 CSPR |
| **Agent** | The buyer: signs x402 payments | **WCSPR only, no CSPR** |

> The agent holding **zero CSPR** is x402 working as intended on this chain: it
> signs payment authorizations off-chain and our facilitator pays the transaction
> fee. Algorand reaches the same outcome differently, and there the agent does
> keep a small locked ALGO minimum balance (§1.4).

#### Facilitator · *pays gas*
```
public key    01e3d2d1883d8c63bb4b6e0df05ea9c2f42c6a483c704cfcd8a727e2e4373252ae
account hash  e0c57785b93365efc81063aabdcec6056d6f1523da33acdb5c2001620aad8796
key file      apps/web/keys/facilitator.pem
explorer      https://testnet.cspr.live/account/01e3d2d1883d8c63bb4b6e0df05ea9c2f42c6a483c704cfcd8a727e2e4373252ae
```

#### Treasury · *wraps and distributes WCSPR*
```
public key    014ea619c544f11f034674ccccb44c8758c354f674af2bf3138514a501539706ab
account hash  4ee08c54de78389c1466980260051c44f6dc367391ae37dc3f473896dbbeb666
key file      apps/web/keys/treasury.pem
explorer      https://testnet.cspr.live/account/014ea619c544f11f034674ccccb44c8758c354f674af2bf3138514a501539706ab
```

#### Agent · *the buyer*
```
public key    01e565e859f9bab3f7cb1eb666ffa7aa12879e27639f7c000a079e859edbbfde0c
account hash  41611f2c0902ede544b2a61e557b47b5ca5b313a03bbaa45765eb80075ca9e1e
key file      apps/web/keys/agent.pem
explorer      https://testnet.cspr.live/account/01e565e859f9bab3f7cb1eb666ffa7aa12879e27639f7c000a079e859edbbfde0c
```

All three are **Ed25519** (the `01` prefix; `02` would be secp256k1).

#### Funding source

Testnet CSPR comes from the [faucet](https://testnet.cspr.live/tools/faucet)
(**once per account, for life**; repeats fail with `User error: 1`), claimed
into a Casper Wallet account and then forwarded to the two accounts above.
`pnpm casper:fund` moves native CSPR between roles afterwards.

> Minimum transfer to bring an account into existence: **2.5 CSPR**
> (`native_transfer_minimum_motes`). A smaller send won't create the account.
> Each transfer costs a flat **0.1 CSPR** fee.

Check status any time:

```bash
cd apps/web && pnpm casper:balance
```

### 2.2 The WCSPR contract

Payments settle in **WCSPR**, an x402-enabled CEP-18 token, minted 1:1 by
depositing CSPR. Verified live: total supply exactly equals the CSPR locked in
the contract's purse.

```
package hash      3d80df21ba4ee4d66a2a1f60c32570dd5685e4b279f6538162a5fd1314847c1e
active version    8   →  contract-032706aeae170fafb6403ce3bec58062f1c4288710838fe1df98ce4ff6c35f4a
name / symbol     Wrapped CSPR / WCSPR
decimals          9        (1 WCSPR = 1,000,000,000 atomic units)
balances dict     uref-f8491246e0eed9c5cd5c0a896dc6e0a270bba846df69b6d497c9694dcdc2770c-007
explorer          https://testnet.cspr.live/contract-package/3d80df21ba4ee4d66a2a1f60c32570dd5685e4b279f6538162a5fd1314847c1e
```

Versions 1–7 are disabled; **v8 is active**. Always target the *package* hash:
it's the stable address, and `version: null` routes to the newest enabled version.

> ⚠️ **The contract gets upgraded under you.** On 2026-07-20 the publisher
> disabled v7 and enabled v8, which **renamed the `amount` argument to `value`**
> in `transfer_with_authorization` (matching EIP-3009's canonical struct). Because
> we target the package with `version: null`, every settlement silently started
> reverting with `User error: 64658`, a missing-required-argument error, not a
> signature problem. The signed EIP-712 digest was unaffected; its field was
> already `value`. If settlements begin failing after working, diff the live
> entry-point args against what we send before suspecting the signature.

#### Entry points we call (verified on-chain)

| Entry point | Arguments | Used for |
|---|---|---|
| **`transfer_with_authorization`** | `from: Key`, `to: Key`, `value: U256`, `valid_after: U64`, `valid_before: U64`, `nonce: List<U8>`, `public_key: PublicKey`, `signature: List<U8>` | **the x402 payment**: facilitator submits the agent's signed authorization |
| `transfer` | `recipient: Key`, `amount: U256` | treasury → agent WCSPR distribution |
| `deposit` | *(none declared)* | wrap CSPR → WCSPR; **payable**, see below |
| `balance_of` | `address: Key` | on-chain only; can't be called read-only |

> **`deposit` gotcha:** it declares zero arguments but is an **Odra payable**
> entry point that reads an undeclared `cargo_purse`. Casper 2.0 has no
> attached-value primitive for contract calls, so wrapping must run as a
> **session transaction** using Odra's `proxy_caller_with_return.wasm`
> (bundled at `apps/web/scripts/casper/wasm/`). A plain contract call mints 0.

> **Balance reads:** `balance_of` returns `U256` but there's no read-only call
> mechanism on the public node. Read the `balances` dictionary instead, keyed by
> **`base64(0x00 || 32-byte account hash)`**. A missing entry (`-32003`) means
> zero, not an error.

### 2.3 Our own contract · the ToolRegistry

Written by us and deployed to Casper testnet. It anchors a hash of each listing's
manifest on-chain so a later silent edit to a price or payout address is
detectable. It is not in the payment path on either chain.

```
package hash      9c1b0ac3b1f2d2db53ef4884761c3567ebecf93ff4f5623e5545903bc0720a18
active version    1   →  contract-6cdc0ef319aedf391c6b5c34f1e0d8f106a3fa722ba5de84211f4fe657c63bb7
owner             treasury (014ea619…9706ab)
entry points      register_tool(slug: String, manifest_hash: String)
                  get_manifest_hash(slug: String) -> String
dictionaries      manifests (slug -> sha256), owners (slug -> Key)
source            contracts/tool-registry/src/main.rs
explorer          https://testnet.cspr.live/contract-package/9c1b0ac3b1f2d2db53ef4884761c3567ebecf93ff4f5623e5545903bc0720a18
```

First writer owns a slug; only that account can update it. Read it with
`pnpm casper:registry-info`, anchor a listing with `pnpm casper:registry-register`.

> **Deploying to Casper 2.0: three things that each cost 100+ CSPR to learn.**
> A failed install is charged the *full declared gas*, so get these right first:
>
> 1. The precompiled `core`/`alloc` for `wasm32-unknown-unknown` ship **with
>    bulk-memory**. Disabling the target feature on your own crate does nothing;
>    you need `-Z build-std=core,alloc,panic_abort`.
> 2. Even then LLVM emits `memory.copy`/`memory.fill` and the node rejects the
>    module at preprocessing: *"Bulk memory operations are not supported"*. Run
>    `wasm-opt --llvm-memory-copy-fill-lowering --signext-lowering`. Verify with
>    `wasm-opt out.wasm --print -o /dev/null | grep -c memory.copy` → must be `0`.
> 3. An install must be flagged `.installOrUpgrade()` so it routes to Casper 2.0's
>    install lane. A plain session transaction is refused with
>    `ApiError::NotAllowedToAddContractVersion [48]`.
>
> `contracts/tool-registry/build.sh` encodes all three and fails loudly if the
> output is not MVP-clean.

### 2.4 Network

```
chain name        casper-test
CAIP-2 id         casper:casper-test
JSON-RPC          https://node.testnet.casper.network/rpc     (public, no auth)
explorer          https://testnet.cspr.live
faucet            https://testnet.cspr.live/tools/faucet
protocol          2.2.2   (verified live)
```

**Hosted x402 facilitator** (we don't use it): `https://x402-facilitator.cspr.cloud`.
Its free testnet tier is capped at **25 calls/day** (~12 payments), so we self-host
with our own facilitator key and the public RPC. No API key required.

### 2.5 Gas budgets

| Operation | Declared | Set by |
|---|---|---|
| Settlement (`transfer_with_authorization`) | **7 CSPR** | `FACILITATOR_GAS_MOTES` |
| Wrap session (184 KB proxy_caller wasm) | **20 CSPR** | `WRAP_GAS_MOTES` |
| WCSPR transfer | 3 CSPR | script default |
| Native CSPR transfer | **exactly 0.1 CSPR** | protocol |

> ⚠️ **Overpaying burns funds.** Casper runs `payment_limited` pricing: the
> declared amount is debited in full, and only **75% of the unused remainder**
> is refunded; the other 25% is burned. A measured example: a call consuming
> 0.39 CSPR cost its sender 0.92 CSPR because it budgeted 2.5.
>
> Our defaults are deliberately safe rather than tight. After the first
> successful run, compare *gas consumed* vs *cost paid* on the explorer and
> lower these in `.env`.

This table has no Algorand counterpart: there is no gas budget to declare there,
and the buyer pays no fee to overpay.

### 2.6 Environment

The Casper block in `apps/web/.env.example` is commented out by default. Set
`CHAIN=casper` and `NEXT_PUBLIC_CHAIN=casper` to select this path, then
`CSPR_NETWORK`, `CSPR_NODE_RPC`, `WCSPR_PACKAGE_HASH`, `WCSPR_BALANCES_UREF`,
the three `*_KEY_PEM` paths, and the gas budgets above.

---

## 3. Local services

| Service | Port | Notes |
|---|---|---|
| Web app | **8402** | `pnpm dev` |
| Seller tools | 8403 | reserved |
| Facilitator | 8404 | reserved; unused on Algorand, where the facilitator is hosted |
| Postgres | **5404** | `pnpm db:up` (optional) |
| Redis | **6404** | `pnpm db:up`; the settlement ledger, unset means in-memory |

Ports are deliberately unusual to avoid clashing with sibling projects.

---

## 4. Where the config lives

| File | Purpose |
|---|---|
| `apps/web/.env` | what Next.js and the `algo:*` / `casper:*` scripts actually load |
| `apps/web/.env.example` | committed template, Algorand first |
| `.env.example` (repo root) | a pointer to the file above; nothing reads it but docker-compose |
| `apps/web/keys/*.pem` | **Casper private keys: gitignored, never commit** |

Algorand has no key files. Its secrets are the two `*_MNEMONIC` values in
`apps/web/.env`, and they must never be committed either.

See the [Algorand runbook](./ALGORAND.md) for the default setup, or the
[Casper runbook](./TESTNET.md) for the alternate one.
