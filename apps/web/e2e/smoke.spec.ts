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
    await search.fill("cspr");

    // Filtering (client- or server-side) should reduce the visible results.
    await expect(async () => {
      expect(await cards.count()).toBeLessThan(before);
    }).toPass();

    // …and at least one CSPR-related card must remain.
    await expect(
      page.locator('a[href^="/tools/"]').filter({ hasText: /cspr/i }).first(),
    ).toBeVisible();
  });
});

test.describe("detail", () => {
  test("shows the tool name, price, and an integration section", async ({
    page,
  }) => {
    await page.goto("/tools/cspr-market-data");

    await expect(page.getByText(/CSPR Market Data/i).first()).toBeVisible();
    await expect(page.getByText(/\$0\.00/).first()).toBeVisible();
    await expect(page.getByText(/Integrate|curl/i).first()).toBeVisible();
  });
});

test.describe("agent", () => {
  test("runs the real x402 payment path end to end", async ({ page }) => {
    // Real mode hits the live Casper RPC, so this is slower than the page tests
    // and needs headroom when the suite runs in parallel against a dev server.
    test.setTimeout(120_000);
    await page.goto("/agent");

    // The button can paint before React hydrates, so a single click may land on
    // an inert element. Retry until the run actually starts (skip re-clicking
    // once it's underway — the button disables itself while running).
    const runBtn = page.getByRole("button", { name: /run agent|running/i }).first();
    const signed = page.getByText(/signed EIP-712|PAYMENT-SIGNATURE/i).first();
    await expect(async () => {
      if (await runBtn.isEnabled()) await runBtn.click();
      // The agent must actually sign and get the payment verified — this is the
      // real Ed25519 / EIP-712 path, not a simulation.
      await expect(signed).toBeVisible({ timeout: 7000 });
    }).toPass({ timeout: 90000 });

    // Then one of two truthful outcomes:
    //  • funded    → a settlement receipt with an on-chain deploy hash
    //  • unfunded  → an explicit "facilitator unfunded" message telling you to fund it
    const settled = page.locator('a[href*="cspr.live"]').first();
    const needsFunding = page.getByText(/unfunded|fund .*faucet|settlement failed/i).first();
    await expect(settled.or(needsFunding)).toBeVisible({ timeout: 60000 });

    // A price is always shown for the attempted call.
    await expect(page.getByText(/\$/).first()).toBeVisible();
  });
});

test.describe("dashboard", () => {
  test("shows an earnings figure and a live settlement feed", async ({
    page,
  }) => {
    await page.goto("/dashboard");

    await expect(page.getByText(/\$/).first()).toBeVisible();

    // At least one live-feed row: a settlement explorer link, a relative
    // timestamp, or an explicit "settled" status.
    const feedRow = page
      .locator('a[href*="cspr.live"]')
      .or(page.getByText(/\bago\b/i))
      .or(page.getByText(/settled/i))
      .first();
    await expect(feedRow).toBeVisible();
  });
});
