// Regenerate the deck's screenshots. Usage: node submit/capture-shots.mjs
//
// The deck shows the real product and a real settled transaction, which means
// the images go stale when either changes. This regenerates all of them so the
// deck never drifts into showing a version of the app that no longer exists.
//
// Needs the dev server running (`cd apps/web && pnpm dev`) for the app shots.
// The Lora shot comes from the live network and needs nothing local.
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const webRequire = createRequire(pathToFileURL(join(here, "..", "apps", "web", "package.json")));
const { chromium } = webRequire("@playwright/test");

const ASSETS = join(here, "assets");
const TMP = join(here, ".shots-tmp");
mkdirSync(ASSETS, { recursive: true });
mkdirSync(TMP, { recursive: true });

const BASE = process.env.AGENTIFYOS_URL || "http://localhost:8402";
// The transaction the proof slide shows. Change it here and the slide follows.
const TX = process.env.PROOF_TX || "KD6GTL4RAXJKJWEYSKUTBOX5ZWSMFXI6WENDZ4ZFMVXS4KEIEAGA";

/** PNG screenshots are 3x the size of JPEG for no visible gain at slide scale. */
function toJpeg(name, quality = 82, maxWidth = 1500) {
  execFileSync("sips", [
    "-s", "format", "jpeg", "-s", "formatOptions", String(quality),
    "-Z", String(maxWidth), join(TMP, `${name}.png`), "--out", join(ASSETS, `${name}.jpg`),
  ], { stdio: "ignore" });
  console.log("  wrote assets/" + name + ".jpg");
}

const browser = await chromium.launch();

// ── 1. the catalog, cropped to the listing cards ────────────────────────────
{
  const p = await browser.newPage({ viewport: { width: 1280, height: 1200 }, deviceScaleFactor: 2 });
  await p.goto(`${BASE}/tools`, { waitUntil: "networkidle", timeout: 60000 });
  await p.waitForTimeout(1200);
  const box = await p.locator('a[href^="/tools/"]').first().boundingBox();
  await p.screenshot({
    path: join(TMP, "catalog.png"),
    clip: { x: 36, y: Math.max(0, (box?.y ?? 418) - 16), width: 1208, height: 470 },
  });
  await p.close();
  toJpeg("catalog");
}

// ── 2. the agent demo, mid-run, trace and wire log side by side ─────────────
{
  const p = await browser.newPage({ viewport: { width: 1400, height: 1400 }, deviceScaleFactor: 2 });
  await p.goto(`${BASE}/agent`, { waitUntil: "networkidle", timeout: 60000 });
  await p.getByRole("button", { name: /full run/i }).first().click().catch(() => {});
  await p.waitForTimeout(300);
  await p.getByRole("button", { name: /run agent|running/i }).first().click();
  // This settles real payments, which is the point: the slide shows a real run.
  await p.getByText(/signed a \d+-transaction group/i).first().waitFor({ timeout: 120000 });
  await p.waitForTimeout(11000);
  const box = await p.getByText(/AGENT TRACE/i).first().boundingBox();
  await p.screenshot({
    path: join(TMP, "agent-trace.png"),
    clip: { x: 96, y: Math.max(0, (box?.y ?? 590) - 26), width: 1208, height: 540 },
  });
  await p.close();
  toJpeg("agent-trace", 80);
}

// ── 3. the settled transaction on Lora ──────────────────────────────────────
{
  const p = await browser.newPage({ viewport: { width: 1280, height: 1100 }, deviceScaleFactor: 2 });
  // Lora is a client-rendered SPA that keeps polling, so networkidle never
  // fires. Wait for the DOM, then for content only present once it has rendered.
  await p.goto(`https://lora.algokit.io/testnet/transaction/${TX}`, {
    waitUntil: "domcontentloaded", timeout: 60000,
  });
  await p.getByText(/Asset Transfer/i).first().waitFor({ timeout: 45000 });
  await p.waitForTimeout(3000);
  const amount = await p.getByText(/0\.002/).first().boundingBox();
  const bottom = amount ? Math.ceil(amount.y + amount.height + 18) : 520;
  await p.screenshot({
    path: join(TMP, "lora-tx.png"),
    clip: { x: 200, y: 62, width: 1070, height: bottom - 62 },
  });
  await p.close();
  toJpeg("lora-tx");
}

await browser.close();

// ── 4. the logo, shrunk from the brand original ─────────────────────────────
execFileSync("sips", ["-Z", "256", join(here, "..", "brand", "logo.png"),
  "--out", join(ASSETS, "logo.png")], { stdio: "ignore" });
console.log("  wrote assets/logo.png");

console.log("\ndone. Now run `node build-deck.mjs` to rebuild the PDF.");
