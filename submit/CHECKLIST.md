# Launch checklist

Due **19 August 2026**. Ordered by what an evaluator will actually experience,
because that is what has to work.

***

## 1. They open the prototype link

- [x] **Deployed.** <https://agentifyos.xyz> serves the Algorand build. Host env:
      `CHAIN=algorand`, `MODE=real`, `ALGO_TREASURY_MNEMONIC`,
      `ALGO_AGENT_MNEMONIC`, `ALGO_TREASURY_ADDRESS`, `ALGO_AGENT_ADDRESS`,
      `NEXT_PUBLIC_CHAIN`, `NEXT_PUBLIC_ALGO_TREASURY_ADDRESS`,
      `NEXT_PUBLIC_ALGO_AGENT_ADDRESS`, `AUTH_SECRET`,
      `ALLOW_UNAUTH_SPEND=1`, `DEMO_DAILY_USD_CAP=2`
- [x] The deployed endpoint quotes Algorand, and the old Casper slug 404s:
      `curl -i https://agentifyos.xyz/api/t/algo-market-data`
- [x] **Production settles real payments.** Two on-chain, thousands of rounds
      apart, in `docs/PROOF.md` under "Settled against production"
- [ ] **Confirm the deployed agent demo returns 200.** It answered 500 until the
      fix in `22b9842`: the runner derived its own address from `req.url`, which
      behind the proxy is the internal bind address. A production build with that
      fix returns 200 locally; re-check the deployment once it has rebuilt.
      This is the one button a judge is most likely to press
- [x] `next build` clean, every page 200 on both chains
- [x] The public demo works without a wallet: `ALLOW_UNAUTH_SPEND=1` under a
      daily cap, because there is no Algorand sign-in yet and a 401 would be a
      dead end

**Why this matters most:** everything else in this folder describes the product.
This is the product.

## 2. They click "run agent" and watch it buy

- [x] The agent plans a task, picks four listings, pays for each, and stops on
      budget
- [x] Every payment shows on the wire: the 402, the signature, the settlement,
      the receipt
- [x] Receipts link to Lora, and the link resolves
- [x] Six settlements already on chain as a fallback if the live run fails

## 3. They check the money was real

- [x] Six settlements on Algorand testnet, listed in `docs/PROOF.md`
- [x] Transaction 1 documented straight from the public indexer: `axfer`, 2000
      micro of ASA 10458941, **fee 0**, in a two-transaction group with
      GoPlausible's fee sponsor
- [x] Balances recorded before and after: buyer's USDC 20.0000 → 19.9590, buyer's
      ALGO unchanged at 3.9990
- [x] No claim we cannot back: the facilitator's receipt endpoint is mainnet-only,
      so `facilitatorReceiptUrl` is null on testnet rather than a link that errors
- [ ] Confirm the listing appears at
      <https://facilitator.goplausible.xyz/discovery/resources>. It lists on the
      first payment against a publicly reachable URL, so this follows the deploy

## 4. They read the code

- [x] `@x402-avm/core`, `/avm`, `/fetch`, `/extensions` at 2.6.1, all imported
      and on an executed path
- [x] `@x402/core`, `@x402/fetch` and `@make-software/casper-x402` removed, since
      nothing imported them
- [x] Verify and settle go through `facilitator.goplausible.xyz` and nowhere else
- [x] `pnpm selftest` 9/9, `npx tsc --noEmit` clean, Playwright 5/5
- [x] `docs/ALGORAND.md` takes a clean clone to a settled payment in ten minutes
- [x] Four commits pushed to `main` at `github.com/0xWeb3Research/agentifyos`

## 5. They read the deck and the notes

- [x] `deck.pdf`, 12 slides, product-led, 0.34 MB
- [x] [EVALUATOR-NOTES.md](./EVALUATOR-NOTES.md) answers the brief's five checks
      with file pointers
- [x] [DEMO-SCRIPT.md](./DEMO-SCRIPT.md) for the mentoring round, with the likely
      questions answered honestly
- [ ] Fill the four blanks in [FORM-ANSWERS.md](./FORM-ANSWERS.md): full name,
      contact number, team name, confirm the email
- [ ] Submit the form

***

## Known weak spots, stated rather than hidden

| What | Where it is admitted | Fix |
|---|---|---|
| ~~The demo video is the old Casper recording and shows cspr.live~~ | fixed: there is now a film per chain, and the landing page serves the one matching the visitor's chain | done |
| No wallet checkout, so the demo pays from a server-held account | deck slide 12, PRODUCT.md roadmap | Pera and Defly, `src/components/wallet-connect.tsx` |
| The 80/20 split is modelled, not settled on-chain | deck slide 10, PRODUCT.md | per-seller payouts, `resolvePayTo()` in `src/lib/config.ts` |
| Tool handlers are deterministic first-party implementations | DEMO-SCRIPT.md, in the answers | third-party listings proxy to their own origin; the manifest already carries the field |
| Not yet in the public Bazaar | `docs/PROOF.md` | follows automatically from a payment against the deployed domain |

Every one of these is already written down somewhere an evaluator will look.
That is deliberate: a reviewer who finds an unstated gap discounts everything
else, and one who finds it already acknowledged does not.

***

## Worth doing if there is time

- [x] Re-shoot the demo video against the Algorand build. Done: `video/` renders
      one film per chain from the same source, both are in the bucket, and
      `/api/demo-video` picks by the visitor's chain.
- [ ] Wallet checkout with Pera or Defly, so an evaluator can pay from their own
      wallet. The client-side pattern is the same `ExactAvmScheme(walletSigner)`
      the app already uses
- [ ] A short screen recording of `pnpm algo:demo` followed by the Lora page
      loading. Lora is a client-rendered app, so a recording is the only way to
      show a working link inside a PDF
