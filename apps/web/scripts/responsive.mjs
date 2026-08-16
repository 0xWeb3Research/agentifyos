import { chromium } from "@playwright/test";

const ROUTES = ["/", "/tools", "/tools/algo-market-data", "/explain", "/docs", "/docs/start-here", "/docs/addresses", "/agent", "/publish", "/dashboard", "/developers", "/roadmap", "/tools/preview"];
const WIDTHS = [390, 768];
const out = "/private/tmp/claude-501/-Users-sidharthp-Documents-Projects-x402-research/48db66e8-95b7-4021-96cc-4eb5ffe9c257/scratchpad";
const shoot = process.argv.includes("--shoot");

const browser = await chromium.launch();
let problems = 0;

for (const width of WIDTHS) {
  console.log(`\n═══ ${width}px ═══`);
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  for (const route of ROUTES) {
    await page.goto(`http://localhost:8402${route}`, { waitUntil: "networkidle" }).catch(() => {});
    await page.waitForTimeout(250);

    const report = await page.evaluate((vw) => {
      const doc = document.documentElement;
      const overflow = doc.scrollWidth - vw;
      // Find the elements actually sticking out past the viewport.
      const culprits = [];
      for (const el of Array.from(document.querySelectorAll("body *"))) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.right > vw + 1) {
          const cls = (el.getAttribute("class") || "").slice(0, 60);
          culprits.push(`${el.tagName.toLowerCase()}${cls ? "." + cls.split(/\s+/)[0] : ""} +${Math.round(r.right - vw)}px`);
        }
      }
      return { overflow, culprits: [...new Set(culprits)].slice(0, 4) };
    }, width);

    const bad = report.overflow > 1;
    if (bad) problems++;
    console.log(
      `  ${bad ? "✗" : "✓"} ${route.padEnd(26)} ${bad ? `overflow +${report.overflow}px → ${report.culprits.join(", ")}` : "fits"}`,
    );
    if (shoot && width === 390) {
      const name = route === "/" ? "home" : route.replace(/\//g, "_").replace(/^_/, "");
      await page.screenshot({ path: `${out}/m-${name}.png`, fullPage: true });
    }
  }
  await page.close();
}

console.log(problems ? `\n${problems} route/width combos overflow\n` : "\nno horizontal overflow anywhere\n");
await browser.close();
