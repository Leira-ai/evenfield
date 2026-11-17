// Final 3.1.2 visual verification: one screenshot per claimed fix,
// against the LIVE build. Files land in probe/qa/hunt2/ and must be
// VIEWED, not just produced.
import { createRequire } from 'module';
import { mkdirSync } from 'node:fs';
const require = createRequire('/home/hatch/workspace/tools/pw/package.json');
const { chromium } = require('playwright-core');

const BASE = 'https://leira-ai.github.io/evenfield/';
const OUT = new URL('./qa/hunt2/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SNOT = '0x8CFeF5CB52E54EE6C83852e5a830da10Cd2d46B6';

const browser = await chromium.launch({
  executablePath: '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1254/chrome-headless-shell-linux64/chrome-headless-shell',
  args: ['--no-sandbox'],
  proxy: { server: 'http://127.0.0.1:18080' },
});

async function newPage(width, height) {
  const ctx = await browser.newContext({ viewport: { width, height }, ignoreHTTPSErrors: true });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('evenfield.v2.theme', 'dark');
      localStorage.setItem('evenfield.v1.lang', 'en');
    } catch { /* ignore */ }
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', String(e).slice(0, 160)));
  return { ctx, page };
}
async function settle(page, ms = 2500) {
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.waitForFunction(() => document.body && document.body.innerText.length > 200, null, { timeout: 30000 }).catch(() => {});
  await sleep(ms);
}

// 1. 320px home: card headers (pill wrap fix, no clipped names)
{
  const { ctx, page } = await newPage(320, 740);
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await settle(page, 3500);
  await page.screenshot({ path: OUT + 'w320-home.png' });
  await page.evaluate(() => window.scrollTo(0, 1500));
  await sleep(900);
  await page.screenshot({ path: OUT + 'w320-home-scroll.png' });
  console.log('w320 done');
  await ctx.close();
}
// 2. 390 mid-scroll: sticky bar solid over cards
{
  const { ctx, page } = await newPage(390, 844);
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await settle(page, 3500);
  await page.evaluate(() => window.scrollTo(0, 1800));
  await sleep(900);
  await page.screenshot({ path: OUT + 'w390-sticky.png' });
  console.log('w390-sticky done');
  // 3. coin page quote dock
  await page.goto(BASE + '#/coin/' + SNOT, { waitUntil: 'domcontentloaded' });
  await settle(page, 4000);
  await page.screenshot({ path: OUT + 'w390-coin-dock.png' });
  console.log('w390-coin-dock done');
  // 4. money page title rule
  await page.goto(BASE + '#/money', { waitUntil: 'domcontentloaded' });
  await settle(page, 3000);
  await page.screenshot({ path: OUT + 'w390-money-title.png' });
  console.log('w390-money-title done');
  await ctx.close();
}
// 5. desktop board: sort select + filter strip
{
  const { ctx, page } = await newPage(1280, 900);
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await settle(page, 3500);
  await page.screenshot({ path: OUT + 'w1280-board-sort.png' });
  console.log('w1280 done');
  await ctx.close();
}
// 6. branded 404
{
  const { ctx, page } = await newPage(390, 844);
  await page.goto(BASE + 'definitely-not-a-page', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await sleep(2000);
  await page.screenshot({ path: OUT + 'w390-404.png' });
  console.log('w390-404 done');
  await ctx.close();
}
await browser.close();
console.log('ALL DONE');
