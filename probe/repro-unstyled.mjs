// Reproduction for the 2026-11-17 "page renders with no styles at all"
// report (Leira's phone, ~4 KB/s, serif font, blue underlined links).
// Scenario 1: fresh profile, ultra-slow network (~5 KB/s), timeline of
//   what is painted at 1/3/5/10/20 s and whether the stylesheet applies.
// Scenario 2: service worker installed on a fast first visit, then the
//   next deploy wipes every hashed asset (proven: all previous builds'
//   entry chunks return 404). Simulated by answering /assets/ with 404
//   on the second visit. Expected (bug): the SW serves its cached
//   index.html forever (cache-first, never revalidated), the CSS 404s,
//   and the browser paints the prerendered HTML completely unstyled.
// Scenario 2b: same SW, no wipe: reload stays styled (the bomb is the
//   wipe, not the SW alone).
import { createRequire } from 'module';
import { mkdirSync } from 'node:fs';
const require = createRequire('/home/hatch/workspace/tools/pw/package.json');
const { chromium } = require('playwright-core');

const BASE = 'https://leira-ai.github.io/evenfield/';
const OUT = new URL('./qa/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

const browser = await chromium.launch({
  executablePath: '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1254/chrome-headless-shell-linux64/chrome-headless-shell',
  args: ['--no-sandbox'],
  proxy: { server: 'http://127.0.0.1:18080' },
});

async function probeStyle(page, label) {
  const s = await page.evaluate(() => {
    const body = getComputedStyle(document.body);
    const h1 = document.querySelector('h1');
    const h1cs = h1 ? getComputedStyle(h1) : null;
    const link = document.querySelector('.card-name, a');
    const lcs = link ? getComputedStyle(link) : null;
    return {
      bodyBg: body.backgroundColor,
      bodyFont: body.fontFamily.slice(0, 40),
      h1Font: h1cs ? h1cs.fontFamily.slice(0, 40) : null,
      linkColor: lcs ? lcs.color : null,
      linkDecor: lcs ? lcs.textDecorationLine : null,
      sheets: document.styleSheets.length,
      booted: !!document.querySelector('#shell .app-header, #shell header, .tabbar, #tabbar .tab'),
      title: document.title,
    };
  }).catch((e) => ({ error: String(e).slice(0, 120) }));
  log(label, JSON.stringify(s));
  return s;
}

// ---------- Scenario 1: fresh profile, ~5 KB/s ----------
{
  log('--- Scenario 1: fresh profile, download ~5 KB/s, latency 400 ms ---');
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const failed = [];
  page.on('requestfailed', (r) => failed.push(`${r.url().split('/').pop()} ${r.failure()?.errorText}`));
  page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.url().split('/').pop()} HTTP ${r.status()}`); });
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false, latency: 400, downloadThroughput: (5 * 1024), uploadThroughput: (5 * 1024),
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const t0 = Date.now();
  page.goto(BASE, { waitUntil: 'commit', timeout: 120000 }).catch((e) => log('goto err', String(e).slice(0, 100)));
  for (const t of [1, 3, 5, 10, 20, 35]) {
    const wait = t * 1000 - (Date.now() - t0);
    if (wait > 0) await sleep(wait);
    await probeStyle(page, `t=${t}s`);
    if (t === 5 || t === 20) await page.screenshot({ path: `${OUT}repro-slow-t${t}.png` }).catch(() => {});
  }
  log('failed/HTTP>=400:', JSON.stringify(failed));
  await ctx.close();
}

// ---------- Scenario 2: SW installed, then assets wiped ----------
{
  log('--- Scenario 2: visit 1 fast (SW installs), visit 2 with /assets/ -> 404 ---');
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 20000 }).catch(() => log('no SW controller after load'));
  await sleep(1500);
  const swState = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    const keys = await caches.keys();
    let cachedHtml = false;
    for (const k of keys) { const c = await caches.open(k); if (await c.match('https://leira-ai.github.io/evenfield/index.html')) cachedHtml = true; }
    return { scope: reg?.scope, active: reg?.active?.state, caches: keys, cachedHtml };
  }).catch((e) => ({ error: String(e).slice(0, 120) }));
  log('SW after visit 1:', JSON.stringify(swState));
  await probeStyle(page, 'visit1 styled?');

  // Simulate the next deploy: every hashed asset from this build is gone.
  await ctx.route('**/assets/**', (route) => route.fulfill({ status: 404, contentType: 'text/html', body: 'not found' }));
  const seen = [];
  page.on('response', (r) => { if (r.url().includes('/assets/')) seen.push(`${r.url().split('/').pop()} -> ${r.status()}`); });
  await page.reload({ waitUntil: 'commit', timeout: 60000 }).catch((e) => log('reload err', String(e).slice(0, 100)));
  await sleep(4000);
  await probeStyle(page, 'visit2 after asset wipe');
  await page.screenshot({ path: `${OUT}repro-sw-wipe.png` });
  log('asset responses on visit 2:', JSON.stringify(seen.slice(0, 6)));
  await ctx.close();
}

// ---------- Scenario 2b: SW installed, no wipe ----------
{
  log('--- Scenario 2b: visit 1 fast, visit 2 plain reload (assets intact) ---');
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 20000 }).catch(() => {});
  await sleep(1000);
  await page.reload({ waitUntil: 'load', timeout: 60000 });
  await sleep(1500);
  await probeStyle(page, 'visit2 no wipe');
  await ctx.close();
}

await browser.close();
log('done');
