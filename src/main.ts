// Evenfield: the whole Ammora launch day in one place.
// Perfection pass 3.1.0 (redesign/perfection-audit.md, skill Gate 17)
// on top of the 3.0.0 usability rebuild (Gates 13-16): verdicts are
// calibrated to tiered early-sell bands with meanings generated from
// each coin's own measured values and a reachable positive tier,
// cards are signal-first (snapshot price, activity sparkline, one
// fact, meaning behind "Why"), zero-count presets are status text,
// the money summary is plain words, and wide desktops get a true
// sortable dense table.
// the board leads with a one-line promise and a working filter system
// (six one-tap presets, cross-counted facets, safe defaults that hide
// protocol test launches and stopped coins), verdicts render in three
// parts (label, key fact, what it means for you) with the creator named
// on the card, the money center checks a connected wallet on arrival
// and summarises in plain words before any panel, and every user-facing
// time is relative (block heights live only in the evidence drawer).
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
  creatorSoldEarly: boolean; earlySellPct: number | null; activitySpark: number[];
  currentCreator: string; creatorTransferred: { tx: string; block: number } | null;
  holders: { count: number; top1Pct: number; top10Pct: number; windowed: boolean } | null;
  windows: [number, number][];
}
interface SnapshotPrice { perTokenWeth: string; block: number; amountIn: string; amountOut: string }
interface Launch {
  token: string; curve: string; creator: string; configId: string;
  protocolVersion: number; uri: string; block: number; tx: string; slots: string[]; factory: string;
  name: string | null; symbol: string | null; decimals: number; totalSupply: string | null;
  state: CurveState | null; statusName: string; readyToMigrate?: boolean; stopped: boolean; progressPct: number | null;
  evidence: Evidence; testLaunch: boolean; testReason: string | null;
  price: SnapshotPrice | null;
  verdict: string; verdictReasons: { kind: string;[k: string]: unknown }[];
}
interface CreatorRec {
  address: string; totalLaunches: number; testLaunches: number; realLaunches: number;
  graduated: number; trading: number; stopped: number; pending: number; unreadable: number;
  earlySellCount: number; earlySellLaunches: string[];
  effectiveEarlySellCount?: number; effectiveEarlySellLaunches?: string[]; tradeCount?: number;
  firstLaunchBlock: number; lastLaunchBlock: number;
}
interface Snapshot {
  schema: number; builtAt: string; headBlock: number; chainId: number;
  params: { stopBlocks: number; earlyBlocks: number; earlyBandBPct?: number; earlyBandCPct?: number };
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

// ---------- relative time ----------
// Measured on this chain (17 Nov 2026): exactly 1.0 s per block (20,000
// blocks = 20,000 s between two live head reads). Users think in hours
// and days, so every surface time is derived from the block distance to
// the snapshot head; raw block heights appear only in the evidence
// drawer, where they are receipt data.
function blockDate(block: number): Date {
  if (!snap) return new Date();
  return new Date(new Date(snap.builtAt).getTime() + (block - snap.headBlock) * 1000);
}
function agoOfBlock(block: number | null): string {
  if (block === null) return '';
  return fmtAgo(blockDate(block));
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

// ---------- watchlist + recents ----------
const WATCH_KEY = 'evenfield.v2.watchlist';
function watchlist(): string[] {
  try { return JSON.parse(localStorage.getItem(WATCH_KEY) ?? '[]') as string[]; } catch { return []; }
}
function setWatchlist(list: string[]) {
  try { localStorage.setItem(WATCH_KEY, JSON.stringify(list)); } catch { /* ignore */ }
}
function toggleWatch(curve: string): boolean {
  const key = curve.toLowerCase();
  const list = watchlist();
  const next = list.includes(key) ? list.filter((x) => x !== key) : [...list, key];
  setWatchlist(next);
  return next.includes(key);
}
interface Recent { kind: 'coin' | 'creator'; id: string; label: string }
const RECENTS_KEY = 'evenfield.v3.recents';
function recents(): Recent[] {
  try { return JSON.parse(localStorage.getItem(RECENTS_KEY) ?? '[]') as Recent[]; } catch { return []; }
}
function pushRecent(r: Recent) {
  try {
    const list = [r, ...recents().filter((x) => !(x.kind === r.kind && x.id.toLowerCase() === r.id.toLowerCase()))].slice(0, 6);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(list));
  } catch { /* ignore */ }
}

// ---------- verdicts (v3.1: calibrated bands + reachable positive tier) ----------
// Perfection audit P-1/F-1, definitions published on the methodology
// page: an early sell counts only when it is at least 1% of what the
// creator bought on that curve (band B 1-25%, band C over 25%); under
// 1% (band A) is a neutral fact with no chip and no caution wording.
// The positive tier "No red flags found" requires a creator with at
// least one real launch, zero effective early sells, zero stopped
// coins, and this coin having a buyer or being graduated. Every fact
// and meaning line is generated from this coin's and this creator's
// measured values, never pasted from a kind-level template.
type VerdictKind = 'test' | 'unknown' | 'caution-early' | 'caution-stopped' | 'toonew' | 'clean';
function creatorOf(l: Launch): CreatorRec | undefined { return byCreator.get(l.creator.toLowerCase()); }
function displayName(l: Launch): string { return l.name || l.symbol || shortAddr(l.token); }

/** Launches by this creator that carry an effective (band B/C) early sell. */
function effectiveEarlyLaunches(c: CreatorRec | undefined): Launch[] {
  if (!snap || !c) return [];
  return snap.launches.filter((x) =>
    !x.testLaunch && x.creator.toLowerCase() === c.address.toLowerCase() && (x.evidence.earlySellPct ?? 0) >= 1);
}
function effectiveEarlyCount(c: CreatorRec | undefined): number {
  if (!c) return 0;
  if (typeof c.effectiveEarlySellCount === 'number') return c.effectiveEarlySellCount;
  return effectiveEarlyLaunches(c).length;
}
/** Total trades read across the creator's real launches. */
function creatorTradeCount(c: CreatorRec | undefined): number {
  if (!c) return 0;
  if (typeof c.tradeCount === 'number') return c.tradeCount;
  if (!snap) return 0;
  return snap.launches
    .filter((x) => !x.testLaunch && x.creator.toLowerCase() === c.address.toLowerCase())
    .reduce((s, x) => s + x.evidence.swapCount, 0);
}
function isPositiveTier(l: Launch, c: CreatorRec | undefined): boolean {
  return !!c && c.realLaunches >= 1 && effectiveEarlyCount(c) === 0 && c.stopped === 0
    && !l.stopped && (l.evidence.uniqueBuyers >= 1 || l.statusName === 'graduated');
}
function verdictKind(l: Launch): VerdictKind {
  if (l.testLaunch) return 'test';
  if (l.statusName === 'unreadable' || l.verdict === 'unknown') return 'unknown';
  const c = creatorOf(l);
  if ((l.evidence.earlySellPct ?? 0) >= 1 || effectiveEarlyCount(c) > 0) return 'caution-early';
  if (l.stopped || (c !== undefined && c.stopped > 0)) return 'caution-stopped';
  if (isPositiveTier(l, c)) return 'clean';
  return 'toonew';
}
const KIND_LABEL: Record<VerdictKind, string> = {
  test: 'verdict.test', unknown: 'verdict.unknown',
  'caution-early': 'verdict.caution.early', 'caution-stopped': 'verdict.caution.stopped',
  toonew: 'verdict.toonew', clean: 'verdict.clean',
};
const KIND_ICON: Record<VerdictKind, string> = { test: '⚗', unknown: '?', 'caution-early': '⚠', 'caution-stopped': '⚠', toonew: '◑', clean: '✓' };
const KIND_CLASS: Record<VerdictKind, string> = { test: 'test', unknown: 'unknown', 'caution-early': 'careful', 'caution-stopped': 'careful', toonew: 'toonew', clean: 'clean' };
function verdictChip(l: Launch): string {
  const k = verdictKind(l);
  return `<span class="chip chip-${KIND_CLASS[k]}"><span aria-hidden="true">${KIND_ICON[k]}</span> ${esc(t(KIND_LABEL[k]))}</span>`;
}

/** The early-sale fact for THIS coin, when the creator sold it early:
 *  the share of their own buys they sold in the first hours, with the
 *  transaction count. Shared by the card and the verdict stage. */
function earlySellFact(l: Launch): string | null {
  const ev = l.evidence;
  if (!ev.creatorSoldEarly) return null;
  const earlySells = ev.creatorSells.filter((s) => s.blocksAfterLaunch <= (snap?.params.earlyBlocks ?? 7200));
  const sold = earlySells.reduce((sum, s) => sum + BigInt(s.amountIn), 0n);
  const bought = BigInt(ev.creatorBuyTotal || '0');
  if (bought <= 0n || sold <= 0n || !earlySells.length) return null;
  const pct = fmtNum(Number((sold * 10000n) / bought) / 100, { maximumFractionDigits: 1 }) + '%';
  return t(earlySells.length === 1 ? 'verdict.sentence.sell.one' : 'verdict.sentence.sell', {
    coin: displayName(l), x: pct, when: t('verdict.when.early'), k: earlySells.length,
  });
}

function fmtPct(v: number): string {
  return fmtNum(v, { maximumFractionDigits: 1 }) + '%';
}
/** The percentage that drives a caution-early verdict for this coin:
 *  its own band if it has one, else the worst band among the creator's
 *  effective early-sell launches. Null when neither exists. */
function cautionPct(l: Launch): { pct: number; own: boolean } | null {
  const own = l.evidence.earlySellPct;
  if (own !== null && own >= 1) return { pct: own, own: true };
  const others = effectiveEarlyLaunches(creatorOf(l))
    .map((x) => x.evidence.earlySellPct ?? 0);
  if (!others.length) return null;
  return { pct: Math.max(...others), own: false };
}

function verdictFact(l: Launch, kind: VerdictKind): string {
  const c = creatorOf(l);
  switch (kind) {
    case 'caution-early': {
      const own = earlySellFact(l);
      if (own && (l.evidence.earlySellPct ?? 0) >= 1) return own;
      return t('verdict.fact.early.other', { n: effectiveEarlyCount(c), total: c?.realLaunches ?? 0 });
    }
    case 'caution-stopped': {
      if (l.stopped) return t('verdict.fact.stopped.this', { ago: agoOfBlock(l.evidence.lastSwapBlock ?? l.block) });
      return t('verdict.fact.stopped.creator', { s: c?.stopped ?? 0, n: Math.max(0, (c?.realLaunches ?? 0) - (c?.unreadable ?? 0)) });
    }
    case 'clean': {
      const n = c?.realLaunches ?? 0;
      const m = creatorTradeCount(c);
      if (n === 1 && m === 1) return t('verdict.fact.clean2.oneone');
      if (n === 1) return t('verdict.fact.clean2.one', { m: fmtNum(m) });
      return t('verdict.fact.clean2', { n, m: fmtNum(m) });
    }
    case 'toonew': return t('verdict.fact.new', { ago: agoOfBlock(l.block), n: fmtNum(l.evidence.swapCount) });
    case 'unknown': return t('verdict.reason.unreadable');
    default: return t('verdict.reason.test', { reason: l.testReason ?? '' });
  }
}
/** Meaning lines are generated from the measured values behind the
 *  verdict (audit P-1): the band, the percentage, the counts and the
 *  ages are interpolated, so the wording can never claim more than
 *  its own fact line and identical prose cannot repeat across cards
 *  whose numbers differ. */
/** This launch's ordinal among its creator's real launches, by block.
 *  A measured per-coin fact: serial creators produce clusters of coins
 *  whose other values are identical, and the ordinal is what honestly
 *  tells those coins apart in prose (Gate 17 boilerplate rule). */
function launchOrdinal(l: Launch): number {
  if (!snap) return 1;
  return Math.max(1, snap.launches.filter((x) =>
    x.creator.toLowerCase() === l.creator.toLowerCase() && !x.testLaunch && x.block <= l.block).length);
}

function verdictMeaning(l: Launch, kind: VerdictKind): string {
  const base = verdictMeaningBase(l, kind);
  const c = creatorOf(l);
  if ((kind === 'caution-early' || kind === 'caution-stopped') && (c?.realLaunches ?? 1) > 1) {
    return `${base} ${t('verdict.meaning.ordinal', { k: fmtNum(launchOrdinal(l)), n: fmtNum(c?.realLaunches ?? 1) })}`;
  }
  return base;
}

function verdictMeaningBase(l: Launch, kind: VerdictKind): string {
  const c = creatorOf(l);
  switch (kind) {
    case 'caution-early': {
      const cp = cautionPct(l);
      if (!cp) return t('verdict.meaning.early');
      if (!cp.own) {
        const s = l.evidence.swapCount;
        const trades = s === 1 ? t('verdict.trades.one') : t('verdict.trades.many', { n: fmtNum(s) });
        return `${t('verdict.meaning.early.creator', { pct: fmtPct(cp.pct) })} ${t('verdict.meaning.creator.coin', { trades })}`;
      }
      return cp.pct > 25
        ? t('verdict.meaning.early.c', { pct: fmtPct(cp.pct) })
        : t('verdict.meaning.early.b', { pct: fmtPct(cp.pct) });
    }
    case 'caution-stopped': {
      const n = Math.max(0, (c?.realLaunches ?? 0) - (c?.unreadable ?? 0));
      if (l.stopped) {
        return t('verdict.meaning.stopped.this', {
          ago: agoOfBlock(l.evidence.lastSwapBlock ?? l.block), s: c?.stopped ?? 0, n,
        });
      }
      const coinClause = l.evidence.lastSwapBlock
        ? t('verdict.meaning.stopped.coin', { ago: agoOfBlock(l.evidence.lastSwapBlock) })
        : t('verdict.meaning.stopped.coin.none');
      return `${t('verdict.meaning.stopped.creator', { s: c?.stopped ?? 0, n })} ${coinClause}`;
    }
    case 'clean': {
      const b = l.evidence.uniqueBuyers;
      const s = l.evidence.swapCount;
      const slots = {
        buyers: b === 1 ? t('verdict.buyers.one') : t('verdict.buyers.many', { n: fmtNum(b) }),
        trades: s === 1 ? t('verdict.trades.one') : t('verdict.trades.many', { n: fmtNum(s) }),
      };
      const coin = l.progressPct === null
        ? t('verdict.meaning.clean.coin.bare', slots)
        : l.progressPct >= 100
          ? t('verdict.meaning.clean.coin.grad', slots)
          : t('verdict.meaning.clean.coin', { ...slots, pct: fmtNum(l.progressPct, { maximumFractionDigits: 1 }) + '%' });
      return `${t('verdict.meaning.clean2')} ${coin}`;
    }
    case 'toonew': {
      const base = t('verdict.meaning.new2', { n: fmtNum(l.evidence.swapCount), ago: agoOfBlock(l.block) });
      const total = c?.realLaunches ?? 1;
      if (!c || total <= 1) return `${base} ${t('verdict.meaning.new.first')}`;
      return `${base} ${t('verdict.meaning.new.ordinal', { k: fmtNum(launchOrdinal(l)), n: fmtNum(total) })}`;
    }
    case 'unknown': return t('verdict.meaning.unknown');
    default: return '';
  }
}
/** The threshold sentence that belongs next to the judgement (audit:
 *  methodology must be present at the moment of judgement). */
function verdictThresholdLine(l: Launch, kind: VerdictKind): string {
  if (kind === 'caution-early') return t('verdict.threshold.early', { blocks: fmtNum(snap?.params.earlyBlocks ?? 7200) });
  if (kind === 'clean') return t('verdict.threshold.clean');
  return '';
}
/** Card face: fact line only. The meaning line and the threshold live
 *  behind the card's "Why" expander (audit P-2) and in full on the
 *  coin page's verdict stage. */
function verdictLines(l: Launch): string {
  const kind = verdictKind(l);
  if (kind === 'test') return `<p class="card-reason">${esc(verdictFact(l, kind))}</p>`;
  return `<p class="verdict-fact">${esc(verdictFact(l, kind))}</p>`;
}
/** The full three-part verdict for the coin page stage. */
function verdictStageLines(l: Launch): string {
  const kind = verdictKind(l);
  if (kind === 'test') return `<p class="card-reason">${esc(verdictFact(l, kind))}</p>`;
  const th = verdictThresholdLine(l, kind);
  return `<p class="verdict-fact">${esc(verdictFact(l, kind))}</p>
    <p class="verdict-meaning"><strong>${esc(t('verdict.meaning.label'))}</strong> ${esc(verdictMeaning(l, kind))}</p>
    ${th ? `<p class="verdict-threshold dim small">${esc(th)}</p>` : ''}`;
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
  return `<span class="pill pill-${s}">${esc(t(`stage.${s}`))}</span>`;
}

const WETH_ADDR = '0x4200000000000000000000000000000000000006';
/** Raised so far, from the curve's quote reserve. The census verified
 *  every launch in the index quotes in WETH (18 decimals); any other
 *  quote token is shown by address rather than guessed at. */
function raisedText(l: Launch): string | null {
  const st = l.state;
  if (!st?.quoteReserve) return null;
  const sym = !st.quoteToken || st.quoteToken.toLowerCase() === WETH_ADDR ? 'WETH' : shortAddr(st.quoteToken);
  const v = Number(formatUnits(BigInt(st.quoteReserve), 18));
  if (!(v > 0)) return null;
  return t('card.raised', { amt: `${fmtNum(v, { maximumFractionDigits: v >= 100 ? 2 : 4 })} ${sym}` });
}
function progressHtml(l: Launch): string {
  if (l.statusName === 'graduated') {
    return `<p class="card-line">${esc(t(l.readyToMigrate ? 'board.progress.ready' : 'board.progress.done'))}</p>`;
  }
  if (l.progressPct !== null) {
    const pct = fmtNum(l.progressPct, { maximumFractionDigits: 1 }) + '%';
    return `<div class="meter" role="img" aria-label="${esc(t('board.progress', { pct }))}"><div class="meter-fill" style="width:${Math.max(2, Math.min(100, l.progressPct))}%"></div></div><p class="card-line">${esc(t('board.progress', { pct }))}</p>`;
  }
  return `<p class="card-line">${esc(t('board.progress.none'))}</p>`;
}

/** Format a snapshot price in WETH per token at any magnitude: plain
 *  decimals down to the smallest sampled prices, never exponent form. */
function fmtPrice(v: number): string {
  if (!(v > 0)) return '0';
  if (v >= 0.001) return fmtNum(v, { maximumFractionDigits: v >= 1 ? 4 : 6 });
  const s = v.toPrecision(3);
  if (!s.includes('e')) return s;
  const [mant, expStr] = s.split('e');
  const exp = parseInt(expStr, 10);
  const digits = mant.replace('-', '').replace('.', '');
  return '0.' + '0'.repeat(Math.max(0, -exp - 1)) + digits;
}

/** Activity sparkline from the snapshot's 12-window swap counts. It is
 *  an activity chart and is labelled as one, never as price. All path
 *  coordinates are computed numbers. */
function sparkSvg(l: Launch): string {
  const spark = l.evidence.activitySpark ?? [];
  const total = spark.reduce((a, b) => a + b, 0);
  if (!spark.length || total === 0) return `<span class="spark-none">${esc(t('card.notrades.spark'))}</span>`;
  const W = 96, H = 24;
  const max = Math.max(...spark, 1);
  const pts = spark.map((v, i) => `${(i * (W / (spark.length - 1))).toFixed(1)},${(H - 2 - (v / max) * (H - 5)).toFixed(1)}`).join(' ');
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(t('card.activity'))}: ${fmtNum(total)}"><polyline points="${pts}" fill="none" stroke="var(--action)" stroke-width="2" stroke-linejoin="round"/></svg>`;
}

const SUBSCRIPT_DIGITS = '₀₁₂₃₄₅₆₇₈₉';
/** Compact card form of a tiny price: below 0.0001 the plain decimal
 *  runs to a dozen places and wraps the card's price line over three
 *  rows, so the leading zeros fold into a subscript count (0.0₉590).
 *  The significant digits are fmtPrice's own, unchanged; the exact
 *  decimal stays on the coin page quote and in the dense list. */
function fmtPriceShort(v: number): string {
  if (!(v > 0) || v >= 0.0001) return fmtPrice(v);
  const full = fmtPrice(v);
  const m = /^0\.(0+)([1-9]\d*)$/.exec(full);
  if (!m || m[1].length < 4) return full;
  const zeros = String(m[1].length).split('').map((d) => SUBSCRIPT_DIGITS[Number(d)]).join('');
  return `0.0${zeros}${m[2]}`;
}

function priceLineHtml(l: Launch): string {
  if (l.price) {
    return `<div class="price-row"><span class="price-line">${esc(t('card.price.snapshot', { price: fmtPriceShort(Number(l.price.perTokenWeth)), ago: agoOfBlock(l.price.block) }))}</span>${sparkSvg(l)}</div>`;
  }
  if (l.statusName === 'graduated') {
    return `<div class="price-row"><span class="price-line dim">${esc(t('card.price.graduated'))}</span>${sparkSvg(l)}</div>`;
  }
  return `<div class="price-row"><span class="price-line dim">${esc(t('card.price.none'))}</span>${sparkSvg(l)}</div>`;
}

/** Signal-first card (audit P-2): name, snapshot price + activity,
 *  progress, one tabular stats line, verdict chip + ONE fact line,
 *  creator line, and the meaning behind a "Why" expander. */
function coinCard(l: Launch): string {
  const watching = watchlist().includes(l.curve.toLowerCase());
  const ev = l.evidence;
  const stats = [
    ev.uniqueBuyers === 1 ? t('board.buyers.one') : t('board.buyers', { n: fmtNum(ev.uniqueBuyers) }),
    raisedText(l),
    ev.lastSwapBlock ? t('card.lasttrade', { ago: agoOfBlock(ev.lastSwapBlock) }) : t('card.coin.notrades'),
  ].filter(Boolean).join(' · ');
  const holdersLine = ev.holders
    ? (ev.holders.count <= 2
      ? `<p class="card-holders">${esc(ev.holders.count === 1 ? t('card.holders.few.one') : t('card.holders.few', { n: fmtNum(ev.holders.count) }))}</p>`
      : `<p class="card-holders">${esc(t('card.holders.line', { top1: fmtPct(ev.holders.top1Pct), top10: fmtPct(ev.holders.top10Pct) }))}</p>`)
    : '';
  const kind = verdictKind(l);
  const why = kind === 'test' ? '' : `<details class="why"><summary>${esc(t('verdict.why'))}</summary>
      <p class="verdict-meaning"><strong>${esc(t('verdict.meaning.label'))}</strong> ${esc(verdictMeaning(l, kind))}</p>
      ${verdictThresholdLine(l, kind) ? `<p class="dim small">${esc(verdictThresholdLine(l, kind))}</p>` : ''}
      <p><a href="#/coin/${l.curve}">${esc(t('card.why.receipts'))}</a></p></details>`;
  return `<article class="card" tabindex="0" data-curve="${esc(l.curve)}">
    <div class="card-top">${identicon(l.curve)}
      <div class="card-names"><a class="card-name" href="#/coin/${l.curve}" title="${esc(displayName(l))}">${esc(displayName(l))}</a>
      <span class="card-sym">${esc(l.symbol ?? '')}</span></div>${stagePill(l)}</div>
    ${priceLineHtml(l)}
    ${progressHtml(l)}
    <p class="card-stats">${esc(stats)}</p>
    ${holdersLine}
    <div class="card-verdict">${verdictChip(l)}${verdictLines(l)}</div>
    <div class="creator-row">${identicon(l.creator, 'identicon-sm')}
      <a class="creator-link" href="#/creator/${l.creator}">${esc(shortAddr(l.creator))}</a>
      <button type="button" class="watch-btn" data-act="watch" data-curve="${esc(l.curve)}" aria-pressed="${watching}" aria-label="${esc(t(watching ? 'watch.remove' : 'watch.add'))}">${watching ? '★' : '☆'}</button>
    </div>
    ${why}
  </article>`;
}

/** Dense list row (desktop density toggle, Gate 14/15): one line per
 *  coin in the true table built by listTableHtml: name, snapshot
 *  price, progress, buyers, raised, last trade, creator verdict. */
function coinRow(l: Launch): string {
  const pct = l.statusName === 'graduated' ? '100%' : l.progressPct !== null ? fmtNum(l.progressPct, { maximumFractionDigits: 1 }) + '%' : '—';
  const price = l.price ? `${fmtPrice(Number(l.price.perTokenWeth))} WETH` : '—';
  return `<a class="lrow" href="#/coin/${l.curve}">
    <span class="lrow-name">${identicon(l.curve, 'identicon-sm')}<span class="lrow-nm">${esc(displayName(l))}</span> <span class="dim small">${esc(l.symbol ?? '')}</span></span>
    <span class="lrow-num">${esc(price)}</span>
    <span class="lrow-num">${esc(pct)}</span>
    <span class="lrow-num">${fmtNum(l.evidence.uniqueBuyers)}</span>
    <span class="lrow-num">${esc(raisedText(l)?.replace(/^[^0-9<]*/, '') ?? '—')}</span>
    <span class="lrow-num">${esc(l.evidence.lastSwapBlock ? agoOfBlock(l.evidence.lastSwapBlock) : '—')}</span>
    <span class="lrow-chip">${verdictChip(l)}</span>
  </a>`;
}

/** The dense table header: sortable columns wired to the same sort
 *  state as the sort select (audit P-8). */
function listTableHtml(items: Launch[], f: FilterState): string {
  const sortBtn = (id: SortId, label: string) =>
    `<button type="button" class="lhead-btn" data-act="sort" data-sort="${id}" aria-pressed="${f.sort === id}">${esc(label)}${f.sort === id ? ' ↓' : ''}</button>`;
  return `<div class="ltable">
    <div class="lrow lhead" aria-hidden="false">
      <span>${esc(t('table.coin'))}</span>
      <span>${sortBtn('price', t('table.price'))}</span>
      <span>${sortBtn('grad', t('table.progress'))}</span>
      <span>${sortBtn('buyers', t('table.buyers'))}</span>
      <span>${sortBtn('raised', t('table.raised'))}</span>
      <span>${sortBtn('lasttrade', t('table.lasttrade'))}</span>
      <span>${esc(t('table.verdict'))}</span>
    </div>
    <div class="list-rows">${items.map(coinRow).join('')}</div>
  </div>`;
}

// ---------- filter system (Gate 14, spec S1) ----------
type SortId = 'grad' | 'newest' | 'buyers' | 'raised' | 'price' | 'lasttrade';
interface FilterState {
  preset: string | null;
  stage: string[]; verdict: string[]; creator: string[]; activity: string[];
  showTests: boolean; showStopped: boolean;
  sort: SortId; query: string; view: 'cards' | 'list';
}
const PRESETS = ['worth', 'gradsoon', 'newtoday', 'clean', 'graduated', 'watching'] as const;
const FACET_GROUPS = ['stage', 'verdict', 'creator', 'activity'] as const;
type FacetGroup = (typeof FACET_GROUPS)[number];
const FACET_VALUES: Record<FacetGroup, string[]> = {
  stage: ['new', 'near', 'graduated', 'other'],
  verdict: ['clean', 'caution', 'toonew', 'stopped'],
  creator: ['graduated', 'first', 'early'],
  activity: ['buyers', 'recent', 'raised'],
};
const FACET_VALUE_LABEL: Record<FacetGroup, Record<string, string>> = {
  stage: { new: 'stage.new', near: 'stage.near', graduated: 'stage.graduated', other: 'stage.other' },
  verdict: { clean: 'filter.v.clean', caution: 'filter.v.caution', toonew: 'filter.v.toonew', stopped: 'filter.v.stopped' },
  creator: { graduated: 'filter.c.graduated', first: 'filter.c.first', early: 'filter.c.early' },
  activity: { buyers: 'filter.a.buyers', recent: 'filter.a.recent', raised: 'filter.a.raised' },
};
function defaultFilters(): FilterState {
  return {
    preset: null, stage: [], verdict: [], creator: [], activity: [],
    showTests: false, showStopped: false, sort: 'grad', query: '', view: 'cards',
  };
}
function cloneFilters(f: FilterState): FilterState {
  return { ...f, stage: [...f.stage], verdict: [...f.verdict], creator: [...f.creator], activity: [...f.activity] };
}

function passToggles(l: Launch, f: FilterState): boolean {
  return (f.showTests || !l.testLaunch) && (f.showStopped || !l.stopped);
}
function passPreset(l: Launch, f: FilterState): boolean {
  switch (f.preset) {
    case null: return true;
    // Spec S1: Clean record or Caution-free (the too-new kind carries no
    // caution) AND (progress >= 25% OR buyers >= 3); test launches can
    // never match because their kind is 'test'. Recorded in BUILD.md.
    case 'worth': {
      const k = verdictKind(l);
      return (k === 'clean' || k === 'toonew') && ((l.progressPct ?? 0) >= 25 || l.evidence.uniqueBuyers >= 3);
    }
    case 'gradsoon': return (l.progressPct ?? 0) >= 80 && l.statusName === 'trading';
    case 'newtoday': return snap!.headBlock - l.block <= 86_400;
    case 'clean': return verdictKind(l) === 'clean';
    case 'graduated': return l.statusName === 'graduated';
    case 'watching': return watchlist().includes(l.curve.toLowerCase());
    default: return true;
  }
}
function passStage(l: Launch, f: FilterState): boolean {
  return !f.stage.length || f.stage.includes(stageOf(l));
}
function passVerdict(l: Launch, f: FilterState): boolean {
  if (!f.verdict.length) return true;
  const k = verdictKind(l);
  return f.verdict.some((v) =>
    (v === 'clean' && k === 'clean') ||
    (v === 'caution' && (k === 'caution-early' || k === 'caution-stopped')) ||
    (v === 'toonew' && k === 'toonew') ||
    (v === 'stopped' && l.stopped));
}
function passCreator(l: Launch, f: FilterState): boolean {
  if (!f.creator.length) return true;
  const c = creatorOf(l);
  return f.creator.some((v) =>
    (v === 'graduated' && (c?.graduated ?? 0) > 0) ||
    (v === 'first' && (c ? c.realLaunches <= 1 : true)) ||
    (v === 'early' && ((c?.earlySellCount ?? 0) > 0 || l.evidence.creatorSoldEarly)));
}
function passActivity(l: Launch, f: FilterState): boolean {
  if (!f.activity.length) return true;
  return f.activity.some((v) =>
    (v === 'buyers' && l.evidence.uniqueBuyers > 0) ||
    (v === 'recent' && l.evidence.lastSwapBlock !== null && snap!.headBlock - l.evidence.lastSwapBlock <= 86_400) ||
    (v === 'raised' && !!l.state?.quoteReserve && BigInt(l.state.quoteReserve) >= 10n ** 17n));
}
function passQuery(l: Launch, f: FilterState): boolean {
  const q = f.query.trim().toLowerCase();
  if (!q) return true;
  return (l.name ?? '').toLowerCase().includes(q) || (l.symbol ?? '').toLowerCase().includes(q) ||
    l.token.toLowerCase().includes(q) || l.curve.toLowerCase().includes(q) || l.creator.toLowerCase().includes(q);
}
function groupPass(group: FacetGroup, l: Launch, f: FilterState): boolean {
  if (group === 'stage') return passStage(l, f);
  if (group === 'verdict') return passVerdict(l, f);
  if (group === 'creator') return passCreator(l, f);
  return passActivity(l, f);
}
/** The one filter pipeline. opts.skip drops a whole group (for
 *  cross-counts); opts.force evaluates a group as a single value. */
function applyFilters(f: FilterState, opts?: { skip?: string; force?: [FacetGroup, string] }): Launch[] {
  if (!snap) return [];
  const skip = opts?.skip;
  const inGroup = (group: FacetGroup, l: Launch): boolean => {
    if (opts?.force && opts.force[0] === group) {
      return groupPass(group, l, { ...f, [group]: [opts.force[1]] } as FilterState);
    }
    if (skip === group) return true;
    return groupPass(group, l, f);
  };
  return snap.launches.filter((l) =>
    (skip === 'toggles' || passToggles(l, f)) &&
    (skip === 'preset' || passPreset(l, f)) &&
    inGroup('stage', l) && inGroup('verdict', l) && inGroup('creator', l) && inGroup('activity', l) &&
    (skip === 'query' || passQuery(l, f)));
}
function facetCount(f: FilterState, group: FacetGroup, value: string): number {
  return applyFilters(f, { skip: group, force: [group, value] }).length;
}
function presetCount(f: FilterState, preset: string): number {
  // How many coins tapping this preset would show, given every other
  // active filter. The preset itself must be evaluated, not skipped:
  // an earlier version passed skip:'preset', which made every chip
  // show the unfiltered count (47) regardless of the preset.
  return applyFilters({ ...f, preset }).length;
}
function sortLaunches(list: Launch[], sort: SortId): Launch[] {
  const raised = (l: Launch) => (l.state?.quoteReserve ? BigInt(l.state.quoteReserve) : 0n);
  return [...list].sort((a, b) => {
    if (sort === 'newest') return b.block - a.block;
    if (sort === 'buyers') return b.evidence.uniqueBuyers - a.evidence.uniqueBuyers;
    if (sort === 'raised') return raised(b) > raised(a) ? 1 : raised(b) < raised(a) ? -1 : 0;
    if (sort === 'price') return Number(b.price?.perTokenWeth ?? -1) - Number(a.price?.perTokenWeth ?? -1);
    if (sort === 'lasttrade') return (b.evidence.lastSwapBlock ?? -1) - (a.evidence.lastSwapBlock ?? -1);
    const pa = a.statusName === 'graduated' ? 101 : (a.progressPct ?? -1);
    const pb = b.statusName === 'graduated' ? 101 : (b.progressPct ?? -1);
    return pb - pa;
  });
}
function isDefaultFilters(f: FilterState): boolean {
  return f.preset === null && !f.stage.length && !f.verdict.length && !f.creator.length &&
    !f.activity.length && !f.query.trim() && !f.showTests && !f.showStopped;
}
function activeFilterCount(f: FilterState): number {
  return (f.preset ? 1 : 0) + f.stage.length + f.verdict.length + f.creator.length + f.activity.length +
    (f.showTests ? 1 : 0) + (f.showStopped ? 1 : 0);
}

// ---------- filter state in URL + storage ----------
const FILTERS_KEY = 'evenfield.v3.filters';
const VIEWS_KEY = 'evenfield.v3.views';
function filtersToParams(f: FilterState): string {
  const p = new URLSearchParams();
  if (f.preset) p.set('p', f.preset);
  if (f.stage.length) p.set('st', f.stage.join(','));
  if (f.verdict.length) p.set('vd', f.verdict.join(','));
  if (f.creator.length) p.set('cr', f.creator.join(','));
  if (f.activity.length) p.set('ac', f.activity.join(','));
  if (f.showTests) p.set('t', '1');
  if (f.showStopped) p.set('s', '1');
  if (f.sort !== 'grad') p.set('sort', f.sort);
  if (f.query) p.set('q', f.query);
  if (f.view !== 'cards') p.set('v', f.view);
  const s = p.toString();
  return s ? `?${s}` : '';
}
function validList(raw: string | null, allowed: string[]): string[] {
  if (!raw) return [];
  return raw.split(',').filter((x) => allowed.includes(x));
}
function filtersFromParams(q: URLSearchParams): FilterState {
  const f = defaultFilters();
  const p = q.get('p');
  if (p && (PRESETS as readonly string[]).includes(p)) f.preset = p;
  f.stage = validList(q.get('st'), FACET_VALUES.stage);
  f.verdict = validList(q.get('vd'), FACET_VALUES.verdict);
  f.creator = validList(q.get('cr'), FACET_VALUES.creator);
  f.activity = validList(q.get('ac'), FACET_VALUES.activity);
  f.showTests = q.get('t') === '1';
  f.showStopped = q.get('s') === '1';
  const sort = q.get('sort');
  if (sort === 'newest' || sort === 'buyers' || sort === 'raised' || sort === 'price' || sort === 'lasttrade') f.sort = sort;
  f.query = (q.get('q') ?? '').slice(0, 80);
  if (q.get('v') === 'list') f.view = 'list';
  return f;
}
function filtersFromStorage(): FilterState | null {
  try {
    const raw = localStorage.getItem(FILTERS_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as Partial<FilterState>;
    const f = defaultFilters();
    if (j.preset && (PRESETS as readonly string[]).includes(j.preset)) f.preset = j.preset;
    for (const g of FACET_GROUPS) {
      if (Array.isArray(j[g])) f[g] = (j[g] as string[]).filter((x) => FACET_VALUES[g].includes(x));
    }
    f.showTests = j.showTests === true;
    f.showStopped = j.showStopped === true;
    if (j.sort === 'newest' || j.sort === 'buyers' || j.sort === 'raised' || j.sort === 'grad' || j.sort === 'price' || j.sort === 'lasttrade') f.sort = j.sort;
    if (typeof j.query === 'string') f.query = j.query.slice(0, 80);
    if (j.view === 'list') f.view = 'list';
    return f;
  } catch { return null; }
}
interface SavedView { name: string; f: FilterState }
function savedViews(): SavedView[] {
  try { return JSON.parse(localStorage.getItem(VIEWS_KEY) ?? '[]') as SavedView[]; } catch { return []; }
}
function storeSavedViews(v: SavedView[]) {
  try { localStorage.setItem(VIEWS_KEY, JSON.stringify(v.slice(0, 12))); } catch { /* ignore */ }
}

// ---------- board page ----------
interface BoardCtx { basePath: string; f: FilterState }
let boardCtx: BoardCtx | null = null;
let sheetDraft: FilterState | null = null;

function resolveInitialFilters(basePath: string): FilterState {
  const { query, hasQuery } = routeOf();
  let f: FilterState;
  if (hasQuery) f = filtersFromParams(query);
  else f = filtersFromStorage() ?? defaultFilters();
  if (basePath === '/watching' && !hasQuery) f.preset = 'watching';
  return f;
}
function syncFilterState() {
  if (!boardCtx) return;
  try { localStorage.setItem(FILTERS_KEY, JSON.stringify(boardCtx.f)); } catch { /* ignore */ }
  history.replaceState(null, '', `#${boardCtx.basePath}${filtersToParams(boardCtx.f)}`);
}

function snapshotLine(): string {
  if (!snap) return '';
  const built = new Date(snap.builtAt);
  const ago = fmtAgo(built);
  const stale = Date.now() - built.getTime() >= 6.5 * 3600_000 && deltaCount === 0;
  const txt = stale ? t('home.snapshot.stale', { ago }) : t('home.snapshot', { ago });
  const line = `<p class="snapshot-line">${esc(txt)}${deltaCount ? ` ${esc(t('delta.note', { n: deltaCount }))}` : ''}</p>`;
  return stale ? `<div class="stale-banner">${line}</div>` : line;
}

/** The trading coin closest to graduation, for honest zero-status
 *  text (audit V10): a zero preset names the closest real candidate
 *  instead of opening an empty board. */
function closestToGraduation(): Launch | null {
  if (!snap) return null;
  const cand = snap.launches.filter((l) => l.statusName === 'trading' && !l.testLaunch && l.progressPct !== null);
  if (!cand.length) return null;
  return cand.reduce((a, b) => ((b.progressPct ?? 0) > (a.progressPct ?? 0) ? b : a));
}

function presetChipsHtml(f: FilterState): string {
  const chips = PRESETS.map((p) => {
    const n = presetCount(f, p);
    // A preset whose live count is zero is a status, never a door to
    // an empty board (audit P-3/V10). An active zero preset (reachable
    // only via a shared URL) stays a chip so it can be switched off.
    if (n === 0 && f.preset !== p) {
      let status = t('preset.status.none');
      if (p === 'gradsoon') {
        const closest = closestToGraduation();
        if (closest) status = t('preset.status.gradsoon', { name: displayName(closest), pct: fmtPct(closest.progressPct ?? 0) });
      }
      return `<span class="preset-status" role="status">${esc(t(`preset.${p}`))}: ${esc(status)}</span>`;
    }
    return `<button type="button" class="preset-chip" data-act="preset" data-preset="${p}" aria-pressed="${f.preset === p}">${esc(t(`preset.${p}`))} <span class="cnt">${fmtNum(n)}</span></button>`;
  }).join('');
  const views = savedViews().map((v, i) =>
    `<button type="button" class="preset-chip saved" data-act="apply-view" data-idx="${i}">${esc(v.name)}</button>`).join('');
  return chips + views;
}

/** Quick verdict chips: the Creator-record facet one tap from the
 *  board, so the core shortlist path (preset + verdict) costs 2 taps
 *  on a phone, inside the T2 budget. The same values live in the sheet
 *  and the rail with identical counts. */
function quickChipsHtml(f: FilterState): string {
  return FACET_VALUES.verdict.map((v) => {
    const n = facetCount(f, 'verdict', v);
    const on = f.verdict.includes(v);
    return `<button type="button" class="facet-val" data-act="facet" data-group="verdict" data-value="${v}" aria-pressed="${on}" ${n === 0 && !on ? 'disabled' : ''}>${esc(t(FACET_VALUE_LABEL.verdict[v]))} <span class="cnt">${fmtNum(n)}</span></button>`;
  }).join('');
}

/** The sticky bar's single scrollable strip: filter trigger (mobile),
 *  sort, presets, quick verdict chips. One line tall at every width:
 *  the first coin card has to reach the first viewport (Gate 13, T1),
 *  and a three-row bar measured 296px and pushed it out. */
function stripHtml(f: FilterState): string {
  return `<button type="button" class="btn btn-ghost" id="filterBtn" data-act="open-filters">${esc(t('filter.btn'))}${activeFilterCount(f) ? ` <span class="badge">${fmtNum(activeFilterCount(f))}</span>` : ''}</button>
    <label class="sort-label">${esc(t('filter.sort'))}
      <select id="sortSel" class="sort-select">
        <option value="grad" ${f.sort === 'grad' ? 'selected' : ''}>${esc(t('filter.sort.grad'))}</option>
        <option value="newest" ${f.sort === 'newest' ? 'selected' : ''}>${esc(t('filter.sort.newest'))}</option>
        <option value="buyers" ${f.sort === 'buyers' ? 'selected' : ''}>${esc(t('filter.sort.buyers'))}</option>
        <option value="raised" ${f.sort === 'raised' ? 'selected' : ''}>${esc(t('filter.sort.raised'))}</option>
        <option value="price" ${f.sort === 'price' ? 'selected' : ''}>${esc(t('filter.sort.price'))}</option>
        <option value="lasttrade" ${f.sort === 'lasttrade' ? 'selected' : ''}>${esc(t('filter.sort.lasttrade'))}</option>
      </select></label>
    <span class="sep" aria-hidden="true"></span>
    ${presetChipsHtml(f)}
    <span class="sep" aria-hidden="true"></span>
    ${quickChipsHtml(f)}${hiddenChipsHtml(f)}`;
}

/** Safe-default announcements as strip chips: how many coins the
 *  defaults are hiding, with the lift built into the same chip. */
function hiddenChipsHtml(f: FilterState): string {
  const shown = applyFilters(f).length;
  let out = '';
  if (!f.showTests) {
    const hidden = applyFilters({ ...f, showTests: true }).length - shown;
    if (hidden > 0) out += `<button type="button" class="facet-val hidden-chip" data-act="toggle" data-toggle="tests">${esc(t('filter.hidden.tests', { n: hidden }))} · ${esc(t('filter.show.them'))}</button>`;
  }
  if (!f.showStopped) {
    const hidden = applyFilters({ ...f, showStopped: true }).length - shown;
    if (hidden > 0) out += `<button type="button" class="facet-val hidden-chip" data-act="toggle" data-toggle="stopped">${esc(t('filter.hidden.stopped', { n: hidden }))} · ${esc(t('filter.show.them'))}</button>`;
  }
  return out;
}

function facetGroupsHtml(f: FilterState): string {
  const groups = FACET_GROUPS.map((g) => {
    const vals = FACET_VALUES[g].map((v) => {
      const n = facetCount(f, g, v);
      const on = (f[g] as string[]).includes(v);
      return `<button type="button" class="facet-val" data-act="facet" data-group="${g}" data-value="${v}" aria-pressed="${on}" ${n === 0 && !on ? 'disabled' : ''}>${esc(t(FACET_VALUE_LABEL[g][v]))} <span class="cnt">${fmtNum(n)}</span></button>`;
    }).join('');
    return `<div class="facet-group"><h3>${esc(t(`filter.facet.${g}`))}</h3><div class="facet-values">${vals}</div></div>`;
  }).join('');
  const toggles = `<div class="facet-group"><h3>${esc(t('filter.facet.include'))}</h3>
    <button type="button" class="toggle-row" data-act="toggle" data-toggle="tests" aria-pressed="${f.showTests}"><span>${esc(t('filter.t.tests'))}</span><span class="toggle-ui" aria-hidden="true"></span></button>
    <button type="button" class="toggle-row" data-act="toggle" data-toggle="stopped" aria-pressed="${f.showStopped}"><span>${esc(t('filter.t.stopped'))}</span><span class="toggle-ui" aria-hidden="true"></span></button>
  </div>`;
  return groups + toggles;
}
function savedViewsHtml(): string {
  const views = savedViews();
  return `<div class="facet-group"><h3>${esc(t('filter.saved'))}</h3>
    ${views.length ? `<div class="facet-values">${views.map((v, i) => `<button type="button" class="facet-val" data-act="apply-view" data-idx="${i}">${esc(v.name)}</button>`).join('')}</div>` : ''}
    <div class="save-row"><input class="save-view-name" placeholder="${esc(t('filter.save.name'))}" aria-label="${esc(t('filter.save.name'))}">
    <button type="button" class="btn btn-ghost" data-act="save-view">${esc(t('filter.save'))}</button></div></div>`;
}
function railHtml(f: FilterState): string {
  return `<h2 class="rail-title">${esc(t('filter.title'))}</h2>${facetGroupsHtml(f)}${savedViewsHtml()}
    <button type="button" class="btn btn-ghost rail-clear" data-act="clear-all">${esc(t('filter.clear'))}</button>
    <div class="view-toggle" role="group" aria-label="${esc(t('filter.view.cards'))} / ${esc(t('filter.view.list'))}">
      <button type="button" data-act="view" data-view="cards" aria-pressed="${f.view === 'cards'}">${esc(t('filter.view.cards'))}</button>
      <button type="button" data-act="view" data-view="list" aria-pressed="${f.view === 'list'}">${esc(t('filter.view.list'))}</button>
    </div>`;
}

function appliedChipsHtml(f: FilterState): string {
  if (!activeFilterCount(f) && !f.query.trim()) return '';
  const chips: string[] = [];
  if (f.preset) chips.push(`<span class="applied-chip">${esc(t(`preset.${f.preset}`))}<button type="button" data-act="chip-remove" data-kind="preset" aria-label="${esc(t('filter.clear'))}">×</button></span>`);
  for (const g of FACET_GROUPS) {
    for (const v of f[g]) {
      chips.push(`<span class="applied-chip">${esc(t(FACET_VALUE_LABEL[g][v]))}<button type="button" data-act="chip-remove" data-kind="${g}" data-value="${v}" aria-label="${esc(t('filter.clear'))}">×</button></span>`);
    }
  }
  if (f.showTests) chips.push(`<span class="applied-chip">${esc(t('filter.t.tests'))}<button type="button" data-act="chip-remove" data-kind="tests" aria-label="${esc(t('filter.clear'))}">×</button></span>`);
  if (f.showStopped) chips.push(`<span class="applied-chip">${esc(t('filter.t.stopped'))}<button type="button" data-act="chip-remove" data-kind="stopped" aria-label="${esc(t('filter.clear'))}">×</button></span>`);
  if (f.query.trim()) chips.push(`<span class="applied-chip">“${esc(f.query.trim())}”<button type="button" data-act="chip-remove" data-kind="query" aria-label="${esc(t('filter.clear'))}">×</button></span>`);
  return `<div class="applied-chips">${chips.join('')}<button type="button" class="clear-all" data-act="clear-all">${esc(t('filter.clear'))}</button></div>`;
}

function whyLineHtml(f: FilterState, shown: number): string {
  // The hidden-by-default counts ride in the sticky strip as toggle
  // chips (see stripHtml): as inline text here they wrapped to four
  // lines at 344-360px and pushed the first card out of the first
  // viewport (T1). The sentence keeps the showing count; the chips
  // keep the hidden counts and the one-tap way to lift them.
  return `<p class="why-line" aria-live="polite">${esc(t('filter.showing', { n: shown, total: snap!.launches.length }))}</p>`;
}

/** The one-tap way back from an empty result: try relaxations in a
 *  fixed order and offer the first that brings coins back (Gate 14). */
function looseningFor(f: FilterState): { label: string; next: FilterState } | null {
  const tries: { label: string; next: FilterState }[] = [];
  if (!f.showTests) tries.push({ label: t('filter.zero.loosen', { what: t('filter.zero.loosen.tests') }), next: { ...f, showTests: true } });
  if (!f.showStopped) tries.push({ label: t('filter.zero.loosen', { what: t('filter.zero.loosen.stopped') }), next: { ...f, showStopped: true } });
  for (const g of FACET_GROUPS) {
    if (f[g].length) tries.push({ label: t('filter.zero.loosen', { what: t('filter.zero.loosen.facet', { facet: t(`filter.facet.${g}`) }) }), next: { ...f, [g]: [] } as FilterState });
  }
  if (f.preset) tries.push({ label: t('filter.zero.loosen', { what: t('filter.zero.loosen.preset') }), next: { ...f, preset: null } });
  if (f.query.trim()) tries.push({ label: t('filter.zero.loosen', { what: t('filter.zero.loosen.query') }), next: { ...f, query: '' } });
  for (const tr of tries) if (applyFilters(tr.next).length > 0) return tr;
  return null;
}
let pendingLoosen: FilterState | null = null;

function boardMainHtml(f: FilterState): string {
  const results = sortLaunches(applyFilters(f), f.sort);
  const why = whyLineHtml(f, results.length);
  const chips = appliedChipsHtml(f);
  if (f.preset === 'watching' && watchlist().length === 0) {
    return `${why}${chips}<div class="empty-state"><h2>${esc(t('watching.empty.title'))}</h2><p>${esc(t('watching.empty.body'))}</p>
      <div class="btn-row"><a class="btn" href="#/">${esc(t('watching.goto'))}</a></div></div>`;
  }
  if (!results.length) {
    const loose = looseningFor(f);
    pendingLoosen = loose?.next ?? null;
    return `${why}${chips}<div class="empty-state"><h2>${esc(t('filter.zero.title'))}</h2><p>${esc(t('filter.zero.body'))}</p>
      <div class="btn-row">${loose ? `<button type="button" class="btn" data-act="loosen">${esc(loose.label)}</button>` : ''}
      <button type="button" class="btn btn-ghost" data-act="clear-all">${esc(t('filter.clear'))}</button></div></div>`;
  }
  pendingLoosen = null;
  if (f.view === 'list') {
    // Dense mode is one true table over the whole result set (audit
    // P-8), not per-lane row stacks.
    const heading = f.query.trim() ? `<div class="stage-head"><h2>${esc(t('search.resultsfor', { q: f.query.trim() }))}</h2><span class="stage-count">${fmtNum(results.length)}</span></div>` : '';
    return `${why}${chips}<section class="stage flat">${heading}${listTableHtml(results, f)}</section>`;
  }
  const renderItems = (items: Launch[]) => `<div class="cq"><div class="grid">${items.map(coinCard).join('')}</div></div>`;
  if (isDefaultFilters(f) && f.view === 'cards') {
    const lanes = (['new', 'near', 'graduated', 'other'] as const).map((s) => {
      const items = results.filter((l) => stageOf(l) === s);
      if (!items.length) return '';
      return `<section class="stage"><div class="stage-head"><h2>${esc(t(`stage.${s}`))}</h2><span class="stage-meaning">${esc(t(`stage.meaning.${s}`))}</span><span class="stage-count">${fmtNum(items.length)}</span></div>${renderItems(items)}</section>`;
    }).join('');
    return `${why}${chips}${lanes}${boardExtrasHtml()}`;
  }
  const heading = f.query.trim() ? `<div class="stage-head"><h2>${esc(t('search.resultsfor', { q: f.query.trim() }))}</h2><span class="stage-count">${fmtNum(results.length)}</span></div>` : '';
  return `${why}${chips}<section class="stage flat">${heading}${renderItems(results)}</section>`;
}

function boardExtrasHtml(): string {
  if (!snap) return '';
  const weekFrom = snap.headBlock - 650_000;
  const weekNew = snap.launches.filter((l) => l.block >= weekFrom);
  const nearGrad = [...snap.launches]
    .filter((l) => l.statusName === 'trading' && l.progressPct !== null && !l.testLaunch && !l.stopped)
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
      <p class="card-line dim small">${esc(creatorSentence(c))}</p>
      </article>`).join('')}</div></div></section>`;
  return weekly + creatorStrip;
}

function pageBoard(basePath: string): string {
  countView(basePath === '/watching' ? 'watching' : 'home');
  if (!snap) return '';
  boardCtx = { basePath, f: resolveInitialFilters(basePath) };
  const f = boardCtx.f;
  return `<section class="hero hero-compact">
      <h1>${esc(t('home.promise'))}</h1>
      <p class="fact">${esc(t('home.fact', { creators: fmtNum(snap.creators.length), coins: fmtNum(snap.launches.length) }))}</p>
      ${snapshotLine()}
    </section>
    <div class="filterbar">
      <div class="search-wrap">
        <div class="search-row"><input id="boardSearch" type="search" value="${esc(f.query)}" placeholder="${esc(t('home.search.placeholder'))}" aria-label="${esc(t('home.search.placeholder'))}" autocomplete="off"></div>
        <div id="searchSuggest" class="suggest" hidden></div>
      </div>
      <div class="chips-strip" id="chipsRow">${stripHtml(f)}</div>
    </div>
    <div class="board-shell">
      <aside class="filter-rail" id="filterRail">${railHtml(f)}</aside>
      <div class="board-main" id="boardMain">${boardMainHtml(f)}</div>
    </div>`;
}

/** Re-render the filter-dependent regions in place (scroll position is
 *  preserved because the shell, hero and bar keep their size). */
function refreshBoard() {
  if (!boardCtx) return;
  const f = boardCtx.f;
  const y = window.scrollY;
  const cr = $('#chipsRow'); if (cr) { cr.innerHTML = stripHtml(f); cr.scrollLeft = 0; }
  const rail = $('#filterRail'); if (rail) rail.innerHTML = railHtml(f);
  const main = $('#boardMain'); if (main) main.innerHTML = boardMainHtml(f);
  document.querySelectorAll<HTMLButtonElement>('[data-act="view"]').forEach((b) =>
    b.setAttribute('aria-pressed', String(b.dataset.view === f.view)));
  const search = document.querySelector<HTMLInputElement>('#boardSearch');
  if (search && search.value !== f.query) search.value = f.query;
  window.scrollTo(0, y);
}

function clearFilters(f: FilterState): FilterState {
  const d = defaultFilters();
  return { ...d, sort: f.sort, view: f.view, query: f.query };
}

// ---------- search suggestions (Gate 14) ----------
function suggestHtml(qRaw: string): string {
  if (!snap) return '';
  const q = qRaw.trim();
  if (!q) {
    const rec = recents();
    if (!rec.length) return '';
    return `<div class="suggest-group"><h4>${esc(t('search.recents'))}</h4>${rec.map((r) => r.kind === 'coin'
      ? `<a class="suggest-row" href="#/coin/${esc(r.id)}">${identicon(r.id, 'identicon-sm')}<span>${esc(r.label)}</span></a>`
      : `<a class="suggest-row" href="#/creator/${esc(r.id)}">${identicon(r.id, 'identicon-sm')}<span>${esc(r.label)}</span></a>`).join('')}</div>`;
  }
  const ql = q.toLowerCase();
  const coins = snap.launches.filter((l) =>
    (l.name ?? '').toLowerCase().includes(ql) || (l.symbol ?? '').toLowerCase().includes(ql) ||
    l.token.toLowerCase() === ql || l.curve.toLowerCase() === ql).slice(0, 5);
  const creators = snap.creators.filter((c) => c.address.toLowerCase().includes(ql)).slice(0, 3);
  const isAddr = /^0x[0-9a-fA-F]{4,}$/.test(q);
  const parts: string[] = [];
  if (coins.length) {
    parts.push(`<div class="suggest-group"><h4>${esc(t('search.coins'))}</h4>${coins.map((l) =>
      `<a class="suggest-row" href="#/coin/${l.curve}">${identicon(l.curve, 'identicon-sm')}<span class="suggest-name">${esc(displayName(l))} <span class="dim small">${esc(l.symbol ?? '')}</span></span>${verdictChip(l)}</a>`).join('')}</div>`);
  }
  if (creators.length) {
    parts.push(`<div class="suggest-group"><h4>${esc(t('search.creators'))}</h4>${creators.map((c) =>
      `<a class="suggest-row" href="#/creator/${c.address}">${identicon(c.address, 'identicon-sm')}<span class="suggest-name">${esc(shortAddr(c.address))}</span><span class="dim small">${esc(t('passport.launched', { n: c.totalLaunches }))}</span></a>`).join('')}</div>`);
  }
  if (isAddr) {
    parts.push(`<div class="suggest-group"><h4>${esc(t('search.address'))}</h4>
      <a class="suggest-row" href="#/money" data-money-addr="${esc(q)}"><span>${esc(t('search.address.money'))}</span></a>
      ${byCreator.has(ql) ? `<a class="suggest-row" href="#/creator/${esc(q)}"><span>${esc(t('search.address.passport'))}</span></a>` : ''}</div>`);
  }
  if (!parts.length) return `<p class="empty suggest-none">${esc(t('search.none'))}</p>`;
  parts.push(`<button type="button" class="suggest-all" data-act="suggest-all">${esc(t('search.all', { q }))}</button>`);
  return parts.join('');
}
function showSuggest() {
  const box = $('#searchSuggest');
  const input = document.querySelector<HTMLInputElement>('#boardSearch');
  if (!box || !input) return;
  const html = suggestHtml(input.value);
  box.innerHTML = html;
  box.hidden = !html;
}
function hideSuggest() {
  const box = $('#searchSuggest');
  if (box) box.hidden = true;
}

// ---------- filter sheet (mobile) ----------
function openFilterSheet() {
  if (!boardCtx) return;
  sheetDraft = cloneFilters(boardCtx.f);
  const root = $('#sheet-root');
  root.innerHTML = `<div class="sheet-backdrop" data-act="sheet-backdrop"><div class="sheet sheet-filter" role="dialog" aria-modal="true" aria-label="${esc(t('filter.title'))}" id="filterSheet">
    <div class="sheet-head"><h2>${esc(t('filter.title'))}</h2>
      <button type="button" class="icon-btn" data-act="sheet-close" aria-label="${esc(t('common.close'))}">×</button></div>
    <div class="sheet-body" id="sheetBody">${facetGroupsHtml(sheetDraft)}${savedViewsHtml()}</div>
    <div class="sheet-footer">
      <button type="button" class="btn btn-ghost" data-act="sheet-clear">${esc(t('filter.clear'))}</button>
      <button type="button" class="btn" data-act="sheet-apply" id="sheetApply">${esc(t('filter.show', { n: applyFilters(sheetDraft).length }))}</button>
    </div></div></div>`;
}
function refreshSheet() {
  if (!sheetDraft) return;
  const body = $('#sheetBody');
  if (body) body.innerHTML = `${facetGroupsHtml(sheetDraft)}${savedViewsHtml()}`;
  const apply = $('#sheetApply');
  if (apply) apply.textContent = t('filter.show', { n: applyFilters(sheetDraft).length });
}
function closeSheet() {
  $('#sheet-root').innerHTML = '';
  sheetDraft = null;
}

function openShortcutsSheet() {
  const root = $('#sheet-root');
  const rows: [string, string][] = [
    ['/', 'shortcuts.search'], ['f', 'shortcuts.filters'], ['1–6', 'shortcuts.presets'],
    ['w', 'shortcuts.watch'], ['?', 'shortcuts.help'],
  ];
  root.innerHTML = `<div class="sheet-backdrop" data-act="sheet-backdrop"><div class="sheet" role="dialog" aria-modal="true">
    <h2>${esc(t('shortcuts.title'))}</h2>
    <ul class="shortcuts">${rows.map(([k, key]) => `<li><kbd>${esc(k)}</kbd> ${esc(t(key))}</li>`).join('')}</ul>
    <div class="btn-row"><button type="button" class="btn btn-ghost" data-act="sheet-close">${esc(t('common.close'))}</button></div>
  </div></div>`;
}

// ---------- board interactions (one delegated listener set) ----------
function mutateFilters(fn: (f: FilterState) => void, target: 'board' | 'sheet') {
  if (target === 'sheet') {
    if (!sheetDraft) return;
    fn(sheetDraft);
    refreshSheet();
    return;
  }
  if (!boardCtx) return;
  fn(boardCtx.f);
  syncFilterState();
  refreshBoard();
}
function inSheet(el: HTMLElement): boolean { return !!el.closest('#filterSheet'); }

let delegatesReady = false;
function initDelegates() {
  if (delegatesReady) return;
  delegatesReady = true;
  document.addEventListener('click', (e) => {
    const el = e.target as HTMLElement;
    const moneyAddr = el.closest<HTMLElement>('[data-money-addr]');
    if (moneyAddr) {
      try { sessionStorage.setItem('evenfield.v3.moneyaddr', moneyAddr.dataset.moneyAddr!); } catch { /* ignore */ }
    }
    const act = el.closest<HTMLElement>('[data-act]');
    // Clicking anywhere outside the search wrap closes suggestions.
    if (!el.closest('.search-wrap')) hideSuggest();
    if (!act) return;
    const a = act.dataset.act;
    const target: 'board' | 'sheet' = inSheet(act) ? 'sheet' : 'board';
    if (a === 'preset') {
      const p = act.dataset.preset!;
      mutateFilters((f) => { f.preset = f.preset === p ? null : p; }, 'board');
    } else if (a === 'facet') {
      const g = act.dataset.group as FacetGroup;
      const v = act.dataset.value!;
      mutateFilters((f) => {
        const arr = f[g] as string[];
        const i = arr.indexOf(v);
        if (i >= 0) arr.splice(i, 1); else arr.push(v);
        // Asking for stopped coins in the Verdict facet means the user
        // wants them visible: lift the safe default in the same tap.
        if (g === 'verdict' && v === 'stopped' && i < 0) {
          if (target === 'sheet' && sheetDraft) sheetDraft.showStopped = true;
          else if (boardCtx) boardCtx.f.showStopped = true;
        }
      }, target);
      if (target === 'board') refreshBoard();
    } else if (a === 'toggle') {
      const which = act.dataset.toggle;
      mutateFilters((f) => {
        if (which === 'tests') f.showTests = !f.showTests;
        else f.showStopped = !f.showStopped;
      }, target);
      if (target === 'board') refreshBoard();
    } else if (a === 'chip-remove') {
      const kind = act.dataset.kind!;
      mutateFilters((f) => {
        if (kind === 'preset') f.preset = null;
        else if (kind === 'tests') f.showTests = false;
        else if (kind === 'stopped') f.showStopped = false;
        else if (kind === 'query') f.query = '';
        else {
          const arr = f[kind as FacetGroup] as string[];
          const i = arr.indexOf(act.dataset.value!);
          if (i >= 0) arr.splice(i, 1);
        }
      }, 'board');
    } else if (a === 'clear-all') {
      mutateFilters((f) => { Object.assign(f, clearFilters(f)); }, target);
      if (target === 'board') refreshBoard();
    } else if (a === 'loosen') {
      if (boardCtx && pendingLoosen) {
        boardCtx.f = pendingLoosen;
        syncFilterState();
        refreshBoard();
      }
    } else if (a === 'view') {
      mutateFilters((f) => { f.view = act.dataset.view as 'cards' | 'list'; }, 'board');
    } else if (a === 'sort') {
      mutateFilters((f) => { f.sort = act.dataset.sort as SortId; }, 'board');
    } else if (a === 'watch') {
      const curve = act.dataset.curve!;
      const now = toggleWatch(curve);
      act.setAttribute('aria-pressed', String(now));
      act.textContent = now ? '★' : '☆';
      if (boardCtx?.f.preset === 'watching') refreshBoard();
    } else if (a === 'open-filters') {
      openFilterSheet();
    } else if (a === 'sheet-close') {
      closeSheet();
    } else if (a === 'sheet-backdrop') {
      if (el === act) closeSheet();
    } else if (a === 'sheet-clear') {
      if (sheetDraft) { sheetDraft = { ...clearFilters(sheetDraft), query: sheetDraft.query }; refreshSheet(); }
    } else if (a === 'sheet-apply') {
      if (boardCtx && sheetDraft) {
        boardCtx.f = sheetDraft;
        syncFilterState();
        closeSheet();
        refreshBoard();
      }
    } else if (a === 'save-view') {
      const wrap = act.closest('.facet-group');
      const input = wrap?.querySelector<HTMLInputElement>('.save-view-name');
      const name = input?.value.trim();
      if (!name) { input?.focus(); return; }
      const src = target === 'sheet' ? sheetDraft : boardCtx?.f;
      if (!src) return;
      const views = savedViews().filter((v) => v.name !== name);
      views.push({ name, f: cloneFilters(src) });
      storeSavedViews(views);
      if (target === 'sheet') refreshSheet(); else refreshBoard();
    } else if (a === 'apply-view') {
      const v = savedViews()[Number(act.dataset.idx)];
      if (!v) return;
      if (target === 'sheet') { sheetDraft = cloneFilters(v.f); refreshSheet(); }
      else if (boardCtx) { boardCtx.f = cloneFilters(v.f); syncFilterState(); refreshBoard(); }
    } else if (a === 'suggest-all') {
      const input = document.querySelector<HTMLInputElement>('#boardSearch');
      if (boardCtx && input) {
        boardCtx.f.query = input.value.trim();
        syncFilterState();
        hideSuggest();
        refreshBoard();
        document.querySelector('#boardMain')?.scrollIntoView({ block: 'start' });
      }
    }
  });
  document.addEventListener('input', (e) => {
    const el = e.target as HTMLElement;
    if (el.id === 'boardSearch' && boardCtx) {
      // Typing only drives suggestions; the query becomes a filter when
      // the user picks "See all results" or presses Enter (form-less
      // input, handled in keydown), so the board never thrashes.
      showSuggest();
    }
  });
  document.addEventListener('focusin', (e) => {
    if ((e.target as HTMLElement).id === 'boardSearch') showSuggest();
  });
  document.addEventListener('change', (e) => {
    const el = e.target as HTMLElement;
    if (el.id === 'sortSel' && boardCtx) {
      boardCtx.f.sort = (el as HTMLSelectElement).value as SortId;
      syncFilterState();
      refreshBoard();
    }
  });
  document.addEventListener('keydown', (e) => {
    const el = e.target as HTMLElement;
    const typing = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable;
    if (e.key === 'Escape') { closeSheet(); hideSuggest(); return; }
    if (el.id === 'boardSearch' && e.key === 'Enter') {
      e.preventDefault();
      const input = el as HTMLInputElement;
      if (boardCtx) {
        boardCtx.f.query = input.value.trim();
        syncFilterState();
        hideSuggest();
        refreshBoard();
      }
      return;
    }
    if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === '/') {
      const input = document.querySelector<HTMLInputElement>('#boardSearch');
      if (input) { e.preventDefault(); input.focus(); }
    } else if (e.key === 'f') {
      if (window.innerWidth >= 1024) {
        document.querySelector<HTMLElement>('#filterRail .facet-val, #filterRail .toggle-row')?.focus();
        document.querySelector('#filterRail')?.scrollIntoView({ block: 'start' });
      } else {
        openFilterSheet();
      }
    } else if (e.key >= '1' && e.key <= '6') {
      if (!boardCtx) return;
      const p = PRESETS[Number(e.key) - 1];
      boardCtx.f.preset = boardCtx.f.preset === p ? null : p;
      syncFilterState();
      refreshBoard();
    } else if (e.key === 'w') {
      const card = el.closest?.('[data-curve]') as HTMLElement | null;
      if (card?.dataset.curve) {
        const now = toggleWatch(card.dataset.curve);
        const btn = card.querySelector<HTMLButtonElement>('[data-act="watch"]');
        if (btn) { btn.setAttribute('aria-pressed', String(now)); btn.textContent = now ? '★' : '☆'; }
      }
    } else if (e.key === '?') {
      openShortcutsSheet();
    }
  });
}

// ---------- evidence + verdict stage ----------
function evidenceList(l: Launch): string {
  const items: string[] = [];
  items.push(`<li>${esc(t('evidence.launched.at', { block: fmtNum(l.block) }))} · <a href="${txLink(l.tx)}" target="_blank" rel="noopener">${esc(t('evidence.tx'))}</a> <span class="tx-hash">${esc(shortAddr(l.tx))}</span></li>`);
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

/** The creator summary sentence, with a singular form for a
 *  one-launch creator (the plural template printed "1 coins"). */
function creatorSentence(c: CreatorRec): string {
  const n = Math.max(0, c.realLaunches - c.unreadable);
  return t(n === 1 ? 'verdict.sentence.one' : 'verdict.sentence', {
    n, g: c.graduated,
    t: Math.max(0, c.realLaunches - c.unreadable - c.graduated - c.stopped), s: c.stopped,
  });
}

function verdictStage(l: Launch): string {
  const c = creatorOf(l);
  const totals = c && c.realLaunches > 0 && verdictKind(l) !== 'test'
    ? `<p>${esc(creatorSentence(c))}</p>`
    : '';
  return `<section class="verdict-panel" aria-label="${esc(t('verdict.title'))}">
    <h2>${esc(t('verdict.title'))}</h2>
    <p>${verdictChip(l)}</p>
    ${verdictStageLines(l)}
    ${totals}
    <div class="btn-row">
      <button class="btn btn-ghost" data-evidence="${l.curve}" aria-expanded="false">${esc(t('verdict.receipts.btn'))}</button>
      <a class="btn btn-ghost" href="#/creator/${l.creator}">${esc(t('verdict.full.btn'))}</a>
      <a class="btn btn-ghost" href="#/method">${esc(t('verdict.how'))}</a>
    </div>
    <div class="drawer" id="drawer-${l.curve}" hidden>
      <h3>${esc(t('evidence.title'))}</h3>
      ${evidenceList(l)}
    </div>
  </section>`;
}

/** Real SVG bonding-curve chart from snapshot data: the fill progress is
 *  the measured fact; the path is the curve's rising price shape, and the
 *  marker sits at the measured progress. No spot price is printed here:
 *  the launch curve's sqrtPrice is not a Uniswap-style X96 anyone can
 *  rescale safely (it disagrees with the reserves ratio and with the
 *  live quote by orders of magnitude), so the only prices this page
 *  prints come from the live quote engine. */
function curveChart(l: Launch): string {
  const st = l.state;
  if (!st?.sqrtPrice || l.progressPct === null) {
    return `<section class="panel"><h2>${esc(t('chart.title'))}</h2><p class="dim">${esc(t('chart.nodata'))}</p></section>`;
  }
  const pct = Math.max(0, Math.min(100, l.progressPct));
  const W = 640, H = 232, PL = 8, PB = 38, PT = 12;
  const x = (p: number) => PL + (p / 100) * (W - PL - 8);
  const y = (p: number) => PT + (1 - (p / 100) ** 2) * (H - PT - PB);
  let d = `M ${x(0).toFixed(1)} ${y(0).toFixed(1)}`;
  for (let p = 5; p <= 100; p += 5) d += ` L ${x(p).toFixed(1)} ${y(p).toFixed(1)}`;
  return `<section class="panel"><h2>${esc(t('chart.title'))}</h2>
    <div class="chart-wrap"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(t('chart.note', { pct: fmtNum(pct, { maximumFractionDigits: 1 }) + '%' }))}">
      <path d="${d} L ${x(100).toFixed(1)} ${y(0).toFixed(1)} Z" fill="var(--action)" opacity="0.14"></path>
      <path d="${d}" fill="none" stroke="var(--action)" stroke-width="3" stroke-linejoin="round"></path>
      <circle cx="${x(pct).toFixed(1)}" cy="${y(pct).toFixed(1)}" r="7" fill="var(--canvas)" stroke="var(--action)" stroke-width="3"></circle>
      <text x="${x(0).toFixed(1)}" y="${H - 10}" fill="var(--text-2)" font-size="17">0%</text>
      <text x="${(x(100) - 46).toFixed(1)}" y="${H - 10}" fill="var(--text-2)" font-size="17">100%</text>
    </svg></div>
    <p class="dim small">${esc(t('chart.note', { pct: fmtNum(pct, { maximumFractionDigits: 1 }) + '%' }))}</p>
  </section>`;
}

function statBlock(label: string, value: string, meaning: string): string {
  return `<div class="stat"><span class="stat-l">${esc(label)}</span><span class="stat-n">${esc(value)}</span><span class="stat-m">${esc(meaning)}</span></div>`;
}

// ---------- coin page (spec S6 order) ----------
async function pageCoin(curve: string): Promise<string> {
  countView('coin');
  const l = byCurve.get(curve.toLowerCase());
  if (!l) return `<p class="empty">${esc(t('search.none'))}</p><p><a class="back-link" href="#/">${esc(t('common.back'))}</a></p>`;
  pushRecent({ kind: 'coin', id: l.curve, label: displayName(l) });
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
    statBlock(t('coin.state.status'), t(`stage.${stageOf(l)}`), t('coin.state.status.meaning')),
    statBlock(t('coin.state.raised'), raised, t('coin.state.raised.meaning')),
    statBlock(t('coin.state.swaps'), fmtNum(l.evidence.swapCount), t('coin.state.swaps.meaning')),
    statBlock(
      t('coin.state.lasttrade'),
      l.evidence.lastSwapBlock ? agoOfBlock(l.evidence.lastSwapBlock) : '—',
      l.evidence.lastSwapBlock ? t('coin.state.lasttrade.meaning') : t('coin.state.lasttrade.none'),
    ),
  ].join('');
  // Holder concentration (audit F-3): its own panel with the scale
  // line printed next to the number, three-state honest when the
  // snapshot could not read holders for this coin.
  const holdersPanel = l.evidence.holders
    ? `<section class="panel cg-holders"><h2>${esc(t('coin.holders.title'))}</h2>
      <div class="stats">
        ${statBlock(t('coin.state.holders'), fmtNum(l.evidence.holders.count), t('coin.holders.note2'))}
        ${statBlock(t('coin.holders.top1'), fmtPct(l.evidence.holders.top1Pct), t('coin.holders.note2'))}
        ${statBlock(t('coin.holders.top10'), fmtPct(l.evidence.holders.top10Pct), t('coin.holders.note2'))}
      </div>
      <div class="holder-scale" role="img" aria-label="${esc(t(l.evidence.holders.top10Pct <= 30 ? 'coin.holders.scale.inside' : 'coin.holders.scale.above', { top10: fmtPct(l.evidence.holders.top10Pct) }))}">
        <div class="holder-scale-fill${l.evidence.holders.top10Pct > 30 ? ' hot' : ''}" style="width:${Math.min(100, l.evidence.holders.top10Pct)}%"></div>
        <span class="holder-scale-mark" style="left:30%"></span>
      </div>
      <p class="card-line" style="margin-top:8px">${esc(t(l.evidence.holders.top10Pct <= 30 ? 'coin.holders.scale.inside' : 'coin.holders.scale.above', { top10: fmtPct(l.evidence.holders.top10Pct) }))}</p>
    </section>`
    : `<section class="panel cg-holders"><h2>${esc(t('coin.holders.title'))}</h2><p class="card-line dim">${esc(t('coin.holders.none'))}</p></section>`;
  const others = snap!.launches.filter((x) =>
    x.creator.toLowerCase() === l.creator.toLowerCase() && x.curve.toLowerCase() !== l.curve.toLowerCase());
  const moreFrom = others.length
    ? `<div class="cq"><div class="grid">${others.slice(0, 6).map(coinCard).join('')}</div></div>
       <div class="btn-row"><a class="btn btn-ghost" href="#/creator/${l.creator}">${esc(t('verdict.full.btn'))}</a></div>`
    : `<p class="card-line">${esc(t('coin.onlylaunch'))}</p>
       <div class="btn-row"><a class="btn btn-ghost" href="#/creator/${l.creator}">${esc(t('verdict.full.btn'))}</a></div>`;
  const presets = ['0.01', '0.05', '0.1'].map((a) =>
    `<button type="button" class="preset-chip" data-qpreset="${a}">${a} ${esc(quoteSym)}</button>`).join('');
  return `<article class="coin">
    <p><a class="back-link" href="#/">${esc(t('common.back'))}</a></p>
    <div class="coin-head">${identicon(l.curve, 'identicon-lg')}
      <div class="card-names"><h1>${esc(displayName(l))}</h1><span class="card-sym">${esc(l.symbol ?? '')}</span></div>
      ${stagePill(l)}
      <button class="btn btn-ghost" id="watchBtn" aria-pressed="${watching}">${esc(t(watching ? 'watch.remove' : 'watch.add'))}</button>
    </div>
    <p class="card-line" style="margin-top:12px">${esc(t('coin.creator'))} ${addrChip(l.creator)} <span class="nowrap">· ${esc(t('card.launched', { ago: agoOfBlock(l.block) }))}</span></p>
    ${l.evidence.currentCreator.toLowerCase() !== l.creator.toLowerCase() ? `<p class="card-line dim">${esc(t('passport.currentnote', { addr: shortAddr(l.evidence.currentCreator) }))}</p>` : ''}
    <div class="coin-grid">
      <div class="cg-verdict">${verdictStage(l)}</div>
      <section class="panel cg-quote" id="quotePanel">
        <h2>${esc(t('coin.quote.title'))}</h2>
        <div class="preset-row quote-presets">${presets}</div>
        <form id="quoteForm" class="quote-form">
          <label>${esc(t('coin.quote.amount'))} (${esc(quoteSym)})
            <input id="quoteAmount" inputmode="decimal" value="0.01"></label>
          <button class="btn" type="submit">${esc(t('coin.quote.btn'))}</button>
        </form>
        <div id="quoteOut" aria-live="polite" style="margin-top:12px"></div>
      </section>
      <div class="cg-chart">${curveChart(l)}</div>
      <section class="panel cg-stats"><h2>${esc(t('coin.state.title'))}</h2><div class="stats">${stats}</div></section>
      ${holdersPanel}
      <section class="panel cg-more"><h2>${esc(t('coin.morefrom'))}</h2>${moreFrom}</section>
    </div>
    <div class="quote-dock" role="group" aria-label="${esc(t('coin.quotebar'))}">
      <span class="quote-dock-label">${esc(t('coin.quotebar'))}</span>
      ${['0.01', '0.05', '0.1'].map((a) => `<button type="button" class="preset-chip" data-qpreset="${a}">${a}</button>`).join('')}
      <button type="button" class="btn quote-dock-go" data-qgo>${esc(t('coin.quote.btn'))}</button>
    </div>
  </article>`;
}

function wireCoin(curve: string) {
  const l = byCurve.get(curve.toLowerCase());
  if (!l || !snap) return;
  wireAddrChips(document);
  $('#watchBtn')?.addEventListener('click', () => {
    toggleWatch(l.curve);
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
        <p class="card-line dim small">${esc(t('coin.quote.live', { ago: fmtAgo(new Date()) }))}</p>`;
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
          <p class="card-line dim small">${esc(t('coin.quote.stale', { ago: fmtAgo(new Date(snap!.builtAt)) }))}</p>`;
      } else {
        out.innerHTML = `<p class="card-line">${esc(t('coin.quote.none'))}</p>`;
      }
    }
  };
  form.addEventListener('submit', (e) => { e.preventDefault(); void runQuote(); });
  document.querySelectorAll<HTMLButtonElement>('[data-qpreset]').forEach((b) =>
    b.addEventListener('click', () => {
      $<HTMLInputElement>('#quoteAmount').value = b.dataset.qpreset!;
      void runQuote();
      document.querySelector('#quotePanel')?.scrollIntoView({ block: 'nearest' });
    }));
  document.querySelector<HTMLButtonElement>('[data-qgo]')?.addEventListener('click', () => {
    void runQuote();
    document.querySelector('#quotePanel')?.scrollIntoView({ block: 'center' });
  });
  void runQuote();
}

// ---------- creator passport ----------
function pageCreator(addr: string): string {
  countView('creator');
  const c = byCreator.get(addr.toLowerCase());
  const mine = snap!.launches.filter((l) => l.creator.toLowerCase() === addr.toLowerCase());
  if (!c && !mine.length) return `<p class="empty">${esc(t('search.none'))}</p><p><a class="back-link" href="#/">${esc(t('common.back'))}</a></p>`;
  pushRecent({ kind: 'creator', id: addr, label: shortAddr(addr) });
  const real = mine.filter((l) => !l.testLaunch);
  const tests = mine.filter((l) => l.testLaunch);
  const early = real.filter((l) => l.evidence.creatorSoldEarly);
  const outcome = (label: string, n: number) => `<div class="stat"><span class="stat-n">${fmtNum(n)}</span><span class="stat-l">${esc(label)}</span></div>`;
  return `<article class="creator">
    <p><a class="back-link" href="#/">${esc(t('common.back'))}</a></p>
    <div class="coin-head">${identicon(addr, 'identicon-lg')}<h1>${esc(t('passport.title'))}</h1></div>
    <p class="card-line" style="margin-top:12px">${addrChip(addr)} <a class="explorer-link" href="${addrLink(addr)}" target="_blank" rel="noopener">${esc(t('evidence.explorer'))}</a></p>
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

// ---------- shell: header, tab bar, wallet ----------
let walletState: WalletState = { status: 'disconnected' };
let walletReady = false;
let prevWalletStatus = 'disconnected';

function walletButtonHtml(): string {
  const s = walletState;
  if (s.status === 'connecting') return `<button class="wallet-btn" id="walletBtn" disabled>${esc(t('wallet.connecting'))}</button>`;
  if (s.status === 'wrong-network') return `<button class="wallet-btn wrong" id="walletBtn">⚠ ${esc(t('wallet.wrong'))}</button>`;
  if (s.status === 'connected' && s.address) {
    return `<button class="wallet-btn" id="walletBtn"><span class="addr">${esc(shortAddr(s.address))}</span><span class="dim small">GIWA Sepolia</span></button>`;
  }
  return `<button class="wallet-btn primary" id="walletBtn">${esc(t('wallet.connect'))}</button>`;
}

const NAV_TABS = [
  ['/', 'nav.tab.board', '▦'], ['/watching', 'nav.tab.watching', '★'], ['/money', 'nav.tab.money', '◈'],
  ['/chain', 'nav.tab.chain', '⛓'], ['/more', 'nav.tab.more', '⋯'],
] as const;
function navActive(path: string): string {
  if (path === '/coin' || path === '/creator') return '/';
  if (path === '/method' || path === '/dispute') return '/more';
  return path;
}
function shellHtml(active: string): string {
  const themeIcon = currentTheme() === 'dark' ? '☀' : '☾';
  return `<header class="topbar">
      <a class="brand" href="#/">Evenfield</a>
      <nav class="topnav" aria-label="Primary">${NAV_TABS.map(([href, key]) => `<a href="#${href}" class="${active === href ? 'active' : ''}">${esc(t(key))}</a>`).join('')}</nav>
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
  return `<nav class="tabbar" aria-label="Primary">${NAV_TABS.map(([href, key, icon]) =>
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
  $('#shell').innerHTML = shellHtml(navActive(active));
  const fn = document.getElementById('footer-note');
  if (fn) fn.textContent = t('footer.note');
  const ft = document.getElementById('footer-tag');
  if (ft) ft.textContent = t('app.tagline');
  $('#tabbar').innerHTML = tabbarHtml(navActive(active));
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
      const became = prevWalletStatus !== 'connected' && s.status === 'connected';
      prevWalletStatus = s.status;
      walletState = s;
      const slot = $('#wallet-slot');
      if (slot) {
        slot.innerHTML = walletButtonHtml();
        $('#walletBtn')?.addEventListener('click', () => { void openWalletSheet(); });
      }
      // Arriving connected on the money page means the check the user
      // came for can start by itself (spec S7, task T5).
      if (became && routeOf().path === '/money') void render();
    });
    await w.initWallet();
  } catch { /* wallet is optional for browsing; the sheet explains states */ }
}

// ---------- money center (Glean engine, spec S7 presentation) ----------
let moneyDisc: Discovery | null = null;
let moneyResult: LookupResult | null = null;
let moneyAutoFor: string | null = null;
let moneyDisplay = new Map<string, string>();

/** Gate 7 amount formatting: >= 1 unit gets 2-4 decimals; below that
 *  the value shows at 6 decimals, and below 0.001 it shows its real
 *  significant digits (a claimable 0.000296 must never print as the
 *  unusable "<0.001"; audit P-5) down to the magnitude where only
 *  dust lives, where the compact form returns and the exact value
 *  stays one tap away. */
function fmtAmountDisplay(raw: bigint, decimals: number): { text: string; exact: string } {
  const human = Number(formatUnits(raw, decimals));
  const exact = formatUnits(raw, decimals); // exact decimal string, no rounding
  if (human >= 1) return { text: fmtNum(human, { maximumFractionDigits: human >= 100 ? 2 : 4 }), exact };
  if (human >= 0.001) return { text: fmtNum(human, { maximumFractionDigits: 6 }), exact };
  const sig = fmtPrice(human);
  const trimmed = sig.includes('.') ? sig.replace(/0+$/, '').replace(/\.$/, '') : sig;
  return { text: trimmed.length <= 12 ? trimmed : '<0.001', exact };
}

function barcodeAvailable(): boolean {
  return typeof window !== 'undefined' && 'BarcodeDetector' in window && !!navigator.mediaDevices?.getUserMedia;
}

function pageMoney(): string {
  countView('money');
  const s = walletState;
  let gate = '';
  if (s.status === 'connected' && s.address) {
    gate = `<p class="card-line" style="margin-top:16px">${esc(t('money.autocheck', { addr: shortAddr(s.address) }))}</p>`;
  } else if (s.status === 'wrong-network') {
    gate = `<p class="stale-banner" style="margin-top:16px">${esc(t('money.wrongchain'))}</p>`;
  } else {
    gate = `<div class="btn-row"><button class="btn" id="moneyConnect" type="button">${esc(t('money.connectcheck'))}</button></div>`;
  }
  return `<article class="money">
    <h1 class="page-title">${esc(t('money.title'))}</h1>
    <p class="sub">${esc(t('money.sub'))}</p>
    ${gate}
    <section class="panel">
      <h2>${esc(t('money.paste.title'))}</h2>
      <p class="card-line dim small">${esc(t('money.paste.hint'))}</p>
      <form id="moneyForm" class="quote-form" style="margin-top:12px">
        <label>${esc(t('common.address'))}<input id="moneyAddr" placeholder="${esc(t('money.placeholder'))}" spellcheck="false"></label>
        <button class="btn" type="submit">${esc(t('money.check'))}</button>
        ${barcodeAvailable() ? `<button class="btn btn-ghost" type="button" id="moneyScan">${esc(t('money.scan'))}</button>` : ''}
      </form>
    </section>
    <div id="moneyOut" aria-live="polite"></div>
  </article>`;
}

async function runMoneyCheck(addr: string) {
  const out = $('#moneyOut');
  if (!out) return;
  if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) { out.innerHTML = `<p class="empty">${esc(t('money.badaddr'))}</p>`; return; }
  out.innerHTML = `<p class="progress-line">${esc(t('money.checking'))}</p>
    <p class="dim small">${esc(t('money.expected'))}</p>
    <div class="skeleton skeleton-row"></div><div class="skeleton skeleton-row"></div><div class="skeleton skeleton-row"></div>`;
  try {
    const m = await moneyMod();
    if (!moneyDisc) moneyDisc = await m.discover();
    moneyResult = await m.lookup(addr as Address, moneyDisc, (done, total) => {
      const o = $('#moneyOut');
      if (o) {
        o.innerHTML = `<p class="progress-line">${esc(t('money.progress', { done, total }))}</p>
          <p class="dim small">${esc(t('money.expected'))}</p>
          <div class="skeleton skeleton-row"></div><div class="skeleton skeleton-row"></div>`;
      }
    });
    await renderMoneyRows(moneyResult);
  } catch {
    out.innerHTML = `<div class="error-box"><p>${esc(t('row.unavailable'))}</p><div class="btn-row"><button class="btn btn-ghost" id="moneyRetry">${esc(t('state.retry'))}</button></div></div>`;
    $('#moneyRetry')?.addEventListener('click', () => { void runMoneyCheck(addr); });
  }
}

async function renderMoneyRows(res: LookupResult) {
  const m = await moneyMod();
  const out = $('#moneyOut');
  if (!out) return;
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
  // One dust rule in every panel (Gate 16): native/WETH amounts at or
  // below the claim's own gas cost are dust; any other token below
  // 0.001 units is dust. A dust amount never gets an enabled Claim.
  const isDust = async (r: ClaimRow): Promise<boolean> => {
    if (!r.amount || r.amount <= 0n) return false;
    const md = await metaOf(r.token);
    const nativeLike = r.token === null || r.token.toLowerCase() === m.WETH.toLowerCase();
    if (nativeLike && dustThreshold !== null) return r.amount <= dustThreshold;
    return Number(formatUnits(r.amount, md.decimals)) < 0.001;
  };
  const claimable = res.rows.filter((r) => r.state === 'claimable' && r.amount && r.amount > 0n);
  const dustFlags = new Map<string, boolean>();
  for (const r of claimable) dustFlags.set(r.key, await isDust(r));
  const realClaimable = claimable.filter((r) => !dustFlags.get(r.key));
  const dustRows = claimable.filter((r) => dustFlags.get(r.key));

  moneyDisplay = new Map();
  for (const r of claimable) {
    const md = await metaOf(r.token);
    moneyDisplay.set(r.key, `${fmtAmountDisplay(r.amount!, md.decimals).text} ${md.symbol}`);
  }

  // Plain-words summary first (spec S7): what is worth claiming, in
  // per-token totals, then the dust count. No run-on totals line.
  const totals = new Map<string, { amount: bigint; token: Address | null }>();
  for (const r of realClaimable) {
    const key = (r.token ?? 'native').toLowerCase();
    const cur = totals.get(key) ?? { amount: 0n, token: r.token };
    cur.amount += r.amount!;
    totals.set(key, cur);
  }
  // Plain-words summary first (audit P-5): one line saying how many
  // amounts are worth claiming, the biggest in words, then per-token
  // totals as their own rows. Dust is counted and named as dust in
  // its own sentence, never inside the worth-claiming sentence, and
  // no "<0.001" string ever appears in the summary.
  const worthRows: string[] = [];
  for (const v of totals.values()) {
    const md = await metaOf(v.token);
    const disp = fmtAmountDisplay(v.amount, md.decimals);
    worthRows.push(`<li><span class="money-amount">${esc(disp.text)}</span> <strong>${esc(md.symbol)}</strong></li>`);
  }
  let biggestText = '';
  {
    let best = -1;
    for (const r of realClaimable) {
      const md = await metaOf(r.token);
      const human = Number(formatUnits(r.amount!, md.decimals));
      if (human > best) { best = human; biggestText = moneyDisplay.get(r.key) ?? ''; }
    }
  }
  const connectedAddr = walletState.status === 'connected' || walletState.status === 'wrong-network' ? walletState.address : undefined;
  const isOwner = walletState.status === 'connected' && connectedAddr?.toLowerCase() === res.address.toLowerCase();
  const differs = connectedAddr && connectedAddr.toLowerCase() !== res.address.toLowerCase();
  const summary = `<section class="panel summary-card">
    ${realClaimable.length
      ? `<p class="fact">${esc(t('money.summary.worth2', { n: realClaimable.length }))}</p>
    ${biggestText ? `<p class="card-line" style="margin-top:4px">${esc(t('money.summary.biggest', { amount: biggestText }))}</p>` : ''}
    <p class="card-line dim" style="margin-top:8px">${esc(t('money.summary.totals'))}</p>
    <ul class="money-totals">${worthRows.join('')}</ul>`
      : `<p class="fact">${esc(t('money.summary.none'))}</p>`}
    ${dustRows.length ? `<p class="card-line dim" style="margin-top:8px">${esc(t('money.summary.dust', { n: dustRows.length }))}</p>` : ''}
    ${realClaimable.length && isOwner ? `<div class="btn-row"><button class="btn" type="button" id="claimAllBtn">${esc(t('money.claimall'))}</button></div>` : ''}
  </section>`;

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
      const claimBtn = isOwner
        ? `<button class="btn" data-claim="${esc(r.key)}">${esc(t('money.claim'))}</button>`
        : walletState.status === 'connected'
          ? `<button class="btn" disabled>${esc(t('money.claim'))}</button>`
          : `<button class="btn" data-claim-connect="${esc(r.key)}">${esc(t('money.connect'))}</button>`;
      rowHtml.push(`<div class="money-row"><div><span class="money-amount" data-exact="${esc(disp.exact)}" data-display="${esc(disp.text)}">${esc(disp.text)}</span> <strong>${esc(md.symbol)}</strong> <span class="dim small">${esc(src)} ${esc(role)}</span>
        ${disp.text !== disp.exact ? `<button type="button" class="addr-chip" data-amount-toggle style="border:0;background:transparent;color:var(--link);cursor:pointer;font-weight:700;min-height:32px">${esc(t('money.dust.exact'))}</button>` : ''}</div>
        ${claimBtn}</div>`);
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
      : `<p class="card-line dim">${esc(t('row.unavailable.note'))}</p>`;
    streamSections.push(`<section class="panel"><h2>${esc(t(`stream.${s}.title`))}</h2><p class="card-line dim">${esc(t(`stream.${s}.about`))}</p>${rowHtml.join('')}${dustHtml}${okLine}</section>`);
  }
  out.innerHTML = `<p class="card-line" style="margin-top:16px">${esc(t('money.resultsfor', { addr: '' }))} ${addrChip(res.address)}</p>
    <p class="dim small">${esc(t('money.asof', { time: fmtAgo(new Date()) }))}</p>
    ${differs ? `<p class="stale-banner">${esc(t('money.differs', { addr: shortAddr(connectedAddr!) }))}</p>` : ''}
    ${summary}
    ${streamSections.join('')}
    ${Object.values(res.streamOk).some((v) => !v) ? `<p class="card-line dim" style="margin-top:16px">${esc(t('money.unavail.calm'))}</p>` : ''}`;
  wireAddrChips(out);
  out.querySelectorAll<HTMLButtonElement>('[data-amount-toggle]').forEach((b) =>
    b.addEventListener('click', () => {
      const span = b.parentElement?.querySelector('.money-amount') as HTMLElement | null;
      if (!span) return;
      span.textContent = span.textContent === span.dataset.exact ? span.dataset.display! : span.dataset.exact!;
    }));
  out.querySelectorAll<HTMLButtonElement>('[data-claim-connect]').forEach((btn) =>
    btn.addEventListener('click', () => { void openWalletSheet(); }));
  out.querySelectorAll<HTMLButtonElement>('[data-claim]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const row = moneyResult?.rows.find((r) => r.key === btn.dataset.claim);
      if (row) openClaimSheet([row], res);
    }));
  $('#claimAllBtn')?.addEventListener('click', () => openClaimSheet(realClaimable, res));
}

/** Gate 16 confirm sheet: plain words first, then one signature per
 *  claim, each simulated inside executeClaim before it is sent. */
function openClaimSheet(rows: ClaimRow[], res: LookupResult) {
  const root = $('#sheet-root');
  const isOwner = walletState.status === 'connected' && walletState.address?.toLowerCase() === res.address.toLowerCase();
  const list = rows.map((r) => `<li>${esc(moneyDisplay.get(r.key) ?? '')}</li>`).join('');
  const body = !isOwner
    ? `<h2>${esc(t('money.confirm.title'))}</h2><p>${esc(t('money.confirm.notowner', { addr: shortAddr(res.address) }))}</p>`
    : `<h2>${esc(t('money.confirm.title'))}</h2>
       <ul class="evidence">${list}</ul>
       <p>${esc(t('money.confirm.note', { n: rows.length }))}</p>
       <p class="dim small">${esc(t('money.confirm.fee'))}</p>
       <div id="claimStatus"></div>
       <div class="btn-row"><button class="btn" id="claimGo">${esc(t('money.confirm.btn'))}</button></div>`;
  root.innerHTML = `<div class="sheet-backdrop" id="claimBackdrop"><div class="sheet" role="dialog" aria-modal="true">${body}
    <div class="btn-row"><button class="btn btn-ghost" id="claimClose">${esc(t('common.close'))}</button></div></div></div>`;
  const close = () => { root.innerHTML = ''; };
  $('#claimClose').addEventListener('click', close);
  $('#claimBackdrop').addEventListener('click', (e) => { if (e.target === e.currentTarget) close(); });
  $('#claimGo')?.addEventListener('click', async () => {
    const go = $('#claimGo') as HTMLButtonElement;
    const status = $('#claimStatus');
    go.disabled = true;
    try {
      const w = await walletMod();
      const wallet = await w.getConnectedWallet();
      const mm = await moneyMod();
      for (const row of rows) {
        const label = moneyDisplay.get(row.key) ?? row.key;
        try {
          await mm.executeClaim(wallet, row);
          if (status) status.innerHTML += `<p class="card-line">✓ ${esc(label)}</p>`;
        } catch {
          if (status) status.innerHTML += `<p class="card-line">${esc(t('money.confirm.failed'))} (${esc(label)})</p>`;
        }
      }
    } catch {
      if (status) status.innerHTML += `<p class="card-line">${esc(t('money.confirm.failed'))}</p>`;
    }
    go.textContent = t('money.confirm.done');
    go.disabled = false;
    go.onclick = () => { close(); void render(); };
  });
}

async function openScanSheet() {
  const root = $('#sheet-root');
  root.innerHTML = `<div class="sheet-backdrop" id="scanBackdrop"><div class="sheet" role="dialog" aria-modal="true">
    <h2>${esc(t('money.scan'))}</h2>
    <video id="scanVideo" autoplay playsinline muted style="width:100%;border-radius:12px;background:#000"></video>
    <div class="btn-row"><button class="btn btn-ghost" id="scanClose">${esc(t('common.close'))}</button></div>
  </div></div>`;
  let stream: MediaStream | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  const close = () => {
    if (timer) clearInterval(timer);
    stream?.getTracks().forEach((tr) => tr.stop());
    root.innerHTML = '';
  };
  $('#scanClose').addEventListener('click', close);
  $('#scanBackdrop').addEventListener('click', (e) => { if (e.target === e.currentTarget) close(); });
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    const video = document.querySelector<HTMLVideoElement>('#scanVideo');
    if (!video) { close(); return; }
    video.srcObject = stream;
    const Detector = (window as unknown as { BarcodeDetector: new (o: { formats: string[] }) => { detect(v: HTMLVideoElement): Promise<{ rawValue: string }[]> } }).BarcodeDetector;
    const detector = new Detector({ formats: ['qr_code'] });
    timer = setInterval(async () => {
      try {
        const codes = await detector.detect(video);
        const raw = codes[0]?.rawValue ?? '';
        const found = raw.match(/0x[0-9a-fA-F]{40}/);
        if (found) {
          close();
          const input = document.querySelector<HTMLInputElement>('#moneyAddr');
          if (input) input.value = found[0];
          void runMoneyCheck(found[0]);
        }
      } catch { /* keep scanning */ }
    }, 350);
  } catch { close(); }
}

function wireMoney() {
  $('#moneyConnect')?.addEventListener('click', () => { void openWalletSheet(); });
  $('#moneyScan')?.addEventListener('click', () => { void openScanSheet(); });
  const form = $<HTMLFormElement>('#moneyForm');
  const input = $<HTMLInputElement>('#moneyAddr');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    void runMoneyCheck(input.value.trim());
  });
  input.addEventListener('paste', () => {
    // Validate on paste: a full address starts its check by itself.
    setTimeout(() => {
      const v = input.value.trim();
      if (/^0x[0-9a-fA-F]{40}$/.test(v)) void runMoneyCheck(v);
    }, 0);
  });
  let pending: string | null = null;
  try { pending = sessionStorage.getItem('evenfield.v3.moneyaddr'); sessionStorage.removeItem('evenfield.v3.moneyaddr'); } catch { /* ignore */ }
  if (pending && /^0x[0-9a-fA-F]{40}$/.test(pending)) {
    input.value = pending;
    void runMoneyCheck(pending);
    return;
  }
  // Connected wallet: the check runs on arrival, zero taps (spec S7).
  if (walletState.status === 'connected' && walletState.address && moneyAutoFor !== walletState.address.toLowerCase()) {
    moneyAutoFor = walletState.address.toLowerCase();
    input.value = walletState.address;
    void runMoneyCheck(walletState.address);
  }
}

// ---------- chain checker ----------
function pageChain(): string {
  countView('chain');
  return `<article class="chain">
    <h1 class="page-title">${esc(t('chain.title'))}</h1>
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

// ---------- methodology + dispute + more ----------
function pageMethod(): string {
  countView('method');
  if (!snap) return '';
  return `<article class="method">
    <h1 class="page-title">${esc(t('method.title'))}</h1>
    <p class="sub">${esc(t('method.intro'))}</p>
    <section class="panel"><p>${esc(t('method.graduated'))}</p><p style="margin-top:12px">${esc(t('method.stopped', { stop: fmtNum(snap.params.stopBlocks) }))}</p>
    <p style="margin-top:12px">${esc(t('method.early', { early: fmtNum(snap.params.earlyBlocks) }))}</p>
    <p style="margin-top:12px">${esc(t('method.earlybands'))}</p>
    <p style="margin-top:12px">${esc(t('method.clean'))}</p>
    <p style="margin-top:12px">${esc(t('method.bundle'))}</p>
    <p style="margin-top:12px">${esc(t('method.test'))}</p><p style="margin-top:12px">${esc(t('method.creators'))}</p></section>
  </article>`;
}

function pageDispute(): string {
  countView('dispute');
  return `<article class="dispute">
    <h1 class="page-title">${esc(t('dispute.title'))}</h1>
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

function pageMore(): string {
  countView('more');
  const rows: [string, string][] = [
    ['/', 'shortcuts.search'], ['f', 'shortcuts.filters'], ['1–6', 'shortcuts.presets'],
    ['w', 'shortcuts.watch'], ['?', 'shortcuts.help'],
  ];
  return `<article class="more">
    <h1 class="page-title">${esc(t('more.title'))}</h1>
    <p class="sub">${esc(t('more.sub'))}</p>
    <section class="panel more-links">
      <a class="more-card" href="#/method"><strong>${esc(t('nav.method'))}</strong><span>${esc(t('method.intro'))}</span></a>
      <a class="more-card" href="#/dispute"><strong>${esc(t('nav.dispute'))}</strong><span>${esc(t('dispute.sub'))}</span></a>
    </section>
    <section class="panel"><h2>${esc(t('shortcuts.title'))}</h2>
      <ul class="shortcuts">${rows.map(([k, key]) => `<li><kbd>${esc(k)}</kbd> ${esc(t(key))}</li>`).join('')}</ul>
    </section>
  </article>`;
}

// ---------- router + boot ----------
function routeOf(): { path: string; param?: string; query: URLSearchParams; hasQuery: boolean } {
  const raw = location.hash.replace(/^#/, '') || '/';
  const qIdx = raw.indexOf('?');
  const pathPart = qIdx >= 0 ? raw.slice(0, qIdx) : raw;
  const query = new URLSearchParams(qIdx >= 0 ? raw.slice(qIdx + 1) : '');
  const parts = pathPart.split('/').filter(Boolean);
  if (!parts.length) return { path: '/', query, hasQuery: qIdx >= 0 };
  return { path: '/' + parts[0], param: parts[1], query, hasQuery: qIdx >= 0 };
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
  if (path === '/' && !param) { boardCtx = null; app.innerHTML = pageBoard('/'); }
  else if (path === '/watching' && !param) { boardCtx = null; app.innerHTML = pageBoard('/watching'); }
  else if (path === '/coin' && param) { boardCtx = null; app.innerHTML = await pageCoin(param); wireCoin(param); }
  else if (path === '/creator' && param) { boardCtx = null; app.innerHTML = pageCreator(param); wireAddrChips(document); }
  else if (path === '/money') { boardCtx = null; app.innerHTML = pageMoney(); wireMoney(); }
  else if (path === '/chain') { boardCtx = null; app.innerHTML = pageChain(); wireChain(); }
  else if (path === '/method') { boardCtx = null; app.innerHTML = pageMethod(); }
  else if (path === '/dispute') { boardCtx = null; app.innerHTML = pageDispute(); wireDispute(); }
  else if (path === '/more') { boardCtx = null; app.innerHTML = pageMore(); }
  else { boardCtx = null; app.innerHTML = pageBoard('/'); }
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
    initDelegates();
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
          evidence: { swapCount: 0, uniqueBuyers: 0, firstSwapBlock: null, lastSwapBlock: null, lastSwapTx: null, creatorBuys: 0, creatorBuyTotal: '0', creatorSellTotal: '0', creatorSells: [], creatorSoldEarly: false, earlySellPct: null, activitySpark: [], currentCreator: d.creator, creatorTransferred: null, holders: null, windows: [] },
          testLaunch: false, testReason: null, verdict: 'toonew', verdictReasons: [], price: null,
        };
        snap.launches.unshift(nl);
        byCurve.set(nl.curve.toLowerCase(), nl);
      }
      const p = routeOf().path;
      if (p === '/' || p === '/watching') void render();
    }
  } catch { /* delta is an enhancement, never a requirement */ }
}

void boot();
