import { chromium } from "@playwright/test";

const routes = process.argv.slice(2);
const targets = routes.length ? routes : ["/"];
const browser = await chromium.launch();
for (const r of targets) {
  const page = await browser.newPage();
  const msgs = [];
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") msgs.push(`[${m.type()}] ${m.text()}`);
  });
  page.on("pageerror", (e) => msgs.push(`[pageerror] ${e.message}`));
  await page.goto(`http://localhost:8402${r}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  console.log(`\n=== ${r} ===`);
  if (msgs.length === 0) console.log("  clean");
  else msgs.slice(0, 8).forEach((m) => console.log("  " + m.slice(0, 300)));
  await page.close();
}
await browser.close();
