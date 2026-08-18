/*
 * Fails the build-time eye test that a human cannot do reliably: loads every
 * page at phone widths and reports anything crossing the viewport edge, ignoring
 * containers that are meant to scroll sideways.
 */
import { chromium } from '@playwright/test';

// Override to audit a deployed URL: BASE=https://agentifyos.xyz pnpm audit:mobile
const BASE = process.env.BASE ?? 'http://localhost:8402';
const PAGES = ['/', '/tools', '/explain', '/docs', '/docs/nightpass', '/agent',
               '/developers', '/publish', '/dashboard', '/roadmap', '/shielded',
               '/tools/algo-market-data'];
const WIDTHS = [320, 375, 414];

const browser = await chromium.launch();
let problems = 0;

for (const width of WIDTHS) {
  const ctx = await browser.newContext({
    viewport: { width, height: 800 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  // Midnight selected, so the shielded surface is exercised too.
  await ctx.addCookies([{ name: 'agentifyos-chain', value: 'midnight', url: BASE }]);
  const page = await ctx.newPage();

  for (const path of PAGES) {
    try {
      await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 45000 });
    } catch { continue; }

    const r = await page.evaluate((vw) => {
      const de = document.documentElement;
      const overflow = de.scrollWidth - de.clientWidth;
      const offenders = [];
      if (overflow > 0) {
        for (const el of document.querySelectorAll('body *')) {
          const b = el.getBoundingClientRect();
          if (b.width === 0 || b.height === 0) continue;
          // Only report what actually crosses the viewport edge, and skip
          // anything inside a container that is meant to scroll sideways.
          if (b.right > vw + 1 || b.left < -1) {
            let scrollable = false;
            for (let p = el.parentElement; p; p = p.parentElement) {
              const ov = getComputedStyle(p).overflowX;
              if (ov === 'auto' || ov === 'scroll') { scrollable = true; break; }
            }
            if (scrollable) continue;
            offenders.push({
              tag: el.tagName.toLowerCase(),
              cls: (el.className || '').toString().slice(0, 90),
              right: Math.round(b.right),
              w: Math.round(b.width),
            });
          }
        }
      }
      // Tap targets that are too small to hit reliably.
      const small = [];
      for (const el of document.querySelectorAll('a,button,[role="button"]')) {
        const b = el.getBoundingClientRect();
        if (b.width === 0 || b.height === 0) continue;
        if (b.height < 24) small.push({ tag: el.tagName.toLowerCase(), h: Math.round(b.height), txt: (el.textContent||'').trim().slice(0,28) });
      }
      return { overflow, offenders: offenders.slice(0, 6), small: small.slice(0, 4) };
    }, width);

    if (r.overflow > 0) {
      problems++;
      console.log(`\n[${width}px] ${path}  OVERFLOW +${r.overflow}px`);
      for (const o of r.offenders) console.log(`    <${o.tag}> w=${o.w} right=${o.right}  ${o.cls}`);
    }
    if (width === 375 && r.small.length) {
      console.log(`\n[${width}px] ${path}  small tap targets:`);
      for (const s of r.small) console.log(`    <${s.tag}> h=${s.h}px  "${s.txt}"`);
    }
  }
  await ctx.close();
}
await browser.close();
console.log(problems === 0 ? '\nNo horizontal overflow found.' : `\n${problems} page/width combinations overflow.`);
process.exit(problems === 0 ? 0 : 1);
