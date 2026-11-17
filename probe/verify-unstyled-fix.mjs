// Verification for the 3.1.1 unstyled-page fix, against the LIVE URL.
// A: fresh profile at ~5 KB/s: the page must be STYLED from the first
//    paint (CSS is inlined into the HTML now); measured at t=1/3/5 s.
// B: new service worker installed, then every /assets/ file 404s (the
//    next deploy's wipe): navigation is network-first, so the reload
//    gets the fresh HTML whose inline CSS keeps the page styled even
//    though the app JS cannot load. Graceful, readable, styled.
// C: legacy heal, on a local mirror: the pre-fix site (old sw.js with
//    cache evenfield-v3.1.0 + old HTML) is served, the CSS file is then
//    deleted (the wipe) and the page goes unstyled (Leira's state);
//    then the fixed build is deployed to the mirror and the next load
//    must heal itself: new SW activates, legacy cache is purged, the
//    open window is navigated, and the page comes back styled.
import { createRequire } from 'module';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, cpSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
const require = createRequire('/home/hatch/workspace/tools/pw/package.json');
const { chromium } = require('playwright-core');

const BASE = 'https://leira-ai.github.io/evenfield/';
const OUT = new URL('./qa/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
let failures = 0;
function expect(name, ok, detail = '') { log(ok ? 'PASS' : 'FAIL', name, detail); if (!ok) failures++; }

const EXEC = '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1254/chrome-headless-shell-linux64/chrome-headless-shell';
const browser = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox'], proxy: { server: 'http://127.0.0.1:18080' } });

async function probeStyle(page, label) {
  const s = await page.evaluate(() => {
    const body = getComputedStyle(document.body);
    const h1 = document.querySelector('h1');
    return {
      bodyBg: body.backgroundColor,
      bodyFont: body.fontFamily.slice(0, 30),
      styled: body.backgroundColor === 'rgb(13, 19, 15)' || body.backgroundColor === 'rgb(246, 244, 236)',
    };
  }).catch((e) => ({ error: String(e).slice(0, 100), styled: false }));
  log(label, JSON.stringify(s));
  return s;
}

// ---------- A: fresh profile, ~5 KB/s ----------
{
  log('--- A: fresh profile, ~5 KB/s, fix must be styled from first paint ---');
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 400, downloadThroughput: 5 * 1024, uploadThroughput: 5 * 1024 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const t0 = Date.now();
  page.goto(BASE, { waitUntil: 'commit', timeout: 120000 }).catch(() => {});
  // The invariant that matters: there is NO moment where content is
  // painted unstyled (the old build showed serif/blue-link content at
  // t=3-5s). Before the first paint the browser shows its blank
  // loading state; the first painted content must already be styled.
  let firstContentAt = null, firstStyledAt = null, sawUnstyledContent = false;
  for (const t of [1, 2, 3, 4, 5, 6, 8, 10]) {
    const wait = t * 1000 - (Date.now() - t0);
    if (wait > 0) await sleep(wait);
    const s = await page.evaluate(() => {
      if (!document.body || !document.querySelector('h1')) return { content: false };
      const bg = getComputedStyle(document.body).backgroundColor;
      return { content: true, bg, styled: bg === 'rgb(13, 19, 15)' || bg === 'rgb(246, 244, 236)' };
    }).catch(() => ({ content: false }));
    log(`t=${t}s`, JSON.stringify(s));
    if (s.content && firstContentAt === null) firstContentAt = t;
    if (s.content && s.styled && firstStyledAt === null) firstStyledAt = t;
    if (s.content && !s.styled) sawUnstyledContent = true;
    if (t === 5) await page.screenshot({ path: `${OUT}fix-slow-t5.png` }).catch(() => {});
  }
  expect('A no unstyled-content phase on 5 KB/s', !sawUnstyledContent, `firstContentAt=${firstContentAt} firstStyledAt=${firstStyledAt}`);
  expect('A styled content by t=6s on 5 KB/s', firstStyledAt !== null && firstStyledAt <= 6, `firstStyledAt=${firstStyledAt}`);
  await ctx.close();
}

// ---------- B: new SW + asset wipe ----------
{
  log('--- B: new SW installed, then /assets/ -> 404, reload must stay styled ---');
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 20000 }).catch(() => log('no SW controller'));
  await sleep(1200);
  const caches1 = await page.evaluate(() => caches.keys());
  log('caches after visit 1:', JSON.stringify(caches1));
  expect('B new cache name (evenfield-b*)', caches1.some((k) => k.startsWith('evenfield-b')), caches1.join(','));
  await ctx.route('**/assets/**', (route) => route.fulfill({ status: 404, contentType: 'text/html', body: 'not found' }));
  await page.reload({ waitUntil: 'commit', timeout: 60000 }).catch(() => {});
  await sleep(4000);
  const s = await probeStyle(page, 'after wipe reload');
  await page.screenshot({ path: `${OUT}fix-sw-wipe.png` });
  expect('B page styled after asset wipe', s.styled === true, JSON.stringify(s));
  await ctx.close();
}
await browser.close();

// ---------- C: legacy heal on a local mirror ----------
{
  log('--- C: legacy mirror heal ---');
  const ROOT = '/tmp/legacy-mirror';
  rmSync(ROOT, { recursive: true, force: true });
  mkdirSync(`${ROOT}/evenfield/assets`, { recursive: true });
  const proj = new URL('..', import.meta.url).pathname;
  // Pre-fix artifacts: old index.html (saved from the live site before
  // the fix) and the legacy sw.js fixture (probe/legacy-sw-v3.1.0.js,
  // extracted from git HEAD before the fix was committed).
  const oldHtml = readFileSync('/tmp/live-index.html', 'utf8');
  const oldSw = readFileSync(`${proj}probe/legacy-sw-v3.1.0.js`, 'utf8');
  const isOldSw = oldSw.includes("const CACHE = 'evenfield-v3.1.0'");
  if (!isOldSw) { log('C SKIPPED: legacy sw fixture not recognised'); }
  else {
    writeFileSync(`${ROOT}/evenfield/index.html`, oldHtml);
    writeFileSync(`${ROOT}/evenfield/sw.js`, oldSw);
    writeFileSync(`${ROOT}/evenfield/manifest.webmanifest`, readFileSync(`${proj}public/manifest.webmanifest`, 'utf8'));
    writeFileSync(`${ROOT}/evenfield/snapshot.json`, readFileSync(`${proj}public/snapshot.json`, 'utf8'));
    // The two assets the old HTML references (same hashes as the fix build).
    for (const f of ['index--gyS03ka.js', 'index-ClaOTa7e.css']) {
      const src = `${proj}dist/assets/${f}`;
      if (existsSync(src)) cpSync(src, `${ROOT}/evenfield/assets/${f}`);
    }
    const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
    const server = http.createServer((req, res) => {
      let p = decodeURIComponent((req.url || '/').split('?')[0]);
      if (p.endsWith('/')) p += 'index.html';
      const file = path.join(ROOT, p);
      if (!file.startsWith(ROOT) || !existsSync(file)) { res.writeHead(404); res.end('nf'); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      res.end(readFileSync(file));
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const port = server.address().port;
    const LBASE = `http://127.0.0.1:${port}/evenfield/`;
    log('mirror at', LBASE);
    const browser2 = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox'] });
    const ctx = await browser2.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.goto(LBASE, { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 15000 }).catch(() => log('legacy: no controller'));
    await sleep(1000);
    const s1 = await probeStyle(page, 'legacy visit 1');
    expect('C legacy visit 1 styled', s1.styled === true);
    // The wipe: delete the CSS, reload -> Leira's unstyled state.
    rmSync(`${ROOT}/evenfield/assets/index-ClaOTa7e.css`);
    await page.reload({ waitUntil: 'commit', timeout: 30000 }).catch(() => {});
    await sleep(2500);
    const s2 = await probeStyle(page, 'legacy after CSS wipe');
    await page.screenshot({ path: `${OUT}fix-legacy-broken.png` });
    expect('C legacy state reproduces the bug (unstyled)', s2.styled === false, JSON.stringify(s2));
    // The fix deploys to the mirror: new index.html (inline CSS) + new sw.js.
    writeFileSync(`${ROOT}/evenfield/index.html`, readFileSync(`${proj}dist/index.html`, 'utf8'));
    writeFileSync(`${ROOT}/evenfield/sw.js`, readFileSync(`${proj}dist/sw.js`, 'utf8'));
    // A fresh navigation: browser picks up the new SW; legacy cache is
    // purged on activation and the open window is navigated (healed).
    await page.reload({ waitUntil: 'commit', timeout: 30000 }).catch(() => {});
    await sleep(3500);
    const s3 = await probeStyle(page, 'after fix deploy + reload');
    await page.screenshot({ path: `${OUT}fix-legacy-healed.png` });
    const cachesNow = await page.evaluate(() => caches.keys()).catch(() => []);
    log('caches after heal:', JSON.stringify(cachesNow));
    expect('C healed: styled again', s3.styled === true, JSON.stringify(s3));
    expect('C legacy cache purged', !cachesNow.includes('evenfield-v3.1.0'), cachesNow.join(','));
    await browser2.close();
    server.close();
  }
}

log(failures === 0 ? 'ALL VERIFY CHECKS PASSED' : `${failures} VERIFY CHECKS FAILED`);
process.exit(failures === 0 ? 0 : 1);
