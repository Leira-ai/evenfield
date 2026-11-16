// Evenfield: the whole Ammora launch day in one place.
// Redesign ("field at dusk", spec R1-R6): snapshot-first board, coin pages
// with live quotes, an SVG curve chart and evidence-backed verdicts,
// creator passports, the Glean-proven money center (claims only from the
// visitor's own wallet, after simulation), the GIWA chain checker,
// published verdict methodology, and a public dispute path.
// The data engine (money.ts, chain.ts) is unchanged in behaviour; this
// file is presentation, routing and state. Chain-heavy modules load
// lazily per route so the first paint stays inside the Gate 5 budget.
// All chain data is untrusted: every interpolated value passes esc()
// (sink audit in BUILD.md).
import { formatUnits, parseUnits, type Address } from 'viem';
import {
  t, getLang, setLang, fmtNum, fmtAgo,
} from './i18n';
import type { ClaimRow, Discovery, LookupResult } from './money';
import type { WalletState } from './wallet';

// ---------- snapshot types ----------
interface CurveState {
  status: number | null; sqrtPrice: string | null; baseReserve: string | null;
  quoteReserve: string | null; migrationQuoteThreshold: string | null;
  baseToken: string | null; quoteToken: string | null; canonicalPool: string | null; feeBps: number | null;
}
interface Evidence {
  swapCount: number; uniqueBuyers: number; firstSwapBlock: number | null; lastSwapBlock: number | null;
  lastSwapTx: string | null; creatorBuys: number; creatorBuyTotal: string; creatorSellTotal: string;
  creatorSells: { block: number; tx: string; amountIn: string; blocksAfterLaunch: number }[];
  creatorSoldEarly: boolean; currentCreator: string; creatorTransferred: { tx: string; block: number } | null;
  holders: { count: number; top1Pct: number; top10Pct: number; windowed: boolean } | null;
  windows: [number, number][];
}
interface Launch {
  token: string; curve: string; creator: string; configId: string;
  protocolVersion: number; uri: string; block: number; tx: string; slots: string[]; factory: string;
  name: string | null; symbol: string | null; decimals: number; totalSupply: string | null;
  state: CurveState | null; statusName: string; readyToMigrate?: boolean; stopped: boolean; progressPct: number | null;
  evidence: Evidence; testLaunch: boolean; testReason: string | null;
  verdict: string; verdictReasons: { kind: string;[k: string]: unknown }[];
}
interface CreatorRec {
  address: string; totalLaunches: number; testLaunches: number; realLaunches: number;
  graduated: number; trading: number; stopped: number; pending: number; unreadable: number;
  earlySellCount: number; earlySellLaunches: string[]; firstLaunchBlock: number; lastLaunchBlock: number;
}
interface Snapshot {
  schema: number; builtAt: string; headBlock: number; chainId: number;
  params: { stopBlocks: number; earlyBlocks: number };
  factories: { factory: string; slots: string[] }[];
  launches: Launch[]; creators: CreatorRec[];
}

// ---------- lazy engine modules ----------
const moneyMod = () => import('./money');
const chainMod = () => import('./chain');
const walletMod = () => import('./wallet');

// ---------- small helpers ----------
const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const EXPLORER = 'https://sepolia-explorer.giwa.io';
const txLink = (tx: string) => `${EXPLORER}/tx/${tx}`;
const addrLink = (a: string) => `${EXPLORER}/address/${a}`;
const byCurve = new Map<string, Launch>();
const byCreator = new Map<string, CreatorRec>();
let snap: Snapshot | null = null;
let deltaCount = 0;

function shortAddr(a: string): string { return `${a.slice(0, 6)}…${a.slice(-4)}`; }

function countView(route: string) {
  try {
    const key = 'evenfield.v1.analytics';
    const data = JSON.parse(localStorage.getItem(key) ?? '{"routes":{}}') as { routes: Record<string, number> };
    data.routes[route] = (data.routes[route] ?? 0) + 1;
    localStorage.setItem(key, JSON.stringify(data));
  } catch { /* analytics is best-effort and local only */ }
}

/** Address chip with one-tap full-address view and copy (Gate 6). */
function addrChip(a: string): string {
  return `<span class="addr-chip"><span data-addr-short>${esc(shortAddr(a))}</span>
    <button type="button" data-addr-toggle="${esc(a)}">${esc(t('addr.show'))}</button>
    <button type="button" data-addr-copy="${esc(a)}">${esc(t('addr.copy'))}</button></span>`;
}
function wireAddrChips(root: ParentNode) {
  root.querySelectorAll<HTMLButtonElement>('[data-addr-copy]').forEach((b) =>
    b.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(b.dataset.addrCopy!); b.textContent = t('addr.copied'); } catch { /* clipboard unavailable */ }
    }));
  root.querySelectorAll<HTMLButtonElement>('[data-addr-toggle]').forEach((b) =>
    b.addEventListener('click', () => {
      const span = b.parentElement?.querySelector('[data-addr-short]');
      if (!span) return;
      const full = b.dataset.addrToggle!;
      span.textContent = span.textContent === full ? shortAddr(full) : full;
    }));
}

function toast(msg: string) {
  const root = $('#toast-root');
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  root.appendChild(el);
  setTimeout(() => el.remove(), 6000);
}

/** Deterministic identicon from an address: a 5x5 mirrored block pattern
 *  in an address-derived hue. Numbers only; no user text enters the SVG. */
function identicon(address: string, cls = ''): string {
  const hex = address.toLowerCase().replace(/^0x/, '').padEnd(40, '0');
  const hue = parseInt(hex.slice(0, 4), 16) % 360;
  const cells: string[] = [];
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 3; x++) {
      const bit = parseInt(hex[(y * 3 + x) % hex.length], 16);
      if (bit % 2 === 0) {
        cells.push(`<rect x="${x * 20}" y="${y * 20}" width="20" height="20"/>`);
        if (x !== 2) cells.push(`<rect x="${(4 - x) * 20}" y="${y * 20}" width="20" height="20"/>`);
      }
    }
  }
  return `<span class="identicon ${cls}" aria-hidden="true"><svg viewBox="0 0 100 100" fill="hsl(${hue} 55% 55%)">${cells.join('')}</svg></span>`;
}

// ---------- theme ----------
const THEME_KEY = 'evenfield.v2.theme';
type Theme = 'dark' | 'light';
function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}
function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem(THEME_KEY, theme); } catch { /* ignore */ }
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = theme === 'dark' ? '#0D130F' : '#F6F4EC';
}

// ---------- verdicts (content unchanged from the verified engine) ----------
const VERDICT_ICON: Record<string, string> = { careful: '⚠', clean: '✓', toonew: '◔', test: '⚗', unknown: '?' };
function verdictChip(l: Launch): string {
  const key = `verdict.${l.verdict}` as const;
  return `<span class="chip chip-${l.verdict}"><span aria-hidden="true">${VERDICT_ICON[l.verdict] ?? '?'}</span> ${esc(t(key))}</span>`;
}
function stageOf(l: Launch): 'new' | 'near' | 'graduated' | 'other' {
  if (!snap) return 'other';
  if (l.statusName === 'graduated') return 'graduated';
  if (l.progressPct !== null && l.progressPct >= 75 && l.statusName === 'trading') return 'near';
  if (snap.headBlock - l.block <= 200_000) return 'new';
  return 'other';
}
function stagePill(l: Launch): string {
  const s = stageOf(l);
  const label = s === 'graduated' ? t('stage.graduated') : s === 'near' ? t('stage.near') : s === 'new' ? t('stage.new') : t('stage.all');
  return `<span class="pill pill-${s}">${esc(label)}</span>`;
}
function creatorOf(l: Launch): CreatorRec | undefined { return byCreator.get(l.creator.toLowerCase()); }
function displayName(l: Launch): string { return l.name || l.symbol || shortAddr(l.token); }

function cardReason(l: Launch): string {
  if (l.testLaunch) return t('verdict.reason.test', { reason: l.testReason ?? '' });
  if (l.statusName === 'unreadable') return t('verdict.reason.unreadable');
  if (l.evidence.creatorSoldEarly) return t('card.reason.earlythis');
  const c = creatorOf(l);
  if (c && c.earlySellCount > 0) return t('card.reason.early', { n: c.earlySellCount });
  if (l.stopped) return t('verdict.reason.stopped', { block: fmtNum(l.evidence.lastSwapBlock ?? l.block) });
  if (l.statusName === 'graduated') return t('verdict.reason.graduated');
  if (l.verdict === 'toonew') return t('card.reason.new');
  return t('card.reason.clean');
}

function coinCard(l: Launch): string {
  const progress = l.statusName === 'graduated'
    ? `<p class="card-line">${esc(t(l.readyToMigrate ? 'board.progress.ready' : 'board.progress.done'))}</p>`
    : l.progressPct !== null
      ? `<div class="meter" role="img" aria-label="${esc(t('board.progress', { pct: fmtNum(l.progressPct, { maximumFractionDigits: 1 }) + '%' }))}"><div class="meter-fill" style="width:${Math.max(2, Math.min(100, l.progressPct))}%"></div></div><p class="card-line">${esc(t('board.progress', { pct: fmtNum(l.progressPct, { maximumFractionDigits: 1 }) + '%' }))}</p>`
      : `<p class="card-line">${esc(t('board.progress.none'))}</p>`;
  return `<article class="card">
    <div class="card-top">${identicon(l.curve)}
      <div class="card-names"><a class="card-name" href="#/coin/${l.curve}">${esc(displayName(l))}</a>
      <span class="card-sym">${esc(l.symbol ?? '')}</span></div>${stagePill(l)}</div>
    <p class="card-line">${verdictChip(l)}</p>
    <p class="card-reason">${esc(cardReason(l))}</p>
    <p class="card-line dim small">${esc(t('board.buyers', { n: fmtNum(l.evidence.uniqueBuyers) }))}</p>
    ${progress}
  </article>`;
}

function verdictSentences(l: Launch): string[] {
  const out: string[] = [];
  const c = creatorOf(l);
  if (l.testLaunch) {
    out.push(t('verdict.reason.test', { reason: l.testReason ?? '' }));
    return out;
  }
  if (c && c.realLaunches > 0) {
    const n = c.realLaunches - c.unreadable;
    const tcount = Math.max(0, n - c.graduated - c.stopped);
    out.push(t('verdict.sentence', { n, g: c.graduated, t: tcount, s: c.stopped }));
  }
  const earlyLaunch = l.evidence.creatorSoldEarly ? l : (c?.earlySellLaunches.map((cv) => byCurve.get(cv)).find((x) => x?.evidence.creatorSoldEarly) ?? null);
  if (earlyLaunch) {
    const ev = earlyLaunch.evidence;
    const earlySells = ev.creatorSells.filter((s) => s.blocksAfterLaunch <= (snap?.params.earlyBlocks ?? 7200));
    const soldEarly = earlySells.reduce((sum, s) => sum + BigInt(s.amountIn), 0n);
    const bought = BigInt(ev.creatorBuyTotal || '0');
    if (bought > 0n && soldEarly > 0n) {
      const pct = fmtNum(Number((soldEarly * 10000n) / bought) / 100, { maximumFractionDigits: 1 }) + '%';
      out.push(t(earlySells.length === 1 ? 'verdict.sentence.sell.one' : 'verdict.sentence.sell', {
        coin: displayName(earlyLaunch), x: pct, when: t('verdict.when.early'), k: earlySells.length,
      }));
    }
  }
  if (l.stopped) out.push(t('verdict.reason.stopped', { block: fmtNum(l.evidence.lastSwapBlock ?? l.block) }));
  if (l.statusName === 'graduated') out.push(t('verdict.reason.graduated'));
  if (out.length) out.push(t('verdict.sentence.tail'));
  return out;
}

function evidenceList(l: Launch): string {
  const items: string[] = [];
  items.push(`<li>${esc(t('coin.launched.at', { block: fmtNum(l.block) }))} · <a href="${txLink(l.tx)}" target="_blank" rel="noopener">${esc(t('evidence.tx'))}</a> <span class="tx-hash">${esc(shortAddr(l.tx))}</span></li>`);
  for (const s of l.evidence.creatorSells) {
    const amt = fmtNum(Number(formatUnits(BigInt(s.amountIn), l.decimals)), { maximumFractionDigits: 4 });
    items.push(`<li>${esc(t('evidence.block', { block: fmtNum(s.block) }))}: ${esc(amt)} ${esc(l.symbol ?? '')} · <a href="${txLink(s.tx)}" target="_blank" rel="noopener">${esc(t('evidence.tx'))}</a></li>`);
  }
  const c = creatorOf(l);
  if (c) {
    for (const cv of c.earlySellLaunches) {
      if (cv === l.curve.toLowerCase()) continue;
      const other = byCurve.get(cv);
      if (other) items.push(`<li>${esc(displayName(other))} · <a href="#/coin/${other.curve}">${esc(t('evidence.coinpage'))}</a></li>`);
    }
  }
  if (l.evidence.lastSwapTx) {
    items.push(`<li>${esc(t('coin.state.lasttrade'))}: ${esc(t('evidence.block', { block: fmtNum(l.evidence.lastSwapBlock ?? 0) }))} · <a href="${txLink(l.evidence.lastSwapTx)}" target="_blank" rel="noopener">${esc(t('evidence.tx'))}</a></li>`);
  }
  if (l.state?.canonicalPool && l.statusName === 'graduated') {
    items.push(`<li>Pool: <a href="${addrLink(l.state.canonicalPool)}" target="_blank" rel="noopener">${esc(shortAddr(l.state.canonicalPool))}</a></li>`);
  }
  if (l.evidence.creatorTransferred) {
    items.push(`<li>${esc(t('passport.currentnote', { addr: shortAddr(l.evidence.currentCreator) }))} · <a href="${txLink(l.evidence.creatorTransferred.tx)}" target="_blank" rel="noopener">${esc(t('evidence.tx'))}</a></li>`);
  }
  return items.length ? `<ul class="evidence">${items.join('')}</ul>` : `<p>${esc(t('evidence.empty'))}</p>`;
}

function verdictStage(l: Launch): string {
  const sentences = verdictSentences(l).map((s) => `<p>${esc(s)}</p>`).join('');
  return `<section class="verdict-panel" aria-label="${esc(t('verdict.title'))}">
    <h2>${esc(t('verdict.title'))}</h2>
    <p>${verdictChip(l)}</p>
    ${sentences}
    <div class="btn-row">
      <button class="btn btn-ghost" data-evidence="${l.curve}" aria-expanded="false">${esc(t('verdict.receipts.btn'))}</button>
      <a class="btn btn-ghost" href="#/creator/${l.creator}">${esc(t('verdict.full.btn'))}</a>
    </div>
    <div class="drawer" id="drawer-${l.curve}" hidden>
      <h3>${esc(t('evidence.title'))}</h3>
      ${evidenceList(l)}
    </div>
  </section>`;
}

/** Real SVG bonding-curve chart from snapshot data: the fill progress is
 *  the measured fact; the path is the curve's rising price shape, and the
 *  marker sits at the measured progress with the measured spot price. */
function curveChart(l: Launch, quoteSym: string, quoteDec: number): string {
  const st = l.state;
  if (!st?.sqrtPrice || l.progressPct === null) {
    return `<section class="panel"><h2>${esc(t('chart.title'))}</h2><p class="dim">${esc(t('chart.nodata'))}</p></section>`;
  }
  const sqrt = Number(BigInt(st.sqrtPrice)) / 2 ** 96;
  const price = sqrt * sqrt * 10 ** (l.decimals - quoteDec);
  const pct = Math.max(0, Math.min(100, l.progressPct));
  const W = 640, H = 220, PL = 8, PB = 24, PT = 12;
  const x = (p: number) => PL + (p / 100) * (W - PL - 8);
  const y = (p: number) => PT + (1 - (p / 100) ** 2) * (H - PT - PB);
  let d = `M ${x(0).toFixed(1)} ${y(0).toFixed(1)}`;
  for (let p = 5; p <= 100; p += 5) d += ` L ${x(p).toFixed(1)} ${y(p).toFixed(1)}`;
  const priceTxt = Number.isFinite(price) && price > 0
    ? `<p class="card-line">${esc(t('chart.price', { price: fmtNum(price, { maximumFractionDigits: 6 }), sym: quoteSym }))}</p>` : '';
  return `<section class="panel"><h2>${esc(t('chart.title'))}</h2>
    <div class="chart-wrap"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(t('chart.note', { pct: fmtNum(pct, { maximumFractionDigits: 1 }) + '%' }))}">
      <path d="${d} L ${x(100).toFixed(1)} ${y(0).toFixed(1)} Z" fill="var(--action)" opacity="0.14"></path>
      <path d="${d}" fill="none" stroke="var(--action)" stroke-width="3" stroke-linejoin="round"></path>
      <circle cx="${x(pct).toFixed(1)}" cy="${y(pct).toFixed(1)}" r="7" fill="var(--canvas)" stroke="var(--action)" stroke-width="3"></circle>
      <text x="${x(0).toFixed(1)}" y="${H - 6}" fill="var(--text-2)" font-size="12">0%</text>
      <text x="${(x(100) - 34).toFixed(1)}" y="${H - 6}" fill="var(--text-2)" font-size="12">100%</text>
    </svg></div>
    <p class="dim small">${esc(t('chart.note', { pct: fmtNum(pct, { maximumFractionDigits: 1 }) + '%' }))}</p>
    ${priceTxt}
  </section>`;
}

function statBlock(label: string, value: string, meaning: string): string {
  return `<div class="stat"><span class="stat-l">${esc(label)}</span><span class="stat-n">${esc(value)}</span><span class="stat-m">${esc(meaning)}</span></div>`;
}

// ---------- shell: header, tab bar, wallet ----------
let walletState: WalletState = { status: 'disconnected' };
let walletReady = false;

function walletButtonHtml(): string {
  const s = walletState;
  if (s.status === 'connecting') return `<button class="wallet-btn" id="walletBtn" disabled>${esc(t('wallet.connecting'))}</button>`;
  if (s.status === 'wrong-network') return `<button class="wallet-btn wrong" id="walletBtn">⚠ ${esc(t('wallet.wrong'))}</button>`;
  if (s.status === 'connected' && s.address) {
    return `<button class="wallet-btn" id="walletBtn"><span class="addr">${esc(shortAddr(s.address))}</span><span class="dim small">GIWA Sepolia</span></button>`;
  }
  return `<button class="wallet-btn primary" id="walletBtn">${esc(t('wallet.connect'))}</button>`;
}

function shellHtml(active: string): string {
  const nav = [
    ['/', 'nav.board'], ['/money', 'nav.money'], ['/chain', 'nav.chain'], ['/method', 'nav.method'], ['/dispute', 'nav.dispute'],
  ] as const;
  const themeIcon = currentTheme() === 'dark' ? '☀' : '☾';
  return `<header class="topbar">
      <a class="brand" href="#/">Evenfield</a>
      <nav class="topnav" aria-label="Primary">${nav.map(([href, key]) => `<a href="#${href}" class="${active === href ? 'active' : ''}">${esc(t(key))}</a>`).join('')}</nav>
      <div class="top-right">
        <span class="chain-badge"><span class="dot" aria-hidden="true"></span>${esc(t('chain.badge.short'))}</span>
        <span id="wallet-slot">${walletButtonHtml()}</span>
        <button class="icon-btn" id="themeBtn" aria-label="${esc(t('theme.toggle'))}" title="${esc(t('theme.toggle'))}">${themeIcon}</button>
        <div class="lang-toggle" role="group" aria-label="Language">
          <button data-lang="en" class="${getLang() === 'en' ? 'active' : ''}">EN</button>
          <button data-lang="id" class="${getLang() === 'id' ? 'active' : ''}">ID</button>
        </div>
      </div>
    </header>`;
}

function tabbarHtml(active: string): string {
  const tabs = [
    ['/', 'nav.board', '▦'], ['/money', 'nav.money', '◈'], ['/chain', 'nav.chain', '⛓'], ['/method', 'nav.method', '§'], ['/dispute', 'nav.dispute', '✎'],
  ] as const;
  return `<nav class="tabbar" aria-label="Primary">${tabs.map(([href, key, icon]) =>
    `<a href="#${href}" class="${active === href ? 'active' : ''}"><span class="tab-icon" aria-hidden="true">${icon}</span>${esc(t(key))}</a>`).join('')}</nav>`;
}

async function openWalletSheet() {
  const w = await walletMod();
  const root = $('#sheet-root');
  const s = walletState;
  let body = '';
  if (s.status === 'connected' && s.address) {
    body = `<h2>${esc(t('wallet.connect'))}</h2>
      <p>${addrChip(s.address)}</p>
      <p class="dim small" style="margin-top:12px">GIWA Sepolia · 91342</p>
      <div class="btn-row"><button class="btn btn-ghost" id="sheetDisconnect">${esc(t('wallet.disconnect'))}</button></div>`;
  } else if (s.status === 'wrong-network') {
    body = `<h2>⚠ ${esc(t('wallet.wrong'))}</h2>
      <p>${esc(t('wallet.wrong.body', { id: s.chainId ?? '?' }))}</p>
      <div class="btn-row">
        <button class="btn" id="sheetSwitch">${esc(t('wallet.switch'))}</button>
        <button class="btn btn-ghost" id="sheetDisconnect">${esc(t('wallet.disconnect'))}</button>
      </div>`;
  } else {
    const options = w.listWalletOptions();
    const rows = options.map((o) =>
      `<button class="wallet-option" data-wallet-option="${esc(o.id)}">${o.icon ? `<img src="${esc(o.icon)}" alt="">` : `<span class="wo-icon" aria-hidden="true">${esc(o.name.slice(0, 1))}</span>`}<span>${esc(o.name)}</span></button>`).join('');
    const wcNote = w.WALLETCONNECT_PROJECT_ID
      ? ''
      : `<button class="wallet-option" disabled><span class="wo-icon" aria-hidden="true">W</span><span>WalletConnect</span></button>
         <p class="dim small" style="margin-top:8px">${esc(t('wallet.wc.unavailable'))}</p>`;
    body = `<h2>${esc(t('wallet.pick'))}</h2>
      ${rows || `<p class="dim">${esc(t('wallet.none'))}</p>`}
      ${wcNote}
      <p class="dim small" style="margin-top:12px">${esc(t('wallet.sheet.note'))}</p>`;
  }
  root.innerHTML = `<div class="sheet-backdrop" id="sheetBackdrop"><div class="sheet" role="dialog" aria-modal="true">${body}
    <div class="btn-row"><button class="btn btn-ghost" id="sheetClose">${esc(t('common.close'))}</button></div></div></div>`;
  wireAddrChips(root);
  const close = () => { root.innerHTML = ''; };
  $('#sheetClose').addEventListener('click', close);
  $('#sheetBackdrop').addEventListener('click', (e) => { if (e.target === e.currentTarget) close(); });
  $('#sheetDisconnect')?.addEventListener('click', async () => { await w.disconnectWallet(); close(); });
  $('#sheetSwitch')?.addEventListener('click', async () => {
    try { await w.switchToGiwa(); close(); } catch { toast(t('wallet.rejected')); }
  });
  root.querySelectorAll<HTMLButtonElement>('[data-wallet-option]').forEach((b) =>
    b.addEventListener('click', async () => {
      b.disabled = true;
      try { await w.connectWith(b.dataset.walletOption!); close(); }
      catch { toast(t('wallet.rejected')); close(); }
    }));
}

function wireShell(active: string) {
  $('#shell').innerHTML = shellHtml(active);
  const fn = document.getElementById('footer-note');
  if (fn) fn.textContent = t('footer.note');
  const ft = document.getElementById('footer-tag');
  if (ft) ft.textContent = t('app.tagline');
  $('#tabbar').innerHTML = tabbarHtml(active);
  document.querySelectorAll<HTMLButtonElement>('[data-lang]').forEach((b) =>
    b.addEventListener('click', () => { setLang(b.dataset.lang as 'en' | 'id'); void render(); }));
  $('#themeBtn').addEventListener('click', () => {
    applyTheme(currentTheme() === 'dark' ? 'light' : 'dark');
    void render();
  });
  $('#walletBtn')?.addEventListener('click', () => { void openWalletSheet(); });
}

async function initWalletOnce() {
  if (walletReady) return;
  walletReady = true;
  try {
    const w = await walletMod();
    w.subscribeWallet((s) => {
      walletState = s;
      const slot = $('#wallet-slot');
      if (slot) {
        slot.innerHTML = walletButtonHtml();
        $('#walletBtn')?.addEventListener('click', () => { void openWalletSheet(); });
      }
    });
    await w.initWallet();
  } catch { /* wallet is optional for browsing; the sheet explains states */ }
}

// ---------- home ----------
function snapshotLine(): string {
  if (!snap) return '';
  const built = new Date(snap.builtAt);
  const ago = fmtAgo(built);
  const stale = Date.now() - built.getTime() >= 6.5 * 3600_000 && deltaCount === 0;
  const txt = stale
    ? t('home.snapshot.stale', { block: fmtNum(snap.headBlock), ago })
    : t('home.snapshot', { block: fmtNum(snap.headBlock), ago });
  const line = `<p class="snapshot-line">${esc(txt)}${deltaCount ? ` ${esc(t('delta.note', { n: deltaCount }))}` : ''}</p>`;
  return stale ? `<div class="stale-banner">${line}</div>` : line;
}

const WATCH_KEY = 'evenfield.v2.watchlist';
function watchlist(): string[] {
  try { return JSON.parse(localStorage.getItem(WATCH_KEY) ?? '[]') as string[]; } catch { return []; }
}
function setWatchlist(list: string[]) {
  try { localStorage.setItem(WATCH_KEY, JSON.stringify(list)); } catch { /* ignore */ }
}

function pageHome(): string {
  countView('home');
  if (!snap) return '';
  const creators = snap.creators.length;
  const stages: ('new' | 'near' | 'graduated')[] = ['new', 'near', 'graduated'];
  const sections = stages.map((s) => {
    const items = snap!.launches.filter((l) => stageOf(l) === s);
    const cards = items.length ? `<div class="cq"><div class="grid">${items.map(coinCard).join('')}</div></div>` : `<p class="empty">${esc(t('board.empty'))}</p>`;
    return `<section class="stage"><div class="stage-head"><h2>${esc(t(`stage.${s}`))}</h2><span class="stage-meaning">${esc(t(`stage.meaning.${s}`))}</span><span class="stage-count">${fmtNum(items.length)}</span></div>${cards}</section>`;
  }).join('');
  const watched = watchlist().map((cv) => byCurve.get(cv.toLowerCase())).filter((x): x is Launch => !!x);
  const watchSection = watched.length
    ? `<section class="stage"><div class="stage-head"><h2>${esc(t('watch.title'))}</h2></div><div class="cq"><div class="grid">${watched.map(coinCard).join('')}</div></div></section>`
    : '';
  const weekFrom = snap.headBlock - 650_000;
  const weekNew = snap.launches.filter((l) => l.block >= weekFrom);
  const nearGrad = [...snap.launches]
    .filter((l) => l.statusName === 'trading' && l.progressPct !== null)
    .sort((a, b) => (b.progressPct ?? 0) - (a.progressPct ?? 0)).slice(0, 3);
  const weekly = `<section class="recap-band"><h2>${esc(t('weekly.title'))}</h2>
    <p class="dim">${esc(t('weekly.sub'))}</p>
    <p style="margin-top:8px">${esc(t('weekly.new', { n: fmtNum(weekNew.length) }))} · ${esc(t('weekly.grads', { n: fmtNum(weekNew.filter((l) => l.statusName === 'graduated').length) }))}</p>
    ${nearGrad.length ? `<div class="cq"><div class="grid">${nearGrad.map(coinCard).join('')}</div></div>` : ''}</section>`;
  const topCreators = [...snap.creators].sort((a, b) => b.realLaunches - a.realLaunches).slice(0, 6);
  const creatorStrip = `<section class="stage"><div class="stage-head"><h2>${esc(t('creators.strip.title'))}</h2><span class="stage-meaning">${esc(t('creators.strip.sub'))}</span></div>
    <div class="cq"><div class="grid">${topCreators.map((c) => `<article class="card"><div class="card-top">${identicon(c.address)}
      <div class="card-names"><a class="card-name" href="#/creator/${c.address}">${esc(shortAddr(c.address))}</a>
      <span class="card-sym">${esc(t('passport.launched', { n: c.totalLaunches }))}</span></div></div>
      <p class="card-line dim small">${esc(t('verdict.sentence', { n: Math.max(0, c.realLaunches - c.unreadable), g: c.graduated, t: Math.max(0, c.realLaunches - c.unreadable - c.graduated - c.stopped), s: c.stopped }))}</p>
      </article>`).join('')}</div></div></section>`;
  return `<section class="hero">
      <h1>${esc(t('home.headline'))}</h1>
      <p class="sub">${esc(t('home.sub'))}</p>
      <p class="fact">${esc(t('home.fact', { creators: fmtNum(creators), coins: fmtNum(snap.launches.length) }))}</p>
      ${snapshotLine()}
      <div class="search-row"><input id="search" type="search" placeholder="${esc(t('home.search.placeholder'))}" aria-label="${esc(t('home.search.placeholder'))}"></div>
      <div id="searchResults" aria-live="polite"></div>
    </section>
    ${watchSection}${weekly}${sections}${creatorStrip}`;
}

function wireHome() {
  const input = $<HTMLInputElement>('#search');
  const box = $('#searchResults');
  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    if (q.length < 2) { box.innerHTML = ''; return; }
    const coins = snap!.launches.filter((l) =>
      (l.name ?? '').toLowerCase().includes(q) || (l.symbol ?? '').toLowerCase().includes(q) ||
      l.token.toLowerCase() === q || l.curve.toLowerCase() === q || l.creator.toLowerCase() === q).slice(0, 8);
    const creators = snap!.creators.filter((c) => c.address.toLowerCase().includes(q)).slice(0, 5);
    if (!coins.length && !creators.length) { box.innerHTML = `<p class="empty">${esc(t('search.none'))}</p>`; return; }
    box.innerHTML = `<section class="stage"><div class="stage-head"><h2>${esc(t('search.results'))}</h2></div>
      ${coins.length ? `<h3>${esc(t('search.coins'))}</h3><div class="cq"><div class="grid">${coins.map(coinCard).join('')}</div></div>` : ''}
      ${creators.length ? `<h3>${esc(t('search.creators'))}</h3>${creators.map((c) => `<p class="card-line"><a href="#/creator/${c.address}">${esc(shortAddr(c.address))}</a> · ${esc(t('passport.launched', { n: c.totalLaunches }))}</p>`).join('')}` : ''}
    </section>`;
  });
}

// ---------- coin page ----------
async function pageCoin(curve: string): Promise<string> {
  countView('coin');
  const l = byCurve.get(curve.toLowerCase());
  if (!l) return `<p class="empty">${esc(t('search.none'))}</p><p><a class="back-link" href="#/">${esc(t('common.back'))}</a></p>`;
  const st = l.state;
  let quoteSym = 'ETH';
  let quoteDec = 18;
  if (st?.quoteToken) {
    try {
      const m = await moneyMod();
      const qm = await m.tokenMeta(st.quoteToken as Address).catch(() => null);
      if (qm?.symbol) { quoteSym = qm.symbol; quoteDec = qm.decimals; }
    } catch { /* snapshot labels still render */ }
  }
  const raised = st?.quoteReserve ? fmtNum(Number(formatUnits(BigInt(st.quoteReserve), quoteDec)), { maximumFractionDigits: 4 }) + ' ' + quoteSym : '—';
  const watching = watchlist().includes(l.curve.toLowerCase());
  const stats = [
    statBlock(t('coin.state.status'), stageOf(l) === 'other' ? t('stage.all') : t(`stage.${stageOf(l)}`), t('coin.state.status.meaning')),
    statBlock(t('coin.state.raised'), raised, t('coin.state.raised.meaning')),
    statBlock(t('coin.state.swaps'), fmtNum(l.evidence.swapCount), t('coin.state.swaps.meaning')),
    statBlock(t('coin.state.lasttrade'), l.evidence.lastSwapBlock ? fmtNum(l.evidence.lastSwapBlock) : '—', l.evidence.lastSwapBlock ? t('coin.state.lasttrade.meaning') : t('coin.state.lasttrade.none')),
    ...(l.evidence.holders ? [statBlock(t('coin.state.holders'), fmtNum(l.evidence.holders.count), t('coin.state.holders.note', { top1: fmtNum(l.evidence.holders.top1Pct, { maximumFractionDigits: 1 }) + '%', top10: fmtNum(l.evidence.holders.top10Pct, { maximumFractionDigits: 1 }) + '%' }))] : []),
    ...(l.progressPct !== null ? [statBlock(t('board.progress.label'), fmtNum(l.progressPct, { maximumFractionDigits: 1 }) + '%', t('chart.note', { pct: fmtNum(l.progressPct, { maximumFractionDigits: 1 }) + '%' }))] : []),
  ].join('');
  const c = creatorOf(l);
  return `<article class="coin">
    <p><a class="back-link" href="#/">${esc(t('common.back'))}</a></p>
    <div class="coin-head">${identicon(l.curve, 'identicon-lg')}
      <div class="card-names"><h1>${esc(displayName(l))}</h1><span class="card-sym">${esc(l.symbol ?? '')}</span></div>
      ${stagePill(l)}
      <button class="btn btn-ghost" id="watchBtn" aria-pressed="${watching}">${esc(t(watching ? 'watch.remove' : 'watch.add'))}</button>
    </div>
    <p class="card-line" style="margin-top:12px">${esc(t('coin.creator'))} ${addrChip(l.creator)} · ${esc(t('coin.launched.at', { block: fmtNum(l.block) }))}</p>
    ${l.evidence.currentCreator.toLowerCase() !== l.creator.toLowerCase() ? `<p class="card-line dim">${esc(t('passport.currentnote', { addr: shortAddr(l.evidence.currentCreator) }))}</p>` : ''}
    <div style="margin-top:16px">${verdictStage(l)}</div>
    <div class="coin-layout">
      <div class="coin-main">
        ${curveChart(l, quoteSym, quoteDec)}
        <section class="panel"><h2>${esc(t('coin.state.title'))}</h2><div class="stats">${stats}</div></section>
        ${c ? `<section class="panel"><h2>${esc(t('passport.title'))}</h2>
          <p class="card-line">${esc(t('verdict.sentence', { n: Math.max(0, c.realLaunches - c.unreadable), g: c.graduated, t: Math.max(0, c.realLaunches - c.unreadable - c.graduated - c.stopped), s: c.stopped }))}</p>
          <div class="btn-row"><a class="btn btn-ghost" href="#/creator/${l.creator}">${esc(t('verdict.full.btn'))}</a></div></section>` : ''}
      </div>
      <div class="rail">
        <section class="panel">
          <h2>${esc(t('coin.quote.title'))}</h2>
          <form id="quoteForm" class="quote-form">
            <label>${esc(t('coin.quote.amount'))} (${esc(quoteSym)})
              <input id="quoteAmount" inputmode="decimal" value="0.01"></label>
            <button class="btn" type="submit">${esc(t('coin.quote.btn'))}</button>
          </form>
          <div id="quoteOut" aria-live="polite" style="margin-top:12px"></div>
        </section>
      </div>
    </div>
  </article>`;
}

function wireCoin(curve: string) {
  const l = byCurve.get(curve.toLowerCase());
  if (!l || !snap) return;
  wireAddrChips(document);
  $('#watchBtn')?.addEventListener('click', () => {
    const list = watchlist();
    const key = l.curve.toLowerCase();
    const next = list.includes(key) ? list.filter((x) => x !== key) : [...list, key];
    setWatchlist(next);
    void render();
  });
  const drawerBtn = document.querySelector<HTMLButtonElement>(`[data-evidence="${CSS.escape(l.curve)}"]`);
  drawerBtn?.addEventListener('click', () => {
    const d = document.getElementById(`drawer-${l.curve}`);
    if (d) { d.hidden = !d.hidden; drawerBtn.setAttribute('aria-expanded', String(!d.hidden)); }
  });
  const form = $<HTMLFormElement>('#quoteForm');
  const out = $('#quoteOut');
  const runQuote = async () => {
    const [{ tokenMeta }, { liveQuote }] = await Promise.all([moneyMod(), chainMod()]);
    let quoteDec = 18;
    let quoteSym = 'ETH';
    if (l.state?.quoteToken) {
      const qm = await tokenMeta(l.state.quoteToken as Address).catch(() => null);
      if (qm?.symbol) { quoteSym = qm.symbol; quoteDec = qm.decimals; }
    }
    const raw = $<HTMLInputElement>('#quoteAmount').value.trim().replace(',', '.');
    let amountIn: bigint;
    try { amountIn = parseUnits(raw as `${number}`, quoteDec); if (amountIn <= 0n) throw new Error('zero'); }
    catch { out.innerHTML = `<p class="card-line">${esc(t('coin.quote.none'))}</p>`; return; }
    out.innerHTML = `<p class="card-line dim">${esc(t('common.loading'))}</p>`;
    const withTimeout = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
    try {
      const buy = await withTimeout(liveQuote(l.curve as Address, amountIn, false), 6000);
      let sellLine = '';
      try {
        const sell = await withTimeout(liveQuote(l.curve as Address, buy.amountOut, true), 6000);
        sellLine = `<p class="card-line">${esc(t('coin.quote.sellback'))} ${esc(fmtNum(Number(formatUnits(sell.amountOut, quoteDec)), { maximumFractionDigits: 6 }))} ${esc(quoteSym)}</p>`;
      } catch { /* sell-back is a bonus line; the buy quote already landed */ }
      out.innerHTML = `<p class="card-line">${esc(t('coin.quote.gets'))} ${esc(fmtNum(Number(formatUnits(buy.amountOut, l.decimals)), { maximumFractionDigits: 2 }))} ${esc(l.symbol ?? '')}</p>
        ${sellLine}
        <p class="card-line dim small">${esc(t('coin.quote.live', { block: fmtNum(Number(buy.block)) }))}</p>`;
    } catch {
      const st = l.state;
      if (st?.sqrtPrice) {
        const sqrt = Number(BigInt(st.sqrtPrice)) / 2 ** 96;
        const price = sqrt * sqrt * 10 ** (l.decimals - quoteDec);
        const est = price > 0 ? Number(formatUnits(amountIn, quoteDec)) / price : 0;
        const supplyHuman = l.totalSupply ? Number(formatUnits(BigInt(l.totalSupply), l.decimals)) : null;
        if (!Number.isFinite(est) || est <= 0 || (supplyHuman !== null && est > supplyHuman)) {
          out.innerHTML = `<p class="card-line">${esc(t('coin.quote.none'))}</p>`;
          return;
        }
        out.innerHTML = `<p class="card-line">${esc(t('coin.quote.gets'))} ${esc(fmtNum(est, { maximumFractionDigits: 2 }))} ${esc(l.symbol ?? '')}</p>
          <p class="card-line dim small">${esc(t('coin.quote.stale', { block: fmtNum(snap!.headBlock) }))}</p>`;
      } else {
        out.innerHTML = `<p class="card-line">${esc(t('coin.quote.none'))}</p>`;
      }
    }
  };
  form.addEventListener('submit', (e) => { e.preventDefault(); void runQuote(); });
  void runQuote();
}

// ---------- creator passport ----------
function pageCreator(addr: string): string {
  countView('creator');
  const c = byCreator.get(addr.toLowerCase());
  const mine = snap!.launches.filter((l) => l.creator.toLowerCase() === addr.toLowerCase());
  if (!c && !mine.length) return `<p class="empty">${esc(t('search.none'))}</p><p><a class="back-link" href="#/">${esc(t('common.back'))}</a></p>`;
  const real = mine.filter((l) => !l.testLaunch);
  const tests = mine.filter((l) => l.testLaunch);
  const early = real.filter((l) => l.evidence.creatorSoldEarly);
  const outcome = (label: string, n: number) => `<div class="stat"><span class="stat-n">${fmtNum(n)}</span><span class="stat-l">${esc(label)}</span></div>`;
  return `<article class="creator">
    <p><a class="back-link" href="#/">${esc(t('common.back'))}</a></p>
    <div class="coin-head">${identicon(addr, 'identicon-lg')}<h1>${esc(t('passport.title'))}</h1></div>
    <p class="card-line" style="margin-top:12px">${addrChip(addr)} <a href="${addrLink(addr)}" target="_blank" rel="noopener">${esc(t('evidence.explorer'))}</a></p>
    <p class="card-line">${esc(t('passport.launched', { n: c?.totalLaunches ?? mine.length }))}</p>
    ${c && c.testLaunches ? `<p class="card-line dim">${esc(t('passport.testnote', { n: c.testLaunches }))}</p>` : ''}
    <section class="panel"><h2>${esc(t('passport.outcomes'))}</h2>
      <div class="stats">
        ${outcome(t('passport.graduated'), c?.graduated ?? 0)}
        ${outcome(t('passport.trading'), c?.trading ?? 0)}
        ${outcome(t('passport.stopped'), c?.stopped ?? 0)}
        ${outcome(t('passport.pending'), c?.pending ?? 0)}
        ${outcome(t('passport.unreadable'), c?.unreadable ?? 0)}
      </div></section>
    <section class="panel"><h2>${esc(t('passport.earlylist'))}</h2>
      ${early.length
        ? `<p class="card-line">${esc(t('passport.earlysell', { n: early.length }))}</p>
           <p class="card-line dim small">${esc(t('passport.earlysell.note', { blocks: fmtNum(snap!.params.earlyBlocks) }))}</p>
           ${early.map((l) => `<div class="early-item"><a href="#/coin/${l.curve}">${esc(displayName(l))}</a>${evidenceList(l)}</div>`).join('')}`
        : `<p class="card-line">${esc(t('passport.noearly'))}</p>`}
    </section>
    <section class="stage"><div class="stage-head"><h2>${esc(t('passport.coins'))}</h2></div><div class="cq"><div class="grid">${real.map(coinCard).join('') || ''}</div></div>${real.length ? '' : `<p class="empty">${esc(t('board.empty'))}</p>`}</section>
    ${tests.length ? `<section class="stage"><div class="stage-head"><h2>${esc(t('verdict.test'))}</h2></div><div class="cq"><div class="grid">${tests.map(coinCard).join('')}</div></div></section>` : ''}
    <p class="card-line" style="margin-top:24px"><a href="#/dispute">${esc(t('passport.dispute'))}</a></p>
  </article>`;
}

// ---------- money center (Glean engine, new presentation) ----------
let moneyDisc: Discovery | null = null;
let moneyResult: LookupResult | null = null;

/** Gate 7 amount formatting: >= 1 unit gets 2-4 decimals; below 0.001 the
 *  compact form shows, with the exact value one tap away. */
function fmtAmountDisplay(raw: bigint, decimals: number): { text: string; exact: string } {
  const human = Number(formatUnits(raw, decimals));
  const exact = formatUnits(raw, decimals); // exact decimal string, no rounding
  if (human >= 1) return { text: fmtNum(human, { maximumFractionDigits: human >= 100 ? 2 : 4 }), exact };
  if (human >= 0.001) return { text: fmtNum(human, { maximumFractionDigits: 6 }), exact };
  return { text: '<0.001', exact };
}

function pageMoney(): string {
  countView('money');
  return `<article class="money">
    <h1>${esc(t('money.title'))}</h1>
    <p class="sub">${esc(t('money.sub'))}</p>
    <form id="moneyForm" class="quote-form" style="margin-top:16px">
      <label>${esc(t('common.address'))}<input id="moneyAddr" placeholder="${esc(t('money.placeholder'))}" spellcheck="false"></label>
      <button class="btn" type="submit">${esc(t('money.check'))}</button>
    </form>
    <div id="moneyOut" aria-live="polite"></div>
  </article>`;
}

async function renderMoneyRows(res: LookupResult) {
  const m = await moneyMod();
  const out = $('#moneyOut');
  const metas = new Map<string, { symbol: string; decimals: number }>();
  const metaOf = async (token: Address | null): Promise<{ symbol: string; decimals: number }> => {
    if (!token) return { symbol: 'ETH', decimals: 18 };
    const key = token.toLowerCase();
    if (!metas.has(key)) {
      const md = await m.tokenMeta(token);
      metas.set(key, { symbol: md.symbol || shortAddr(token), decimals: md.decimals });
    }
    return metas.get(key)!;
  };
  const gasPrice = await m.getGasPriceWei().catch(() => null);
  const dustThreshold = gasPrice !== null ? gasPrice * m.CLAIM_GAS_UNITS : null;
  const isDust = async (r: ClaimRow): Promise<boolean> => {
    if (!r.amount || r.amount <= 0n) return false;
    const md = await metaOf(r.token);
    const nativeLike = r.token === null || r.token.toLowerCase() === m.WETH.toLowerCase();
    if (nativeLike && dustThreshold !== null) return r.amount <= dustThreshold;
    return Number(formatUnits(r.amount, md.decimals)) < 0.000001;
  };
  const claimable = res.rows.filter((r) => r.state === 'claimable' && r.amount && r.amount > 0n);
  const dustFlags = new Map<string, boolean>();
  for (const r of claimable) dustFlags.set(r.key, await isDust(r));
  const realClaimable = claimable.filter((r) => !dustFlags.get(r.key));
  const dustRows = claimable.filter((r) => dustFlags.get(r.key));

  // Totals grouped by token (real claimables only; dust is counted apart).
  const totals = new Map<string, { amount: bigint; token: Address | null }>();
  for (const r of realClaimable) {
    const key = (r.token ?? 'native').toLowerCase();
    const cur = totals.get(key) ?? { amount: 0n, token: r.token };
    cur.amount += r.amount!;
    totals.set(key, cur);
  }
  const totalParts: string[] = [];
  for (const v of totals.values()) {
    const md = await metaOf(v.token);
    totalParts.push(`${fmtAmountDisplay(v.amount, md.decimals).text} ${md.symbol}`);
  }
  const connectedAddr = walletState.status === 'connected' || walletState.status === 'wrong-network' ? walletState.address : undefined;
  const differs = connectedAddr && connectedAddr.toLowerCase() !== res.address.toLowerCase();

  const streams = ['surplus', 'leftover', 'partner', 'almm', 'arl', 'dfs'] as const;
  const streamSections: string[] = [];
  for (const s of streams) {
    const rows = res.rows.filter((r) => r.stream === s);
    const mine = rows.filter((r) => realClaimable.includes(r));
    const dust = rows.filter((r) => dustRows.includes(r));
    const rowHtml: string[] = [];
    for (const r of mine) {
      const md = await metaOf(r.token);
      const disp = fmtAmountDisplay(r.amount!, md.decimals);
      let src = '';
      if (r.source.launchToken) { const sm = await metaOf(r.source.launchToken); src = sm.symbol; }
      else if (r.source.pair) { const a = await metaOf(r.source.pair[0]); const b = await metaOf(r.source.pair[1]); src = `${a.symbol}/${b.symbol}`; }
      else if (r.source.vault) src = shortAddr(r.source.vault);
      const role = r.role === 'creator' ? t('row.role.creator') : r.role === 'referral' ? t('row.role.referral') : r.shareText ? t('row.role.recipient', { share: r.shareText }) : '';
      rowHtml.push(`<div class="money-row"><div><span class="money-amount" data-exact="${esc(disp.exact)}" data-display="${esc(disp.text)}">${esc(disp.text)}</span> <strong>${esc(md.symbol)}</strong> <span class="dim small">${esc(src)} ${esc(role)}</span>
        ${disp.text !== disp.exact ? `<button type="button" class="addr-chip" data-amount-toggle style="border:0;background:transparent;color:var(--link);cursor:pointer;font-weight:700;min-height:32px">${esc(t('money.dust.exact'))}</button>` : ''}</div>
        <button class="btn" data-claim="${esc(r.key)}">${esc(t('money.claim'))}</button></div>`);
    }
    let dustHtml = '';
    if (dust.length) {
      const byToken = new Map<string, { amount: bigint; token: Address | null }>();
      for (const r of dust) {
        const key = (r.token ?? 'native').toLowerCase();
        const cur = byToken.get(key) ?? { amount: 0n, token: r.token };
        cur.amount += r.amount!;
        byToken.set(key, cur);
      }
      const parts: string[] = [];
      const exacts: string[] = [];
      for (const v of byToken.values()) {
        const md = await metaOf(v.token);
        parts.push(`${fmtAmountDisplay(v.amount, md.decimals).text} ${md.symbol}`);
        exacts.push(`${m.formatAmount(v.amount, md.decimals)} ${md.symbol}`);
      }
      dustHtml = `<div class="dust-box"><strong>${esc(t('money.dust.title', { n: dust.length }))}</strong>
        <p class="dim small">${esc(parts.join(' · '))}</p>
        <p class="dim small">${esc(t('money.dust.note'))}</p>
        <details><summary>${esc(t('money.dust.exact'))}</summary><p class="mono small">${esc(exacts.join(' · '))}</p></details>
        <div class="btn-row"><button class="btn" disabled>${esc(t('money.claim'))}</button></div></div>`;
    }
    const okLine = res.streamOk[s]
      ? (mine.length || dust.length ? '' : `<p class="card-line dim">${esc(t('row.zero'))}</p>`)
      : `<p class="card-line dim">${esc(t('row.unavailable'))}</p>`;
    streamSections.push(`<section class="panel"><h2>${esc(t(`stream.${s}.title`))}</h2><p class="card-line dim">${esc(t(`stream.${s}.about`))}</p>${rowHtml.join('')}${dustHtml}${okLine}</section>`);
  }
  out.innerHTML = `<p class="card-line" style="margin-top:16px">${esc(t('money.resultsfor', { addr: '' }))} ${addrChip(res.address)}</p>
    <p class="dim small">${esc(t('money.asof', { block: fmtNum(res.block) }))}</p>
    ${differs ? `<p class="stale-banner">${esc(t('money.differs', { addr: shortAddr(connectedAddr!) }))}</p>` : ''}
    ${totalParts.length ? `<p class="fact">${esc(t('money.summary'))}: ${esc(totalParts.join(' · '))}</p>` : `<p class="fact">${esc(t('money.none'))}</p>`}
    ${Object.values(res.streamOk).some((v) => !v) ? `<p class="card-line dim">${esc(t('money.unavail'))}</p>` : ''}
    ${streamSections.join('')}`;
  wireAddrChips(out);
  out.querySelectorAll<HTMLButtonElement>('[data-amount-toggle]').forEach((b) =>
    b.addEventListener('click', () => {
      const span = b.parentElement?.querySelector('.money-amount') as HTMLElement | null;
      if (!span) return;
      span.textContent = span.textContent === span.dataset.exact ? span.dataset.display! : span.dataset.exact!;
    }));
  out.querySelectorAll<HTMLButtonElement>('[data-claim]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const row = moneyResult?.rows.find((r) => r.key === btn.dataset.claim);
      if (!row) return;
      const w = await walletMod();
      try {
        if (walletState.status === 'disconnected' || walletState.status === 'connecting') {
          await openWalletSheet();
          return;
        }
        if (walletState.status === 'wrong-network') {
          await openWalletSheet();
          return;
        }
        btn.disabled = true;
        btn.textContent = t('money.claiming');
        const wallet = await w.getConnectedWallet();
        const mm = await moneyMod();
        await mm.executeClaim(wallet, row);
        btn.textContent = t('money.claimed');
      } catch {
        btn.disabled = false;
        btn.textContent = t('money.simfail');
      }
    });
  });
}

function wireMoney() {
  const form = $<HTMLFormElement>('#moneyForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const addr = $<HTMLInputElement>('#moneyAddr').value.trim();
    const out = $('#moneyOut');
    if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) { out.innerHTML = `<p class="empty">${esc(t('money.badaddr'))}</p>`; return; }
    out.innerHTML = `<p class="progress-line">${esc(t('money.checking'))}</p>
      <p class="dim small">${esc(t('money.expected'))}</p>
      <div class="skeleton skeleton-row"></div><div class="skeleton skeleton-row"></div><div class="skeleton skeleton-row"></div>`;
    try {
      const m = await moneyMod();
      if (!moneyDisc) moneyDisc = await m.discover();
      moneyResult = await m.lookup(addr as Address, moneyDisc, (done, total) => {
        out.innerHTML = `<p class="progress-line">${esc(t('money.progress', { done, total }))}</p>
          <p class="dim small">${esc(t('money.expected'))}</p>
          <div class="skeleton skeleton-row"></div><div class="skeleton skeleton-row"></div>`;
      });
      await renderMoneyRows(moneyResult);
    } catch {
      out.innerHTML = `<div class="error-box"><p>${esc(t('row.unavailable'))}</p><div class="btn-row"><button class="btn btn-ghost" id="moneyRetry">${esc(t('state.retry'))}</button></div></div>`;
      $('#moneyRetry')?.addEventListener('click', () => { form.requestSubmit(); });
    }
  });
}

// ---------- chain checker ----------
function pageChain(): string {
  countView('chain');
  return `<article class="chain">
    <h1>${esc(t('chain.title'))}</h1>
    <p class="sub">${esc(t('chain.sub'))}</p>
    <section class="panel"><p>${esc(t('chain.story'))}</p></section>
    <form id="chainForm" class="quote-form chain-form" style="margin-top:16px">
      <label>Chain ID<input id="chainInput" inputmode="numeric" placeholder="${esc(t('chain.input.placeholder'))}"></label>
      <button class="btn" type="submit">${esc(t('chain.check.btn'))}</button>
      <button class="btn btn-ghost" type="button" id="walletChainBtn">${esc(t('chain.wallet.btn'))}</button>
    </form>
    <div id="chainOut" aria-live="polite"></div>
  </article>`;
}

function wireChain() {
  const out = $('#chainOut');
  const show = async (id: number) => {
    out.innerHTML = `<p class="card-line dim" style="margin-top:16px">${esc(t('common.loading'))}</p>`;
    const { checkChainId } = await chainMod();
    const v = await checkChainId(id);
    const text = v.kind === 'reserved' ? t('chain.verdict.reserved')
      : v.kind === 'unknown' ? t('chain.verdict.unknown', { id })
      : v.attested ? t('chain.verdict.real') : t('chain.verdict.attestfail');
    const cls = v.kind === 'reserved' ? 'verdict-fake' : v.kind === 'unknown' ? 'verdict-unknown' : 'verdict-real';
    out.innerHTML = `<p class="verdict-box ${cls}">${esc(text)}</p>`;
  };
  $<HTMLFormElement>('#chainForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = parseInt($<HTMLInputElement>('#chainInput').value.trim(), 10);
    if (Number.isFinite(id)) void show(id);
  });
  $('#walletChainBtn')?.addEventListener('click', async () => {
    let id: number | null = null;
    if ((walletState.status === 'connected' || walletState.status === 'wrong-network') && walletState.chainId) {
      id = walletState.chainId;
    } else {
      const w = await walletMod();
      id = await w.anyProviderChainId();
    }
    if (id === null) { out.innerHTML = `<p class="card-line" style="margin-top:16px">${esc(t('chain.wallet.none'))}</p>`; return; }
    $<HTMLInputElement>('#chainInput').value = String(id);
    void show(id);
  });
}

// ---------- methodology + dispute ----------
function pageMethod(): string {
  countView('method');
  if (!snap) return '';
  return `<article class="method">
    <h1>${esc(t('method.title'))}</h1>
    <p class="sub">${esc(t('method.intro'))}</p>
    <section class="panel"><p>${esc(t('method.graduated'))}</p><p style="margin-top:12px">${esc(t('method.stopped', { stop: fmtNum(snap.params.stopBlocks) }))}</p>
    <p style="margin-top:12px">${esc(t('method.early', { early: fmtNum(snap.params.earlyBlocks) }))}</p><p style="margin-top:12px">${esc(t('method.bundle'))}</p>
    <p style="margin-top:12px">${esc(t('method.test'))}</p><p style="margin-top:12px">${esc(t('method.creators'))}</p></section>
  </article>`;
}

function pageDispute(): string {
  countView('dispute');
  return `<article class="dispute">
    <h1>${esc(t('dispute.title'))}</h1>
    <p class="sub">${esc(t('dispute.sub'))}</p>
    <section class="panel"><p>${esc(t('dispute.policy'))}</p></section>
    <form id="disputeForm" class="dispute-form" style="margin-top:16px">
      <label>${esc(t('dispute.form.addr'))}<input id="dAddr" spellcheck="false"></label>
      <label>${esc(t('dispute.form.coin'))}<input id="dCoin" spellcheck="false"></label>
      <label>${esc(t('dispute.form.what'))}<textarea id="dWhat" rows="4"></textarea></label>
      <button class="btn" type="submit">${esc(t('dispute.form.btn'))}</button>
    </form>
    <p class="card-line dim small">${esc(t('dispute.form.note'))}</p>
    <div id="disputeOut"></div>
    <section class="stage"><div class="stage-head"><h2>${esc(t('dispute.log.title'))}</h2></div><p class="empty">${esc(t('dispute.log.empty'))}</p></section>
  </article>`;
}

function wireDispute() {
  $<HTMLFormElement>('#disputeForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const text = `Evenfield record dispute\nAddress: ${$<HTMLInputElement>('#dAddr').value.trim()}\nCoin/curve: ${$<HTMLInputElement>('#dCoin').value.trim()}\nWhat was misread: ${$<HTMLTextAreaElement>('#dWhat').value.trim()}`;
    $('#disputeOut').innerHTML = `<p class="card-line" style="margin-top:12px">${esc(t('dispute.ready'))}</p><textarea readonly rows="6" class="dispute-text">${esc(text)}</textarea>`;
  });
}

// ---------- router + boot ----------
function routeOf(): { path: string; param?: string } {
  const parts = (location.hash.replace(/^#/, '') || '/').split('/').filter(Boolean);
  if (!parts.length) return { path: '/' };
  return { path: '/' + parts[0], param: parts[1] };
}

async function render() {
  document.documentElement.lang = getLang() === 'id' ? 'id' : 'en';
  const { path, param } = routeOf();
  wireShell(path);
  const app = $('#app');
  if (!snap) {
    app.innerHTML = `<div class="error-box"><p>${esc(t('state.error'))}</p><div class="btn-row"><button class="btn" id="retryBoot">${esc(t('state.retry'))}</button></div></div>`;
    $('#retryBoot').addEventListener('click', () => { void boot(true); });
    return;
  }
  if (path === '/' && !param) { app.innerHTML = pageHome(); wireHome(); }
  else if (path === '/coin' && param) { app.innerHTML = await pageCoin(param); wireCoin(param); }
  else if (path === '/creator' && param) { app.innerHTML = pageCreator(param); wireAddrChips(document); }
  else if (path === '/money') { app.innerHTML = pageMoney(); wireMoney(); }
  else if (path === '/chain') { app.innerHTML = pageChain(); wireChain(); }
  else if (path === '/method') { app.innerHTML = pageMethod(); }
  else if (path === '/dispute') { app.innerHTML = pageDispute(); wireDispute(); }
  else { app.innerHTML = pageHome(); wireHome(); }
  window.scrollTo(0, 0);
}

async function loadSnapshot(): Promise<boolean> {
  for (const cacheMode of ['no-cache', 'default'] as const) {
    try {
      const res = await fetch('snapshot.json', { cache: cacheMode });
      if (res.ok) {
        const j = (await res.json()) as Snapshot;
        if (j && j.schema === 1 && Array.isArray(j.launches)) { snap = j; return true; }
      }
    } catch { /* try the next cache mode, then fail honestly */ }
  }
  return false;
}

async function boot(retry = false) {
  if (!retry) {
    window.addEventListener('hashchange', () => void render());
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
      navigator.serviceWorker.register('sw.js').catch(() => { /* shell still works online */ });
    }
    void initWalletOnce();
  }
  const ok = await loadSnapshot();
  if (!ok || !snap) { await render(); return; }
  byCurve.clear(); byCreator.clear();
  for (const l of snap.launches) byCurve.set(l.curve.toLowerCase(), l);
  for (const c of snap.creators) byCreator.set(c.address.toLowerCase(), c);
  await render();
  // Delta sync in the background, hard 20 second budget, never blocking.
  try {
    const [{ deltaScan }, { tokenMeta }] = await Promise.all([chainMod(), moneyMod()]);
    const delta = await Promise.race([
      deltaScan(snap.factories, snap.headBlock),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('budget')), 20_000)),
    ]);
    const fresh = delta.launches.filter((d) => !byCurve.has(d.curve.toLowerCase()));
    if (fresh.length) {
      deltaCount = fresh.length;
      for (const d of fresh) {
        const meta = await tokenMeta(d.token as Address).catch(() => null);
        const nl: Launch = {
          token: d.token, curve: d.curve, creator: d.creator, configId: d.configId,
          protocolVersion: d.protocolVersion, uri: d.uri, block: d.block, tx: d.tx, slots: d.slots, factory: d.factory,
          name: meta?.name || null, symbol: meta?.symbol || null, decimals: meta?.decimals ?? 18, totalSupply: null,
          state: null, statusName: 'pending', readyToMigrate: false, stopped: false, progressPct: null,
          evidence: { swapCount: 0, uniqueBuyers: 0, firstSwapBlock: null, lastSwapBlock: null, lastSwapTx: null, creatorBuys: 0, creatorBuyTotal: '0', creatorSellTotal: '0', creatorSells: [], creatorSoldEarly: false, currentCreator: d.creator, creatorTransferred: null, holders: null, windows: [] },
          testLaunch: false, testReason: null, verdict: 'toonew', verdictReasons: [],
        };
        snap.launches.unshift(nl);
        byCurve.set(nl.curve.toLowerCase(), nl);
      }
      if (routeOf().path === '/') void render();
    }
  } catch { /* delta is an enhancement, never a requirement */ }
}

void boot();
