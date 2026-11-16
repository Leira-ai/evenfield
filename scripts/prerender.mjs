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
const VERDICT_EN = { careful: 'Worth a careful look', clean: 'Record looks clean so far', toonew: 'Too new to judge', test: 'Protocol test launch', unknown: 'We could not read this one yet' };
const fmt = (n) => new Intl.NumberFormat('en-US').format(n);

function stageOf(l) {
  if (l.statusName === 'graduated') return 'graduated';
  if (l.progressPct !== null && l.progressPct >= 75 && l.statusName === 'trading') return 'near';
  if (snap.headBlock - l.block <= 200_000) return 'new';
  return 'other';
}
function card(l) {
  const name = l.name || l.symbol || l.token.slice(0, 6) + '…' + l.token.slice(-4);
  const pct = l.progressPct !== null ? `<p class="card-line">${fmt(l.progressPct)}% of the way to graduation</p>` : '';
  return `<article class="card"><div class="card-top"><div class="card-names"><a class="card-name" href="#/coin/${l.curve}">${esc(name)}</a><span class="card-sym">${esc(l.symbol ?? '')}</span></div></div>
    <p class="card-line"><span class="chip chip-${esc(l.verdict)}">${esc(VERDICT_EN[l.verdict] ?? '')}</span></p>
    <p class="card-line dim small">${fmt(l.evidence.uniqueBuyers)} buyers so far</p>${pct}</article>`;
}
const stages = [['new', 'Just launched'], ['near', 'Close to graduation'], ['graduated', 'Graduated']]
  .map(([key, label]) => {
    const items = snap.launches.filter((l) => stageOf(l) === key).slice(0, 12);
    if (!items.length) return '';
    return `<section class="stage"><div class="stage-head"><h2>${label}</h2><span class="stage-count">${fmt(snap.launches.filter((l) => stageOf(l) === key).length)}</span></div><div class="cq"><div class="grid">${items.map(card).join('')}</div></div></section>`;
  }).join('');
const builtAgo = snap.builtAt;
const homeStatic = `<section class="hero">
      <h1>Every coin on Ammora. The good ones, the sketchy ones, and the receipts to tell them apart.</h1>
      <p class="sub">See what is launching, read the record of the human behind it before you buy, and launch your own when you are ready. Plain words, real receipts, no terminal speak.</p>
      <p class="fact">${fmt(snap.creators.length)} creators have launched ${fmt(snap.launches.length)} coins on Ammora so far. Every one of those launches is in this index, with its outcome attached.</p>
      <p class="snapshot-line">Data as of block ${fmt(snap.headBlock)} (snapshot built ${esc(builtAgo)}). Live checks are catching up.</p>
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
  const verdict = VERDICT_EN[l.verdict] ?? '';
  const og = existsSync(new URL(`../public/og/coin-${l.curve.toLowerCase()}.jpg`, import.meta.url))
    ? `og/coin-${l.curve.toLowerCase()}.jpg` : 'og.png';
  sharePage({
    path: `coin/${l.curve}/`,
    title: `${name} (${l.symbol ?? ''}) on Evenfield: ${verdict}`,
    description: `${name} on Ammora (GIWA Sepolia). Lookout verdict: ${verdict}. ${fmt(l.evidence.uniqueBuyers)} buyers so far, launched at block ${fmt(l.block)}. Read the receipts before you buy.`,
    ogImage: og,
    heading: `${name} (${l.symbol ?? ''})`,
    body: `<p><span class="chip">${esc(verdict)}</span></p><p>${fmt(l.evidence.uniqueBuyers)} buyers so far · ${fmt(l.evidence.swapCount)} trades read · launched at block ${fmt(l.block)} · status: ${esc(l.statusName)}.</p>`,
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
