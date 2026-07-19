import { chromium } from "@playwright/test";
const out = "/private/tmp/claude-501/-Users-sidharthp-Documents-Projects-x402-research/48db66e8-95b7-4021-96cc-4eb5ffe9c257/scratchpad";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 2 });
page.on("response", async (r) => {
  if (r.url().includes("/api/agent/run")) {
    console.log("api status:", r.status());
    if (r.status() !== 200) console.log("api body:", (await r.text().catch(() => "<empty>")).slice(0, 500));
  }
});
await page.goto("http://localhost:8402/agent", { waitUntil: "networkidle" });
await page.waitForTimeout(1500); // let hydration settle before clicking
await page.getByRole("button", { name: /run agent/i }).click();
await page.locator("a[href*='cspr.live']").first().waitFor({ timeout: 180000 }).catch(() => {});
await page.waitForTimeout(9000); // staggered reveal
await page.screenshot({ path: `${out}/shot-agent-running.png`, fullPage: true });
await browser.close();
