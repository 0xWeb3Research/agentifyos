import { expect, test } from "@playwright/test";

// Resilient smoke suite. Assertions target intended behavior via roles / text /
// stable route hrefs (never brittle css classes), so they stay correct while
// sibling pages are still being built in parallel.

test.describe("home", () => {
  test("shows the hero pitch and a grid of tool cards", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText(/AI agents shop for tools/i)).toBeVisible();

    // Tool cards link to individual detail pages (/tools/<slug>), never the
    // catalog root (/tools). Expect at least 6.
    const toolLinks = page.locator('a[href^="/tools/"]');
    await expect(async () => {
      expect(await toolLinks.count()).toBeGreaterThanOrEqual(6);
    }).toPass();
  });
});

test.describe("catalog", () => {
  test("lists tools and narrows results when searching", async ({ page }) => {
    await page.goto("/tools");

    const cards = page.locator('a[href^="/tools/"]');
    await expect(async () => {
      expect(await cards.count()).toBeGreaterThanOrEqual(6);
    }).toPass();
    const before = await cards.count();

    const search = page
      .getByRole("searchbox")
      .or(page.getByPlaceholder(/search/i))
      .first();
    await search.fill("algo");

    // Filtering (client- or server-side) should reduce the visible results.
    await expect(async () => {
      expect(await cards.count()).toBeLessThan(before);
    }).toPass();

    // …and at least one ALGO-related card must remain.
    await expect(
      page.locator('a[href^="/tools/"]').filter({ hasText: /algo/i }).first(),
    ).toBeVisible();
  });
});

test.describe("detail", () => {
  test("shows the tool name, price, and an integration section", async ({
    page,
  }) => {
    await page.goto("/tools/algo-market-data");

    await expect(page.getByText(/ALGO Market Data/i).first()).toBeVisible();
    await expect(page.getByText(/\$0\.00/).first()).toBeVisible();
    await expect(page.getByText(/Integrate|curl/i).first()).toBeVisible();
  });
});

// Both settlement chains publish a transaction under their own explorer, and the
// suite must pass whichever one is configured.
const EXPLORER_LINK = 'a[href*="lora.algokit.io"], a[href*="cspr.live"]';

test.describe("agent", () => {
  test("runs the real x402 payment path end to end", async ({ page }) => {
    // Real mode talks to a live facilitator, so this is slower than the page
    // tests and needs headroom when the suite runs against a dev server.
    test.setTimeout(120_000);
    await page.goto("/agent");

    // The button can paint before React hydrates, so a single click may land on
    // an inert element. Retry until the run actually starts (skip re-clicking
    // once it's underway: the button disables itself while running).
    const runBtn = page.getByRole("button", { name: /run agent|running/i }).first();
    // Algorand signs a transaction group; Casper signs an EIP-712 authorization.
    // Either way the agent must genuinely sign something before anything settles.
    const signed = page.getByText(/signed a \d+-transaction group|signed EIP-712|PAYMENT-SIGNATURE/i).first();
    await expect(async () => {
      if (await runBtn.isEnabled()) await runBtn.click();
      await expect(signed).toBeVisible({ timeout: 7000 });
    }).toPass({ timeout: 90000 });

    // Then one of two truthful outcomes:
    //  • funded    → a settlement receipt linking to the chain's explorer
    //  • unfunded  → the rejection, surfaced verbatim rather than swallowed
    //
    // The rejection wording comes from the chain, not from us: Algorand's
    // simulator says "underflow" for an empty balance and "asset … missing" for
    // a skipped opt-in, and Casper reports an unfunded facilitator. Matching the
    // shape of a rejection rather than one chain's phrasing keeps this test
    // honest without making it brittle.
    const settled = page.locator(EXPLORER_LINK).first();
    const rejected = page
      .getByText(
        /payment rejected|settlement failed|simulation failed|underflow|insufficient|missing from|unfunded|fund .*faucet|opted in|not configured/i,
      )
      .first();
    await expect(settled.or(rejected)).toBeVisible({ timeout: 60000 });

    // A price is always shown for the attempted call.
    await expect(page.getByText(/\$/).first()).toBeVisible();
  });
});

test.describe("dashboard", () => {
  test("shows an earnings figure and a live settlement feed", async ({
    page,
  }) => {
    await page.goto("/dashboard");

    // In real mode the dashboard shows only payments that actually settled, so
    // an instance that has not sold anything yet is legitimately empty. Both
    // states are correct; a test that demanded earnings would be demanding the
    // page invent them.
    const earnings = page.getByText(/\$/).first();
    const empty = page.getByText(/nothing has been paid for yet|no settlements yet/i).first();
    await expect(earnings.or(empty)).toBeVisible();

    // When there is a feed, a row carries an explorer link, a relative
    // timestamp, or an explicit "settled" status.
    const feedRow = page
      .locator(EXPLORER_LINK)
      .or(page.getByText(/\bago\b/i))
      .or(page.getByText(/settled/i))
      .or(empty)
      .first();
    await expect(feedRow).toBeVisible();
  });
});
