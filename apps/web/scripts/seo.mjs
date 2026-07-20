// Repeatable SEO smoke test. Checks the things that silently rot: a missing
// description, a page that lost its <h1>, a canonical pointing at the wrong
// origin, an OG image that 404s.
//
//   node scripts/seo.mjs              # against the dev server on 8402
//   BASE=https://agentifyos.xyz node scripts/seo.mjs

const BASE = process.env.BASE || "http://localhost:8402";

const ROUTES = [
  "/",
  "/tools",
  "/tools/cspr-market-data",
  "/explain",
  "/docs",
  "/docs/start-here",
  "/docs/proof",
  "/developers",
  "/agent",
  "/roadmap",
  "/publish",
  "/dashboard",
];

// Pages we deliberately keep out of the index; they should NOT be flagged for
// thin metadata, but they must actually carry the noindex.
const NOINDEX = new Set(["/publish", "/dashboard"]);

const pick = (html, re) => (html.match(re)?.[1] ?? "").trim();
const meta = (html, name) =>
  pick(html, new RegExp(`<meta[^>]+(?:name|property)="${name}"[^>]+content="([^"]*)"`, "i")) ||
  pick(html, new RegExp(`<meta[^>]+content="([^"]*)"[^>]+(?:name|property)="${name}"`, "i"));

let fail = 0;
const warn = [];

for (const route of ROUTES) {
  const res = await fetch(BASE + route);
  const html = await res.text();
  const problems = [];

  if (res.status !== 200) problems.push(`HTTP ${res.status}`);

  const title = pick(html, /<title>([^<]*)<\/title>/i);
  const desc = meta(html, "description");
  const canonical = pick(html, /<link rel="canonical" href="([^"]*)"/i);
  const ogImage = meta(html, "og:image");
  const robots = meta(html, "robots");
  const h1s = [...html.matchAll(/<h1[\s>]/gi)].length;
  const ld = [...html.matchAll(/application\/ld\+json/gi)].length;

  if (!title) problems.push("no <title>");
  if (title.length > 70) warn.push(`${route}: title ${title.length} chars (>70 may truncate)`);
  if (!desc) problems.push("no description");
  else if (desc.length > 165) warn.push(`${route}: description ${desc.length} chars (>165 may truncate)`);
  if (!canonical) problems.push("no canonical");
  else {
    // A canonical pointing at the wrong page de-indexes it as a duplicate, which
    // is strictly worse than having none — so compare the path, not just the origin.
    const norm = (p) => p.replace(/\/+$/, "") || "/";
    const path = norm(new URL(canonical).pathname);
    if (path !== norm(route)) problems.push(`canonical -> ${path}, expected ${route}`);
  }
  if (h1s === 0) problems.push("no <h1>");
  if (h1s > 1) problems.push(`${h1s} <h1> tags (expected 1)`);
  if (!ogImage) problems.push("no og:image");

  if (NOINDEX.has(route) && !/noindex/i.test(robots)) problems.push("expected noindex, got none");
  if (!NOINDEX.has(route) && /noindex/i.test(robots)) problems.push("unexpectedly noindex");

  const ok = problems.length === 0;
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${route.padEnd(28)} ${ok ? `h1:${h1s} ld:${ld}` : problems.join("; ")}`);
}

// Assets that link previews and crawlers depend on existing.
console.log("\nassets");
for (const path of [
  "/robots.txt",
  "/sitemap.xml",
  "/manifest.webmanifest",
  "/llms.txt",
  "/icon.png",
  "/apple-icon.png",
  "/opengraph-image",
  "/twitter-image",
  "/tools/cspr-market-data/opengraph-image",
  "/docs/start-here/opengraph-image",
]) {
  const r = await fetch(BASE + path);
  const ok = r.status === 200;
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${path.padEnd(42)} ${r.status} ${r.headers.get("content-type")}`);
}

// Every sitemap URL must resolve — a 404 in the sitemap is a crawl-budget leak.
const xml = await (await fetch(`${BASE}/sitemap.xml`)).text();
const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
console.log(`\nsitemap: ${locs.length} urls`);
let dead = 0;
for (const loc of locs) {
  const r = await fetch(BASE + new URL(loc).pathname, { method: "HEAD" });
  if (r.status !== 200) {
    dead++;
    console.log(`  ✗ ${r.status} ${loc}`);
  }
}
if (dead) fail += dead;
else console.log("  ✓ all resolve");

if (warn.length) console.log(`\nwarnings\n${warn.map((w) => `  · ${w}`).join("\n")}`);
console.log(fail ? `\n${fail} problem(s)\n` : "\nno problems\n");
process.exit(fail ? 1 : 0);
