// Render deck.html to deck.pdf using the Chromium Playwright already installs
// for the e2e suite. Usage: node submit/build-deck.mjs
//
// The page defines @page size, so the PDF inherits the slide geometry rather
// than being scaled into A4 with margins.
//
// Playwright lives in apps/web, and this file does not, so Node's own
// resolution would never find it. Resolve from there explicitly rather than
// adding a package.json to a gitignored scratch folder.
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { statSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const webRequire = createRequire(pathToFileURL(join(here, "..", "apps", "web", "package.json")));
// @playwright/test publishes CJS, so require it rather than dynamic-importing:
// the ESM interop would hand back a default wrapper instead of the namespace.
const { chromium } = webRequire("@playwright/test");

const input = join(here, "deck.html");
const output = join(here, "deck.pdf");

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`file://${input}`, { waitUntil: "networkidle" });
await page.pdf({
  path: output,
  printBackground: true,
  preferCSSPageSize: true,
  margin: { top: "0", right: "0", bottom: "0", left: "0" },
});
await browser.close();

const mb = statSync(output).size / 1024 / 1024;
console.log(`deck.pdf written · ${mb.toFixed(2)} MB${mb > 10 ? "  ⚠ over the 10 MB form limit" : ""}`);
