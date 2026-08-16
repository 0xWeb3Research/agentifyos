# Algorand runbook

Everything needed to take AgentifyOS from a fresh clone to a real x402 payment
settled on Algorand testnet, verifiable on [Lora](https://lora.algokit.io/testnet).

Algorand is the default chain. Casper is still supported and lives behind
`CHAIN=casper`; see [TESTNET](./TESTNET.md) for that path.

***

## What settles, and who pays for it

A paid call is an ordinary HTTP request that answers `402 Payment Required` with
a price. The buyer signs a USDC transfer for exactly that amount and retries. The
transfer is submitted by a facilitator, not by us and not by the buyer.

| Piece | What it is |
|---|---|
| Asset | USDC, ASA `10458941` on testnet, 6 decimals |
| Network | `algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=` (CAIP-2) |
| Scheme | `exact`, the AVM profile: a signed ASA transfer inside an atomic group |
| Facilitator | [GoPlausible](https://facilitator.goplausible.xyz), hosted, no key or signup |
| Fee | paid by the facilitator's sponsor account, not by the buyer |
| Explorer | [lora.algokit.io/testnet](https://lora.algokit.io/testnet) |

Because USDC is a dollar with six decimals, a listing priced at $0.005 quotes
exactly `5000` atomic units. There is no price oracle in the pricing path and
nothing is approximate.

### The atomic group

The buyer never broadcasts anything. `@x402-avm/avm` builds a two-transaction
group:

| Index | Transaction | Signed by | Fee |
|---|---|---|---|
| 0 | 0-ALGO payment, facilitator to itself | the facilitator | covers both |
| 1 | USDC asset transfer, buyer to seller | the buyer | 0 |

Both share one Algorand group id, so either both execute or neither does. The
buyer signs index 1 and hands the whole group back over HTTP in the
`PAYMENT-SIGNATURE` header. The facilitator signs index 0, simulates the group
against a node, and only then submits it.

That is why a buying agent spends **no ALGO on fees**. It does still need about
0.2 ALGO of Algorand's *locked minimum balance* (0.1 base, plus 0.1 for holding
one asset). That is a reserve, not a spend: it never moves, and it is the only
ALGO the agent will ever touch.

### Opt-in is not optional

Algorand will not credit an asset to an account that has not opted into it. Both
the buying agent and every receiving address must opt into ASA `10458941` once,
before any payment can work. A receiver that skipped this fails inside the
facilitator's simulate step with `asset 10458941 missing from <address>`, which
is the single most common way a first demo dies. `pnpm algo:optin` does it, and
`pnpm algo:preflight` checks it.

***

## Setup

### 1. Install and generate accounts

```bash
pnpm install
cd apps/web
cp .env.example .env
pnpm algo:keygen
```

`algo:keygen` prints two accounts and the exact lines to paste into
`apps/web/.env`. It writes nothing to disk: Algorand secrets are 25-word
mnemonics, which belong in the environment, and a hosted deploy has no
filesystem to ship a key file to.

| Role | What it does |
|---|---|
| `treasury` | receives every payment, and stocks the agent with USDC |
| `agent` | the buyer, signs the transfers |

There is no facilitator role. GoPlausible runs that, and its fee sponsor address
is discovered at runtime from `GET /supported`.

### 2. Fund both accounts with testnet ALGO

Both faucets need a browser; neither has an open API.

Go to **<https://lora.algokit.io/testnet/fund>** and dispense to each address.
0.3 ALGO each is plenty: 0.1 base minimum balance, 0.1 more once the account
holds USDC, and a fraction for the opt-in transaction itself. The dispenser hands
out considerably more than that, which is fine.

### 3. Opt both accounts into USDC

```bash
pnpm algo:optin
```

**This has to happen before the USDC faucet, not after.** Algorand will not
credit an asset to an account that has not opted into it, so a faucet send to an
account that skipped this step simply fails. Opt in first, then ask for USDC.

### 4. Get testnet USDC for the treasury

Go to **<https://faucet.circle.com>**, pick **Algorand** and **TestNet**, and
paste the treasury address. Circle sends 20 USDC.

The agent does not need USDC from the faucet; step 5 moves some across.

### 5. Stock the agent

```bash
pnpm algo:fund --usdc 1
pnpm algo:balance
```

### 6. Check everything before spending anything

```bash
pnpm algo:preflight
```

Each line is one thing that can be wrong, checked on its own, so a failure names
its own fix:

```
  ✓  CHAIN is algorand
  ✓  CAIP-2 network matches @x402-avm/avm  algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=
  ✓  USDC asset id matches @x402-avm/avm  ASA 10458941
  ✓  facilitator reachable and serving this network  https://facilitator.goplausible.xyz
  ✓  facilitator sponsors the fee  ZMFK2OI7ZBD2U27ISERZC4S6LKM6WMFJPZQ4MYNJDZ2VNBNMBA67RA22AA
  ✓  treasury key present
  ✓  treasury opted into USDC
  ✓  agent key present
  ✓  agent opted into USDC
  ✓  agent holds USDC to spend  1.0000 USDC
  ✓  ALGO_TREASURY_ADDRESS set (the payee every listing quotes)
  ✓  MODE=real
```

### 7. Make a real payment

```bash
pnpm dev            # in one terminal
pnpm algo:pay       # in another
```

`algo:pay` calls the public paid endpoint over HTTP with no privileged shortcut,
takes the 402, signs, retries, and prints the Lora link for the transaction that
settled. Point it anywhere with `--base https://agentifyos.xyz`.

***

## Seeing the 402 for yourself

```bash
curl -i http://localhost:8402/api/t/algo-market-data
```

```
HTTP/1.1 402 Payment Required
payment-required: eyJ4NDAyVmVyc2lvbiI6MiwiZXJyb3I...

{
  "x402Version": 2,
  "error": "payment_required",
  "resource": { "url": "…/api/t/algo-market-data", "mimeType": "application/json" },
  "accepts": [{
    "scheme": "exact",
    "network": "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=",
    "amount": "2000",
    "asset": "10458941",
    "payTo": "W7TYQROP7L6O6QEBVR675D4O3DT2DQUMSX4UIRYNYWV2W26MKSH5IN3ERY",
    "maxTimeoutSeconds": 120,
    "extra": { "decimals": 6, "feePayer": "ZMFK2OI7ZBD…" }
  }],
  "extensions": { "bazaar": { … } }
}
```

x402 v2 carries the challenge in the `PAYMENT-REQUIRED` header, base64 JSON. We
repeat it in the body so `curl` stays readable, but the header is what an SDK
client reads and the body is never authoritative.

`extra.feePayer` is the facilitator's sponsor, read from its `/supported`
response at startup. Its presence is what tells the client to build a group with
a fee payer rather than pay the fee itself.

***

## How the code is wired

Every protocol decision belongs to the SDK. We choose a price and a payee;
`@x402-avm` does the rest.

| File | Role |
|---|---|
| `src/lib/chain.ts` | which chain is active, and everything derived from it |
| `src/lib/x402/algorand.ts` | the resource server, the facilitator client, account helpers |
| `src/lib/x402/algorand-route.ts` | the seller half: quote, verify, settle, deliver |
| `src/lib/x402/algorand-client.ts` | the buyer half: 402, sign, retry, read the receipt |
| `src/lib/x402/algorand-loop.ts` | the agent runner, paying over real HTTP |
| `src/lib/x402/settlement.ts` | the ledger row and receipt both chains produce |

Seller side, from `algorand.ts`:

```ts
const facilitator = new HTTPFacilitatorClient({ url: "https://facilitator.goplausible.xyz" });
const server = new x402ResourceServer(facilitator)
  .register(ALGORAND_TESTNET_CAIP2, new ExactAvmScheme())
  .registerExtension(bazaarResourceServerExtension);
await server.initialize();   // fetches /supported, which is where feePayer comes from
```

`initialize()` is not optional. Requirements built before it runs would omit
`extra.feePayer`, the client would then build a group with no fee payer, and a
buyer holding no spendable ALGO would fail for a reason that looks like anything
but the real one.

Buyer side, from `algorand-client.ts`:

```ts
const signer = toClientAvmSigner(account.privateKeyBase64);
const core = new x402Client().register(ALGORAND_TESTNET_CAIP2, new ExactAvmScheme(signer));
const http = new x402HTTPClient(core);

const challenge = http.getPaymentRequiredResponse((n) => res.headers.get(n), body);
const payload = await http.createPaymentPayload(challenge);   // builds and signs the group
const headers = http.encodePaymentSignatureHeader(payload);   // { "PAYMENT-SIGNATURE": "<base64>" }
```

The handshake is driven a step at a time only so the demo can show what happened
on the wire. The signing, the group construction, and the encoding are all the
SDK's.

If you do not need to watch it, the whole integration is three lines:

```ts
import { paymentEnabledFetch } from "@/lib/x402/algorand-client";

const pay = paymentEnabledFetch(loadRoleAccount("agent"));
const res = await pay("https://agentifyos.xyz/api/t/algo-market-data");
```

`paymentEnabledFetch` is `wrapFetchWithPayment` from `@x402-avm/fetch` over the
same client. `pnpm algo:pay --wrapped` runs a real payment through that path.

### Packages

```
@x402-avm/core        transport-agnostic resource server, client, header codecs
@x402-avm/avm         the AVM exact scheme, network constants, signers
@x402-avm/fetch       the client wrapper
@x402-avm/extensions  the Bazaar discovery extension
algosdk               account generation, balances, ASA opt-in, funding transfers
```

`algosdk` is not used for the payment itself. The SDK builds and signs the
payment group; algosdk only covers the operator-facing work the protocol has no
opinion about.

***

## Discovery: the Bazaar

Registering `bazaarResourceServerExtension` attaches a machine-readable call
signature to every 402. The buyer echoes it back with the payment, and the
facilitator catalogs the resource when the payment settles. Publishing to the
public registry is a side effect of being paid: there is nothing to register and
nothing to keep in sync.

Once a listing has been paid for at least once it appears in
<https://facilitator.goplausible.xyz/discovery/resources>.

Our own feed carries the same information, chain-aware, at `/api/discovery/resources`.

***

## Verifying a payment

Three independent records, only one of which is ours:

| Source | URL |
|---|---|
| Algorand, via Lora | `https://lora.algokit.io/testnet/transaction/<txid>` |
| The facilitator | `https://facilitator.goplausible.xyz/api/receipt/<txid>` |
| Our ledger | `/dashboard`, or `GET /api/settlements` |

Every receipt the app returns carries `explorerUrl` and `facilitatorReceiptUrl`,
so a reader never has to take our ledger's word for anything.

***

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `asset 10458941 missing from <address>` | the payer or payee never opted in | `pnpm algo:optin` |
| `overspend` at simulate | the agent holds no USDC | `pnpm algo:fund --usdc 1` |
| `receiver_not_configured`, HTTP 503 | `ALGO_TREASURY_ADDRESS` is unset | set it in `.env` |
| `facilitator_unavailable`, HTTP 503 | facilitator unreachable at startup | check `X402_FACILITATOR_URL`, retry |
| `account not funded yet` in `algo:balance` | the address has never received anything | fund at the ALGO faucet |
| The 402 has no `extra.feePayer` | `initialize()` failed or the facilitator changed | `pnpm algo:preflight` |
| `requirements_mismatch` | the payment was minted for a different price or resource | re-fetch the 402 and sign again |

***

## Environment

```bash
CHAIN=algorand                     # the default; CHAIN=casper switches back
MODE=real                          # mock settles in-process and touches no chain

ALGO_TREASURY_MNEMONIC="…"         # 25 words, from pnpm algo:keygen
ALGO_TREASURY_ADDRESS=…            # the payee every listing quotes
ALGO_AGENT_MNEMONIC="…"
ALGO_AGENT_ADDRESS=…

X402_FACILITATOR_URL=https://facilitator.goplausible.xyz
ALGOD_TESTNET_URL=https://testnet-api.algonode.cloud
ALGO_USDC_ASSET_ID=10458941

NEXT_PUBLIC_CHAIN=algorand         # so the browser names the chain the server settles on
NEXT_PUBLIC_ALGO_TREASURY_ADDRESS=…
NEXT_PUBLIC_ALGO_AGENT_ADDRESS=…
```

***

## Switching to Casper, and what that touches

The nav has a chain picker. Choosing one writes the `agentifyos-chain` cookie;
`getChainId()` in `src/lib/chain-server.ts` reads it on every request, and
`ChainProvider` seeds the same value into the browser, so the server and the page
can never disagree about which chain is settling.

The switch is not cosmetic. On the same request it changes:

| What | Algorand | Casper |
|---|---|---|
| Quoted amount for a $0.002 call | `2000` microUSDC | `86580087` motes of WCSPR |
| CAIP-2 network in the 402 | `algorand:SGO1…` | `casper:casper-test` |
| Asset | ASA `10458941` | package `3d80df21…` |
| Payee | the treasury address | the publisher's account hash |
| Signer | `@x402-avm` exact scheme | EIP-712 over Ed25519 |
| Who broadcasts | GoPlausible | our own facilitator key |
| Receipt link | Lora | cspr.live |

```bash
curl -s -H 'Cookie: agentifyos-chain=casper' localhost:8402/api/t/algo-market-data
```

`CHAIN=algorand` in the environment is the default a visitor gets before they
choose anything. A chain this deployment holds no keys for is marked in the
picker, and its paid endpoint answers 503 naming what is missing rather than
failing at the first signature.

The three places that deliberately ignore the cookie are page metadata, the web
manifest, and the static OG images: they are generated without a request, so
they describe the deployment default and say so in `chain.ts`.

***

## A note on per-seller payouts

On Casper each seeded publisher has its own derived account, and nothing has to
exist on-chain for the demo to read one. On Algorand a receiving account must be
real and opted into USDC before it can be paid at all, so every listing currently
settles into the one treasury account we actually maintain. Splitting revenue to
per-seller accounts is a mainnet concern and needs each seller to opt in first;
`resolvePayTo()` in `src/lib/config.ts` is the single place that decision lives.
