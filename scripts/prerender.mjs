// Gate 11 prerender, run after vite build (npm run build chains it):
// 1. Injects a static, real-content home (hero + fact + stage cards from
//    the snapshot) into dist/index.html's <main>, so the LCP element and
//    a readable no-JS page exist before the bundle runs. The app replaces
//    it on boot with the identical live render.
// 2. Emits share pages dist/coin/<curve>/index.html and
//    dist/creator/<address>/index.html, each with its own title,
//    description, canonical and OG image (generated subject images in
//    public/og/, falling back to og.png), plus a human redirect into the
//    app route. Crawlers read the meta; people land in the app.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';

const BASE = 'https://leira-ai.github.io/evenfield/';
const snap = JSON.parse(readFileSync(new URL('../public/snapshot.json', import.meta.url), 'utf8'));
const distIndex = new URL('../dist/index.html', import.meta.url);
let html = readFileSync(distIndex, 'utf8');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Port of the app's verdictKind (src/main.ts, 3.0.0): face-value labels,
// the two caution kinds kept apart. Keep the two implementations in
// step; the app render replaces this static copy on boot.
const creatorsByAddr = new Map(snap.creators.map((c) => [c.address.toLowerCase(), c]));
function kindOf(l) {
  if (l.testLaunch) return 'test';
  if (l.statusName === 'unreadable' || l.verdict === 'unknown') return 'unknown';
  const c = creatorsByAddr.get(l.creator.toLowerCase());
  if (l.evidence.creatorSoldEarly || (c && c.earlySellCount > 0)) return 'caution-early';
  if (l.stopped || (c && c.stopped > 0)) return 'caution-stopped';
  if (l.verdict === 'toonew') return 'toonew';
  return 'clean';
}
const KIND_EN = {
  test: 'Protocol test launch', unknown: 'We could not read this one yet',
  'caution-early': 'Caution: sold early', 'caution-stopped': 'Caution: their coins stopped',
  toonew: 'Too new to judge', clean: 'Clean record so far',
};
const KIND_CLASS = { test: 'test', unknown: 'unknown', 'caution-early': 'careful', 'caution-stopped': 'careful', toonew: 'toonew', clean: 'clean' };
const fmt = (n) => new Intl.NumberFormat('en-US').format(n);
const fmtDate = (d) => new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(d);
// 1.0 s per block, measured on this chain (see src/main.ts).
const blockDate = (block) => new Date(Date.parse(snap.builtAt) + (block - snap.headBlock) * 1000);
const shortAddr = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;

function stageOf(l) {
  if (l.statusName === 'graduated') return 'graduated';
  if (l.progressPct !== null && l.progressPct >= 75 && l.statusName === 'trading') return 'near';
  if (snap.headBlock - l.block <= 200_000) return 'new';
  return 'other';
}
function card(l) {
  const name = l.name || l.symbol || l.token.slice(0, 6) + '…' + l.token.slice(-4);
  const kind = kindOf(l);
  const pct = l.progressPct !== null ? `<p class="card-line">${fmt(l.progressPct)}% of the way to graduation</p>` : '';
  return `<article class="card"><div class="card-top"><div class="card-names"><a class="card-name" href="#/coin/${l.curve}">${esc(name)}</a><span class="card-sym">${esc(l.symbol ?? '')}</span></div></div>
    <p class="card-line dim small">by ${esc(shortAddr(l.creator))}</p>
    <p class="card-line"><span class="chip chip-${KIND_CLASS[kind]}">${esc(KIND_EN[kind])}</span></p>
    <p class="card-line dim small">${fmt(l.evidence.uniqueBuyers)} buyers so far</p>${pct}</article>`;
}
// The static home honours the same safe defaults as the app (Gate 16):
// protocol test launches and stopped coins are hidden by default.
const visible = snap.launches.filter((l) => !l.testLaunch && !l.stopped);
const stages = [['new', 'Just launched'], ['near', 'Close to graduation'], ['graduated', 'Graduated'], ['other', 'Still trading']]
  .map(([key, label]) => {
    const all = visible.filter((l) => stageOf(l) === key);
    const items = all.slice(0, 12);
    if (!items.length) return '';
    return `<section class="stage"><div class="stage-head"><h2>${label}</h2><span class="stage-count">${fmt(all.length)}</span></div><div class="cq"><div class="grid">${items.map(card).join('')}</div></div></section>`;
  }).join('');
const homeStatic = `<section class="hero hero-compact">
      <h1>Every Ammora coin, judged.</h1>
      <p class="fact">${fmt(snap.creators.length)} creators have launched ${fmt(snap.launches.length)} coins on Ammora so far. Every one of those launches is in this index, with its outcome attached.</p>
      <p class="snapshot-line">Snapshot built ${esc(fmtDate(new Date(snap.builtAt)))}. Live checks are catching up.</p>
    </section>${stages}`;

const start = html.indexOf('<main id="app"');
const end = html.indexOf('</main>');
if (start < 0 || end < 0) throw new Error('dist/index.html main not found');
const mainOpenEnd = html.indexOf('>', start) + 1;
html = html.slice(0, mainOpenEnd) + '\n' + homeStatic + '\n' + html.slice(end);
writeFileSync(distIndex, html);

// ---------- share pages ----------
function sharePage({ path, title, description, ogImage, heading, body, appHash }) {
  const dir = new URL(`../dist/${path}`, import.meta.url);
  mkdirSync(dir, { recursive: true });
  const page = `<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="referrer" content="strict-origin-when-cross-origin" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}" />
<link rel="canonical" href="${BASE}${path}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Evenfield" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:url" content="${BASE}${path}" />
<meta property="og:image" content="${BASE}${ogImage}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(title)}" />
<meta name="twitter:description" content="${esc(description)}" />
<meta name="twitter:image" content="${BASE}${ogImage}" />
<meta name="theme-color" content="#0D130F" />
<style>body{background:#0D130F;color:#EDF4EE;font-family:system-ui,sans-serif;margin:0;padding:24px;line-height:1.55}main{max-width:720px;margin:0 auto}a{color:#6FE3AC}.chip{display:inline-block;border:1px solid #597D65;border-radius:999px;padding:2px 12px;font-weight:700}</style>
<script>location.replace('${BASE}#${appHash}');</script>
</head>
<body><main>
<p><a href="${BASE}">Evenfield</a></p>
<h1>${esc(heading)}</h1>
${body}
<p><a href="${BASE}#${appHash}">Open this in Evenfield</a></p>
<p>Evenfield reads GIWA Sepolia testnet only. Nothing here is financial advice; the receipts are the point.</p>
</main></body>
</html>`;
  writeFileSync(new URL('./index.html', dir), page);
}

let coinPages = 0;
for (const l of snap.launches) {
  const name = l.name || l.symbol || 'Unnamed coin';
  const verdict = KIND_EN[kindOf(l)] ?? '';
  const og = existsSync(new URL(`../public/og/coin-${l.curve.toLowerCase()}.jpg`, import.meta.url))
    ? `og/coin-${l.curve.toLowerCase()}.jpg` : 'og.png';
  sharePage({
    path: `coin/${l.curve}/`,
    title: `${name} (${l.symbol ?? ''}) on Evenfield: ${verdict}`,
    description: `${name} on Ammora (GIWA Sepolia). Lookout verdict: ${verdict}. ${fmt(l.evidence.uniqueBuyers)} buyers so far, launched ${fmtDate(blockDate(l.block))}. Read the receipts before you buy.`,
    ogImage: og,
    heading: `${name} (${l.symbol ?? ''})`,
    body: `<p><span class="chip">${esc(verdict)}</span></p><p>${fmt(l.evidence.uniqueBuyers)} buyers so far · ${fmt(l.evidence.swapCount)} trades read · launched ${fmtDate(blockDate(l.block))} · status: ${esc(l.statusName)}.</p>`,
    appHash: `/coin/${l.curve}`,
  });
  coinPages++;
}
let creatorPages = 0;
for (const c of snap.creators) {
  const og = existsSync(new URL(`../public/og/creator-${c.address.toLowerCase()}.jpg`, import.meta.url))
    ? `og/creator-${c.address.toLowerCase()}.jpg` : 'og.png';
  sharePage({
    path: `creator/${c.address}/`,
    title: `Creator ${c.address.slice(0, 6)}…${c.address.slice(-4)} on Evenfield: ${c.realLaunches} coins, ${c.graduated} graduated`,
    description: `The on-chain record of creator ${c.address} on Ammora: ${c.totalLaunches} launches, ${c.graduated} graduated, ${c.stopped} stopped, ${c.earlySellCount} early sales on record.`,
    ogImage: og,
    heading: `Creator record ${c.address.slice(0, 6)}…${c.address.slice(-4)}`,
    body: `<p>${fmt(c.totalLaunches)} launches · ${fmt(c.graduated)} graduated · ${fmt(c.stopped)} stopped · ${fmt(c.earlySellCount)} launches with an early sale by the creator.</p>`,
    appHash: `/creator/${c.address}`,
  });
  creatorPages++;
}
console.log(`prerender: home static injected; ${coinPages} coin pages; ${creatorPages} creator pages`);
