# Changelog

All notable changes to AgentifyOS. Format follows [Keep a Changelog](https://keepachangelog.com/);
this project uses [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### Shipped since 0.1.0 · LIVE ON TESTNET
- Accounts funded (2,000 CSPR each to facilitator + treasury).
- **Wrapped 100 CSPR → WCSPR** via Odra's proxy-caller session transaction.
- **First real x402 settlement on Casper testnet**, then a full four-tool agent run, all verifiable on testnet.cspr.live. See [docs/PROOF.md](docs/PROOF.md).
- `MODE=real` wired end to end: the `/agent` page now produces real on-chain settlements.
- **Fixed:** `casper-js-sdk`'s HTTP layer throws a spurious `413 Payload Too Large` inside the Next.js runtime (a ~1.6 KB body). All RPC now goes through raw `fetch`: submit, await, and balance reads.
- **Tuned gas from measurement:** settlements consume 2.708 CSPR, so the declared budget dropped 7 → 4 CSPR (43% less charged, and into the cheaper `wasm small` lane).
- Agent identity in the UI now reports the real signing key rather than the in-process demo wallet.

### Added · interactive diagrams, CLI and MCP
- **`/explain`**: three interactive React Flow diagrams (the payment handshake, where the money comes from, what talks to what), themed to the design system via `--xy-*` variables and fully static (no editor affordances).
- **`agentify` CLI** (`pnpm agentify`): a genuine x402 client holding its own Casper key: `tools`, `search`, `call`, `balance`, `receipts`. A `call` performs the real 402 → sign → retry handshake and prints the on-chain receipt.
- **MCP server** (`pnpm mcp`, stdio): lets Claude Desktop / Claude Code / Cursor discover and **pay for** tools. Exposes `search_tools`, `get_tool`, `call_tool`, `get_balance`, `list_settlements`. Read-only tools are annotated `readOnlyHint` so hosts can auto-approve them; **`call_tool` is marked destructive** so spending always prompts. Streams progress during the ~15s settlement and honours cancellation.
- **`/api/t/[slug]` now settles for real**: external clients can pay over HTTP, which is what makes the CLI and MCP genuine third-party consumers rather than privileged internals.
- `src/lib/x402/client.ts`: the reusable x402 HTTP client (402 → sign → retry) shared by both.
- **Normie-friendly README** with Mermaid diagrams, plus `docs/CLI-AND-MCP.md`.

### Fixed
- `casper-js-sdk`'s HTTP layer 413s inside Next; **all** RPC (submit, await, balances) now uses raw `fetch`.
- Client-side authorization builder backdates `validAfter` by 600s (matching the server signer): Casper can execute a transaction in a block whose timestamp precedes submission, which made tight windows intermittently "not yet valid" on-chain.
- `/api/t/[slug]` now returns the failed `deployHash` in the 402 error body, so a reverted settlement can be diagnosed from the explorer instead of guessing.
- Diagram nodes were clipped because `fitView` was pinned to zoom 1 while content exceeded the container; containers now sized to content, and nodes carry `initialWidth`/`initialHeight` so SSR framing is correct.

### Pending
- Deploy to a public URL; record the demo video; submit the BUIDL.
- Optional: stream the agent run (SSE) so four-tool browser runs aren't bounded by request duration.

---

## [0.1.0] · 2026-07-19

Initial build: a two-sided marketplace where autonomous AI agents discover and pay
for tools via x402 on Casper, plus a verified real-testnet payment stack.

### Added · marketplace (web)
- **Landing page** with an x402 wire-log hero, auto-scrolling tool marquee, and featured catalog.
- **Catalog** (`/tools`): 14 seeded tools, live client-side search + category/price filters.
- **Tool detail** (`/tools/[slug]`): inline mono stats, input/output schema explorer, pricing + publisher cards, copy-paste MCP config and curl snippets, related tools.
- **Agent runner** (`/agent`), the centerpiece. Give an agent a task and watch it discover tools, sign payments, and settle, with a live streaming wire-log, per-step receipts, and a draining budget meter.
- **Publish flow** (`/publish`): manifest form with a live listing preview and generated JSON manifest.
- **Publisher dashboard** (`/dashboard`): earnings, 80/20 split, per-tool stats, and a polling live settlement feed.
- **Roadmap** (`/roadmap`): Now / Next / Later launch plan.

### Added · agent-facing API
- `GET /api/t/[slug]`: genuine HTTP **402** paid endpoint (402 challenge → verify → settle → result + receipt), with `PAYMENT-REQUIRED` / `PAYMENT-SIGNATURE` / `PAYMENT-RESPONSE` headers and `Cache-Control: no-store, private`.
- `GET /api/discovery/resources` and `/api/discovery/search`: machine-readable catalog + filtered search.
- `POST /api/mcp`: MCP-style `search_tools` / `get_tool` / `call_tool` (call_tool pays and returns a receipt).
- `POST /api/agent/run`: server-side agent loop (plan → pay → complete) with budget metering.
- `GET /llms.txt`: agent-discovery manifest.
- `GET /api/settlements`: live settlement ledger.

### Added · real Casper testnet integration (no mocks)
- `src/lib/x402/casper.ts`, the real engine:
  - **EIP-712 `TransferWithAuthorization` signing** via `@casper-ecosystem/casper-eip-712` + real Ed25519 keys.
  - **Off-chain verification** mirroring the reference facilitator (pay-to, amount, validity window, public-key→account-hash match, signature).
  - **On-chain settlement**: `transfer_with_authorization` via `ContractCallBuilder`, submitted and gas-paid by the facilitator.
  - **CSPR→WCSPR wrapping** through Odra's `proxy_caller` **session** wasm (Casper 2.0 has no attached-value primitive for contract calls, so a plain contract call would mint 0).
  - **CEP-18 transfer**, **native CSPR balance**, and **WCSPR balance** via the `balances` dictionary.
- Ops CLI: `casper:keygen`, `casper:balance`, `casper:signtest`, `casper:wrap` (with `--dry-run`), `casper:transfer`, `casper:pay`.
- Bundled Odra `proxy_caller_with_return.wasm` (184,758 bytes).

### Added · design system
- Refined-light, editorial system inspired by [designsystems.surf](https://designsystems.surf), re-typeset in **Geist** and retimed to **Emil Kowalski's** motion rules (sub-300ms, custom easing, `scale(0.97)` press, staggered reveals, `prefers-reduced-motion`).
- **Geist Mono as the identity carrier**: every price, count, hash, latency, and wallet address renders in mono.
- Reusable primitives: `Container`, `Button`, `Chip`, `CapabilityChip`, `StatusPill`, `LogoTile`, `Arrow`, `Eyebrow`, `ToolCard`, `WireLog`, `CodeBlock`, `Marquee`, `LiveFeed`.

### Added · infrastructure & docs
- pnpm monorepo; Next.js 16 + React 19 + Tailwind v4 + Zustand + TypeScript 5.7.
- Docker Compose Postgres (port **5404**) + Prisma schema and seed for the persistence path.
- Weird ports to avoid collisions: web **8402**, tools **8403**, facilitator **8404**, db **5404**.
- `docs/HOW-IT-WORKS.md`: architecture, the smart contract's role, the payment flow, wallets.
- `docs/TESTNET.md`: zero-to-real-settlement runbook.
- `README.md`, this changelog, and `apps/web/CONTRACTS.md` (build contracts used to coordinate parallel agents).

### Added · tests
- `pnpm selftest`: offline payment-loop proof (deterministic wallet, valid signature, tamper detection, full paid call, **replay guard**, amount mismatch): **6/6**.
- `pnpm casper:signtest`: offline proof of the **real** EIP-712 path with real Casper keys.
- `pnpm test:e2e`: Playwright smoke suite across home, catalog, detail, agent, dashboard: **5/5**.

### Verified against live Casper testnet
- `transfer_with_authorization`, `transfer`, and `balance_of` entry points confirmed on-chain (arg names + CLTypes match the implementation exactly).
- WCSPR package `3d80df21…4847c1e` active version **7**; 1:1 CSPR backing confirmed via total-supply vs. locked purse.
- CSPR and WCSPR balance reads working against the public node; unfunded accounts correctly reported as 0.
- Wrap session transaction builds and signs correctly (dry-run verified).

### Fixed
- Duplicate React keys in the settlement feed: seed IDs collided because the PRNG was seeded from a char-code **sum** (order-insensitive); replaced with FNV-1a plus an index prefix.
- `verifySignature` **throws** on an invalid signature rather than returning `false`. All verification paths now treat a throw as invalid.
- `PrivateKey.fromPem` / `generate` are **synchronous** in casper-js-sdk 5.x, not promise-returning.

### Notes / gotchas captured
- Casper's public **testnet** is the target (there is no separate "devnet"); a local NCTL node is the offline option.
- Agents need **no CSPR**: the facilitator pays gas; agents hold only WCSPR and sign off-chain.
- The hosted facilitator's free testnet quota is **25 calls/day** (~12 payments), so we self-host.
- Faucet is **once per account, lifetime** (repeats fail with `User error: 1`) and requires a Casper Wallet sign-in. There is no API.
- **Fees are not "fixed".** Mainnet runs `pricing_handling = payment_limited`; determinism comes from a flat 1 mote/gas with the multiplier **pinned at 1** (no auction). Native transfers *are* exactly 0.1 CSPR; general contract calls are not.
- **Overpaying gas destroys funds:** the declared payment is debited in full, only **75% of the unused remainder** is refunded, and the rest is **burned**. Measured example: a call consuming 0.39 CSPR cost its sender 0.92 CSPR.
- Block time is a **minimum** (`minimum_block_time` 8000 ms), not a maximum. Measured 8.001 s flat on both networks. There is no `maximum_block_time`.
- An account **does not exist until funded**; `native_transfer_minimum_motes` is **2.5 CSPR**. Querying an unfunded account errors (`-32026 Purse not found`) rather than returning zero.
- **AddressableEntity and VM 2.0 are shipped but disabled** on mainnet/testnet (`enable_addressable_entity = false`). Code against the account-hash model.
- CEP-18 keys its `balances` dictionary by **base64 of the raw key bytes** (not hashed), while `allowances` uses a blake2b hash; the two differ.
- Casper's "first WASM-native L1 with live x402" is a **self-asserted claim** on a paid newswire; Concordium (also WASM-native) announced x402 support in Dec 2025. Attribute it, don't assert it.
