# agentifyos

## What this codebase does

Marketplace where AI agents discover and pay-per-call for tools using x402
(HTTP 402) payments settled on the Casper blockchain (testnet). pnpm monorepo,
single app `apps/web`: Next.js 16 App Router + React 19 + TypeScript. Ledger is
Redis (`REDIS_URL`) or in-process arrays; Prisma/Postgres exists in the schema
but is not imported at runtime. Payments use `casper-js-sdk`,
`@make-software/casper-x402`, EIP-712-style `transfer_with_authorization` on a
WCSPR CEP-18 contract. Zod validates most inputs.

## Auth shape

- **SIWX wallet session** (`src/lib/auth/siwx.ts`): `createChallenge`/
  `consumeNonce` (in-memory, single-use, 5-min TTL), `verifySignedMessage`,
  `issueSession`/`readSession` — HMAC-SHA256(`AUTH_SECRET`) cookie
  `agentifyos_session`. Only the `api/auth/*` routes touch it.
- **x402 payment auth** for paid calls: `PAYMENT-SIGNATURE` header (base64
  JSON EIP-712 authorization) verified by `verifyPayment` in
  `src/lib/x402/casper.ts` (real mode) or `MockFacilitator.verify` in
  `src/lib/x402/facilitator.ts` (mock mode).
- The wallet session gates NOTHING outside `api/auth/*` — `agent/run`, `mcp`,
  `settlements`, `discovery` do not check it. Flag routes that spend money or
  mutate state without either scheme.

## Threat model

Highest impact: draining the facilitator or agent wallets — `api/agent/run`
and `api/mcp` `call_tool` accept unauthenticated POSTs and in real mode sign
real payments with `keys/agent.pem` (bounded only by client-supplied
`budgetUsd`). Second: forging/replaying x402 authorizations to get paid tool
output without settlement — the mock facilitator has an in-process
`(nonce, resource)` replay guard, but the real `settleOnChain` path relies
solely on the on-chain contract nonce. Third: session forgery via the
`AUTH_SECRET` dev-default fallback.

## Project-specific patterns to flag

- Routes that call `executePaidCall`, `settleOnChain`, or `loadRoleWallet`
  without any auth or rate limit (e.g. `api/agent/run`, `api/mcp`).
- Payment verification steps skipped or reordered in `api/t/[slug]/route.ts`
  (advertise → verify → settle → run handler → receipt is the intended order;
  handler output must not be returned when settlement fails).
- Trusting client-supplied economics: `budgetUsd`, price, `payTo`, or asset
  taken from the request instead of server config (`src/lib/config.ts`).
- Nonce/replay handling differences between `MockFacilitator` and the real
  `verifyPayment`/`settleOnChain` path.
- Key loading via `loadWalletFromFile`/`*_KEY_PEM_CONTENT` leaking into logs,
  errors, or responses.

## Known false-positives

- `src/components/json-ld.tsx` `dangerouslySetInnerHTML` — JSON.stringify with
  `<` → `<` escaping, standard safe JSON-LD.
- `scripts/debug-settle.mjs` `spawnSync` — local debug script, not reachable
  from the request path.
- Tool handlers in `src/lib/tools/handlers.ts` are deterministic mocks;
  `pageScraper` never fetches the target URL, so SSRF hits there are inert.
- `api/discovery/*` and `api/settlements` are intended-public read-only feeds.
- `keys/*.pem` and `.env` files exist locally but are gitignored and untracked;
  hardcoded values in `src/lib/config.ts` are public keys/account hashes, not
  secrets.
