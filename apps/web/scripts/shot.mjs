import { chromium } from "@playwright/test";

const routes = process.argv.slice(2);
const targets = routes.length ? routes : ["/"];
const outDir = "/private/tmp/claude-501/-Users-sidharthp-Documents-Projects-x402-research/48db66e8-95b7-4021-96cc-4eb5ffe9c257/scratchpad";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
for (const r of targets) {
  const url = `http://localhost:8402${r}`;
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  const name = r === "/" ? "home" : r.replace(/\//g, "_").replace(/^_/, "");
  const file = `${outDir}/shot-${name}.png`;
  await page.screenshot({ path: file, fullPage: true });
  console.log(`shot ${r} -> ${file}`);
}
await browser.close();
