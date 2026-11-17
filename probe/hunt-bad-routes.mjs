// Bug hunt extras: routes and inputs the QA suites do not cover.
// - #/coin/<nonexistent> and #/creator/<nonexistent>: must land in a
//   designed state (message + way back), never a blank/crashed page.
// - #/coin/<malformed> (not an address at all).
// - Unknown top-level hash route.
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
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));

async function visit(hash, name) {
  await page.goto(BASE + hash, { waitUntil: 'load', timeout: 60000 });
  await sleep(3500);
  const info = await page.evaluate(() => ({
    text: (document.querySelector('main')?.innerText || '').replace(/\s+/g, ' ').slice(0, 220),
    mainChildren: document.querySelector('main')?.children.length ?? -1,
  }));
  log(name, JSON.stringify(info));
  await page.screenshot({ path: `${OUT}hunt-${name}.png` });
  return info;
}

await visit('#/coin/0x000000000000000000000000000000000000dEaD', 'bad-coin');
await visit('#/creator/0x000000000000000000000000000000000000dEaD', 'bad-creator');
await visit('#/coin/bukan-alamat', 'malformed-coin');
await visit('#/rute-ngawur', 'bad-route');
log('pageerrors:', JSON.stringify(errors));
await browser.close();
