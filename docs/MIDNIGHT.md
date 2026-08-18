# Nightpass on Midnight

**Shielded entitlement for autonomous agent tool calls.**

An agent proves in zero knowledge that it holds a paid pass for a tool. It never
reveals which agent it is, what else it holds, or how far through its quota it
is. The half a market genuinely needs public, that a tool exists at a price and
has served N real calls, stays public and checkable by anyone.

***

## The gap this closes

AgentifyOS already lets an agent buy an API call without a human: x402 quotes a
price over HTTP, the agent signs, a facilitator settles. That solved the
checkout.

It also published the receipt. Every settlement lands on a public ledger, which
means the **sequence** of tools an agent buys is readable by anyone who cares to
look. For a real operator that sequence is not metadata, it is the strategy:

| Who | What the ledger gives away |
|---|---|
| A fund's research agent | Which data sources it reads, and in what order, minutes before it trades |
| A bank's compliance agent | Which checks it runs, and therefore which ones it does not |
| Any serious competitor | The shape of a rival's whole pipeline, for the cost of reading a block |

This is why serious agents still run on pre-provisioned enterprise API keys. Not
because payment is hard, but because **paying in public is a disclosure**. An
open market that leaks its buyers' intent cannot win the customers who most need
tooling.

Midnight is the right tool because the requirement is not "hide everything". It
is: keep the market auditable, keep the buyer private, and be able to lift that
privacy for one named auditor on demand. That is selective disclosure, and it is
what Compact is for.

***

## The split

The contract keeps two kinds of state, and the separation is the whole design.

**Public, deliberately.** A market nobody can audit is not a market.

- `tools` — the catalog: price, quota, and whether the listing is live
- `callsServed` — how many calls each tool has genuinely served
- `passesIssued` — how many passes exist in total
- `passCommitments` — every issued pass, as an opaque commitment
- `spentCalls` — one opaque nullifier per redeemed call
- `attestations` — audit tags, meaningless without a secret held off-chain

**Private, and provably absent from the record.**

- which agent holds which pass
- which agent made any given call
- whether two calls came from the same agent
- how much quota an agent has left
- which publisher operates which listing

***

## Why the nullifier is bound to the call index

This is the design decision that makes the system worth building.

A call's nullifier is:

```
nullifier = persistentHash("nightpass:call:", passCommitment, callIndex)
```

The `callIndex` is a **private** witness. Binding it into the hash means two
calls drawn from the *same* pass produce completely unrelated nullifiers.

Consider the alternatives:

| Design | What breaks |
|---|---|
| Publish the pass commitment on each call | Every call is trivially linkable to the buyer. Total failure. |
| Nullifier is `hash(commitment)` alone | The pass can only ever be spent once, and all calls share one identifier. |
| Nullifier is `hash(commitment, index)` | Each call is single-use, and no two calls are linkable. |

An observer sees a stream of unrelated 32-byte values and a per-tool counter
going up. It cannot tell whether ten calls were one agent spending a quota of
ten or ten agents spending one each. **The pattern, which is the thing actually
worth hiding, never forms.**

***

## What one redemption proves

`redeemCall` establishes four things at once and discloses exactly one value.

1. **A pass for this tool exists.** A Merkle path proves the commitment is in
   `passCommitments`, without revealing which leaf it is.
2. **The caller owns it.** The commitment is recomputed in-circuit from the
   agent's secret and pass nonce. A commitment scraped off the public ledger is
   worthless without them.
3. **The call is within the quota that was paid for.** The bound is public and
   enforced; the position within it stays private.
4. **This exact call has not been spent.** The nullifier is checked against
   `spentCalls` and then inserted.

The only thing written to the public record is the nullifier.

***

## Selective disclosure

Privacy that cannot be lifted is useless to a regulated operator, so
`attestUsage` exists.

An agent publishes a tag committing to *"under auditor A, I made N calls to tool
T"*, proving in ZK that it holds a valid pass. The public learns only that some
attestation exists.

An auditor handed the pass secret off-chain can then, with no special access:

1. recompute the pass commitment and confirm the tag is genuinely that agent's
2. re-derive `callNullifier(commitment, i)` for every `i < N`
3. check each one is present in `spentCalls`

The result is a **complete and exact** history. Exact because the absence of
call `N+1` is as checkable as the presence of the first `N`, so the agent cannot
under-report either. The circuit also refuses to attest to more calls than the
quota allows.

***

## An honest limitation: no per-call revocation

There is no way for a publisher to revoke a single pass mid-flight, and that is
a deliberate consequence rather than an oversight.

In Compact, `Set.member` **discloses its argument**. A revocation check inside
`redeemCall` would have to look up the pass commitment, which would publish that
commitment on every single call and destroy the unlinkability the whole design
exists to provide.

The options were: keep revocation and lose privacy, or keep privacy and handle
abuse another way. Nightpass keeps privacy. A publisher can still delist a tool
with `setToolActive`, which stops new passes being issued, and quotas bound the
damage any single pass can do. Epoch-scoped roots are the natural way to add
revocation later without leaking, and are not implemented here.

***

## Shielded publisher identity

A tool's publisher is stored as `persistentHash("nightpass:publisher:", secret)`,
never as a key. Only the holder of the secret can prove authorship in-circuit to
delist a tool, and nobody can tell which publisher operates which listings. The
test suite asserts both halves: an impostor is rejected, and the stored value is
not the key.

***

## Runbook

### Prerequisites

- Node 22+, Docker running, pnpm
- The Compact toolchain:
  ```bash
  curl --proto '=https' --tlsv1.2 -LsSf \
    https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh
  compact update
  ```
- `cp midnight/.env.example midnight/.env`

### Build and test

```bash
pnpm nightpass:compile   # compact 0.31.1 -> circuits, prover and verifier keys
pnpm nightpass:test      # the privacy properties, as adversarial tests
```

39 tests, written as things an attacker would try: replaying a call, forging a
pass, stealing a commitment, spending a pass bought for one tool on a dearer
one, spending past a quota, delisting someone else's tool, and overstating usage
to an auditor.

### The build is reproducible

The ZK keys were deleted and regenerated from source, and the resulting proofs
still verified against the verifier keys already committed on-chain by the
original deploy. So a reviewer who compiles this repo themselves gets a prover
that works against the deployed contract, rather than having to trust the
artifacts we happened to ship.

### Deploy to a real network

```bash
pnpm nightpass:proof     # local proof server on :6300, in Docker
pnpm nightpass:deploy    # deploys to Midnight preview
```

The first run generates a wallet, prints its unshielded address, and waits. Fund
it from the [Preview faucet](https://midnight-tmnight-preview.nethermind.dev/)
and the deploy continues on its own.

Two things are worth knowing, because both look like hangs:

- **The first sync takes 10 to 15 minutes.** The shielded and DUST wallets walk
  roughly 110,000 index entries on Preview. The CLI prints per-wallet percentages
  so progress is visible.
- **NIGHT does not pay fees; DUST does.** DUST is generated by NIGHT UTXOs only
  after they are explicitly registered for it, which the CLI does automatically.
  A funded wallet still cannot transact until that lands.

Use `--network preprod` for PreProd instead.

### Run the whole story

```bash
pnpm nightpass:demo      # publish, buy a pass, spend it, attest, verify
pnpm nightpass:state     # read the public ledger back off the indexer
```

`demo` finishes by re-deriving the attestation as an auditor would and checking
every claimed call against the chain, then prints what the public ledger reveals
so the two can be compared side by side.

***

## Proving happens locally, on purpose

The proof server runs in Docker on the agent's own machine and is never a hosted
service. Witness data, the secret and pass nonce, is what it consumes to build a
proof; sending that to someone else's server would hand away exactly what the
system is built to protect.

The practical consequence is that **reads and writes have different
requirements**. Reading the public ledger needs nothing but an HTTP request,
which is why the `/shielded` page renders live state on a deployed site with no
wallet stack. Writing needs a local proof server and a funded wallet, which is
why the demo is a CLI.

***

## Proof

Deployed and exercised on Midnight Preview. Nothing here is simulated: every
circuit below produced a real zero-knowledge proof and a transaction the network
verified.

| | |
|---|---|
| Contract | `a2658904b3df6b5751637f041b7c72ec5ed62172c19372149c8ec6f1d1a85707` |
| Deploy tx | `00cc663dd1a1e5ed8ded75342117608262fab11fdc70b627c37672a3c7b13505a6` |
| Deployed | 2026-08-17, block 463586 onward |

Three independent agent runs against it, blocks 463583 to 469466:

| | Circuit | Total on-chain |
|---|---|---|
| Tools listed | `registerTool` | 3 |
| Passes bought | `issuePass` | 3 |
| Calls spent | `redeemCall` | 9 |
| Attestations | `attestUsage` | 3 |

From the third run, one pass and its three calls, recorded while filming it:

```
commitment   a6df8d0236e6f4d4d04369f5974e9403c2737baff71a3582d0b7154de5285a9c
nullifier    83b04da03055a71a1ea7a34e0b397f8f5a155325173d96cd4d445ac31a72b63c
nullifier    f759d236c80950df7a0629349472ddc75063b3b5bd4de88e55728b0fe6489e49
nullifier    004e5054055974c58b409a21742bc7cf1061b99afbd3aef452d256d98818bca2
audit tag    8084f7554136d5defeac649ea052161e91d125ae9fa0abe6257c5519c3538068
```

Those three nullifiers came from **one** pass, issued in block 469450 and
attested in 469466. They share no derivable relationship, which is the
unlinkability claim made visible rather than asserted.

Every run ended with the auditor check: tag **matches**, every claimed call
**found on-chain**, and the claim **exact, not a lower bound**.

The whole run took **466 seconds**, nearly all of it proving. That is the honest
cost of doing this locally, and it is why the film replays the session from timed
stdout rather than showing eight minutes of a spinner.

### Two readings that look wrong and are not

**`served 9` against `quota 5`.** A quota is per pass, not per tool. Three passes
were bought and each spent three of its five calls, so the tool has served nine.
The suite asserts the per-pass bound directly: a sixth call on a single pass is
rejected with `quota exhausted`.

**The `/shielded` page trailing the CLI by one request.** The page revalidates on
a short window and serves stale-while-revalidate, so the first request after the
window expires returns the previous value and refreshes in the background. The
next request is current. The CLI reads the indexer directly and has no such
window, which is why the two can disagree for exactly one request.

### Verify it yourself

No wallet, no proof server, no permission. Read the contract straight off the
public indexer:

```bash
curl -s https://indexer.preview.midnight.network/api/v3/graphql \
  -H 'content-type: application/json' \
  -d '{"query":"query($a:HexEncoded!){contractAction(address:$a){state}}",
       "variables":{"a":"a2658904b3df6b5751637f041b7c72ec5ed62172c19372149c8ec6f1d1a85707"}}'
```

That returns the raw ledger state. To decode it into the table above:

```bash
pnpm nightpass:state
```

which at the time of writing reports 3 tools listed, 2 passes issued, 6 calls
redeemed and 2 attestations, and **no way to connect any of them to each other**.

Tool ids are `sha256(slug)`, so the catalog names are recoverable by anyone
without our help:

```
algo-market-data  ->  00c5601da864…
page-scraper      ->  2dd4764c8e83…
text-summarizer   ->  af478e84e7eb…
```

***

## A dependency trap worth knowing about

If a circuit call dies with `expected instance of StateValue`, there are two
copies of the runtime WASM loaded and an object built by one is failing
`instanceof` in the other.

`@midnight-ntwrk/compact-runtime@0.16.0` depends on
`@midnight-ntwrk/onchain-runtime-v3@^3.0.0`, which resolves to 3.1.0, while
`@midnight-ntwrk/midnight-js-protocol@4.1.1` pins exactly 3.0.0. The repo forces
one copy:

```json
"pnpm": { "overrides": { "@midnight-ntwrk/onchain-runtime-v3": "3.0.0" } }
```

The error surfaces only against a real network, because the in-process simulator
used by the tests never crosses the boundary between the two copies.

***

## Where the code is

| Path | What it is |
|---|---|
| `midnight/contract/src/nightpass.compact` | The contract. Five circuits, annotated. |
| `midnight/contract/src/witnesses.ts` | The private state and the witness implementations. |
| `midnight/contract/src/test/` | The privacy properties, as adversarial tests. |
| `midnight/cli/src/` | Headless deploy and demo. No browser wallet. |
| `apps/web/src/app/shielded/` | The live public-state page. |
| `apps/web/src/lib/nightpass.ts` | Reads and decodes contract state from the indexer. |
| `midnight/deployment.json` | The deployed address, per network. |

***

## Versions

| Piece | Version |
|---|---|
| Compact compiler | 0.31.1 |
| Compact language | 0.23.0 |
| Compact runtime | 0.16.0 |
| midnight-js | 4.1.1 |
| Proof server | 8.0.3 |
| Network | Midnight Preview |
