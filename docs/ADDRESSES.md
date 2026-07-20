# Addresses & on-chain reference

Every account, contract, and endpoint AgentifyOS touches. **Casper testnet only;
nothing here touches mainnet.** All values below are public and safe to share;
private keys live only as PEM files in `apps/web/keys/` (gitignored).

Generated 2026-07-19 via `pnpm casper:keygen`.

---

## 1. The three demo accounts

| Role | What it does | Needs |
|---|---|---|
| **Facilitator** | Submits every settlement on-chain and **pays the gas** | ~2,000 CSPR |
| **Treasury** | Wraps CSPR → WCSPR, then funds agents with WCSPR | ~2,000 CSPR |
| **Agent** | The buyer: signs x402 payments | **WCSPR only, no CSPR** |

> The agent holding **zero CSPR** is the entire point of x402: it signs payment
> authorizations off-chain and the facilitator pays the transaction fee. An
> agent never needs the native coin.

### Facilitator · *pays gas*
```
public key    01e3d2d1883d8c63bb4b6e0df05ea9c2f42c6a483c704cfcd8a727e2e4373252ae
account hash  e0c57785b93365efc81063aabdcec6056d6f1523da33acdb5c2001620aad8796
key file      apps/web/keys/facilitator.pem
explorer      https://testnet.cspr.live/account/01e3d2d1883d8c63bb4b6e0df05ea9c2f42c6a483c704cfcd8a727e2e4373252ae
```

### Treasury · *wraps and distributes WCSPR*
```
public key    014ea619c544f11f034674ccccb44c8758c354f674af2bf3138514a501539706ab
account hash  4ee08c54de78389c1466980260051c44f6dc367391ae37dc3f473896dbbeb666
key file      apps/web/keys/treasury.pem
explorer      https://testnet.cspr.live/account/014ea619c544f11f034674ccccb44c8758c354f674af2bf3138514a501539706ab
```

### Agent · *the buyer*
```
public key    01e565e859f9bab3f7cb1eb666ffa7aa12879e27639f7c000a079e859edbbfde0c
account hash  41611f2c0902ede544b2a61e557b47b5ca5b313a03bbaa45765eb80075ca9e1e
key file      apps/web/keys/agent.pem
explorer      https://testnet.cspr.live/account/01e565e859f9bab3f7cb1eb666ffa7aa12879e27639f7c000a079e859edbbfde0c
```

All three are **Ed25519** (the `01` prefix; `02` would be secp256k1).

### Funding source

Testnet CSPR comes from the [faucet](https://testnet.cspr.live/tools/faucet)
(**once per account, for life**; repeats fail with `User error: 1`), claimed
into a Casper Wallet account and then forwarded to the two accounts above.

> Minimum transfer to bring an account into existence: **2.5 CSPR**
> (`native_transfer_minimum_motes`). A smaller send won't create the account.
> Each transfer costs a flat **0.1 CSPR** fee.

Check status any time:

```bash
cd apps/web && pnpm casper:balance
```

---

## 2. The WCSPR contract

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

### Entry points we call (verified on-chain)

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

---

## 2b. Our own contract · the ToolRegistry

Written by us and deployed to testnet. It anchors a hash of each listing's
manifest on-chain so a later silent edit to a price or payout address is
detectable.

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

---

## 3. Network

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

---

## 4. Gas budgets

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

---

## 5. Local services

| Service | Port | Notes |
|---|---|---|
| Web app | **8402** | `pnpm dev` |
| Seller tools | 8403 | reserved |
| Facilitator | 8404 | reserved (currently in-process) |
| Postgres | **5404** | `pnpm db:up` (optional) |

Ports are deliberately unusual to avoid clashing with sibling projects.

---

## 6. Where the config lives

| File | Purpose |
|---|---|
| `.env` (repo root) | canonical reference copy |
| `apps/web/.env` | what Next.js and the `casper:*` scripts actually load |
| `apps/web/.env.example` | committed template |
| `apps/web/keys/*.pem` | **private keys: gitignored, never commit** |

See **[TESTNET.md](./TESTNET.md)** for the step-by-step funding and settlement runbook.
