// Gate 11 OG image generation (local tool; run manually per snapshot
// refresh, output committed under public/og/). Renders a 1200x630 card
// per coin and creator plus the default og.png, using the same tokens
// as the product. Uses the workspace Playwright like the other probes.
import { createRequire } from 'module';
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
const require = createRequire('/home/hatch/workspace/tools/pw/package.json');
const { chromium } = require('playwright-core');

const snap = JSON.parse(readFileSync(new URL('../public/snapshot.json', import.meta.url), 'utf8'));
mkdirSync(new URL('../public/og/', import.meta.url), { recursive: true });
const VERDICT_EN = { careful: 'Worth a careful look', clean: 'Record looks clean so far', toonew: 'Too new to judge', test: 'Protocol test launch', unknown: 'We could not read this one yet' };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function cardHtml(title, line, chip) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{margin:0;width:1200px;height:630px;background:#17142B;color:#F2F0FA;font-family:'Sora','Inter',system-ui,sans-serif;display:flex;flex-direction:column;justify-content:space-between;padding:64px;box-sizing:border-box}
    .brand{font-size:34px;font-weight:800;color:#A78BFA;letter-spacing:-0.02em}
    h1{font-size:76px;line-height:1.05;margin:0 0 20px;letter-spacing:-0.02em;overflow-wrap:anywhere}
    .line{font-size:32px;color:#AEC2B2;line-height:1.35}
    .chip{display:inline-block;margin-top:28px;border:2px solid #8B7FD4;border-radius:999px;padding:8px 22px;font-size:28px;font-weight:800;color:#F2F0FA}
    .foot{font-size:24px;color:#7E937F}
  </style></head><body>
    <div class="brand">Evenfield</div>
    <div><h1>${esc(title)}</h1><div class="line">${esc(line)}</div>${chip ? `<span class="chip">${esc(chip)}</span>` : ''}</div>
    <div class="foot">Every Ammora coin, with the receipts · GIWA Sepolia</div>
  </body></html>`;
}

const browser = await chromium.launch({
  executablePath: '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1254/chrome-headless-shell-linux64/chrome-headless-shell',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });

async function shot(html, out, type) {
  await page.setContent(html, { waitUntil: 'load' });
  await page.screenshot({ path: out, type, ...(type === 'jpeg' ? { quality: 72 } : {}) });
}

const outUrl = (rel) => new URL(`../public/${rel}`, import.meta.url).pathname;
await shot(cardHtml('Every coin on Ammora, with the receipts.', 'Spot the coins worth your money, read the record of the human behind each one, and collect what is yours.', ''), outUrl('og.png'), 'png');
console.log('og.png done');
let n = 0;
for (const l of snap.launches) {
  const rel = `og/coin-${l.curve.toLowerCase()}.jpg`;
  if (existsSync(outUrl(rel))) continue;
  const name = l.name || l.symbol || 'Unnamed coin';
  await shot(cardHtml(`${name} (${l.symbol ?? ''})`, `${l.evidence.uniqueBuyers} buyers so far · launched at block ${l.block} · status ${l.statusName}`, VERDICT_EN[l.verdict] ?? ''), outUrl(rel), 'jpeg');
  n++;
}
for (const c of snap.creators) {
  const rel = `og/creator-${c.address.toLowerCase()}.jpg`;
  if (existsSync(outUrl(rel))) continue;
  await shot(cardHtml(`Creator ${c.address.slice(0, 6)}…${c.address.slice(-4)}`, `${c.totalLaunches} launches · ${c.graduated} graduated · ${c.stopped} stopped · ${c.earlySellCount} early sales on record`, 'Creator record'), outUrl(rel), 'jpeg');
  n++;
}
console.log(`generated ${n} subject images`);
await browser.close();
