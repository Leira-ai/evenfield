// Evenfield: the whole Ammora launch day in one place.
// Slice A: snapshot-first board, coin pages with live quotes and evidence
// backed verdicts, creator passports, the Glean-proven money center in read
// mode (claims only from the visitor's own wallet), the GIWA chain checker,
// published verdict methodology, and a public dispute path.
// No wallet is needed for the demo path. No raw RPC error is ever rendered.
import { formatUnits, parseUnits, type Address } from 'viem';
import fallbackSnapshot from './fallback-snapshot.json';
import {
  t, getLang, setLang, fmtNum, fmtAgo,
} from './i18n';
import {
  discover, lookup, tokenMeta, connectWallet, executeClaim, formatAmount, shortAddr,
  type ClaimRow, type Discovery, type LookupResult, type Wallet,
} from './money';
import { liveQuote, deltaScan, checkChainId, walletChainId, EXPLORER } from './chain';

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
  state: CurveState | null; statusName: string; stopped: boolean; progressPct: number | null;
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

// ---------- small helpers ----------
const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const txLink = (tx: string) => `${EXPLORER}/tx/${tx}`;
const addrLink = (a: string) => `${EXPLORER}/address/${a}`;
const byCurve = new Map<string, Launch>();
const byCreator = new Map<string, CreatorRec>();
let snap: Snapshot = fallbackSnapshot as unknown as Snapshot;
let deltaCount = 0;

function countView(route: string) {
  try {
    const key = 'evenfield.v1.analytics';
    const data = JSON.parse(localStorage.getItem(key) ?? '{"routes":{}}') as { routes: Record<string, number> };
    data.routes[route] = (data.routes[route] ?? 0) + 1;
    localStorage.setItem(key, JSON.stringify(data));
  } catch { /* analytics is best-effort and local only */ }
}

const VERDICT_ICON: Record<string, string> = { careful: '⚠', clean: '✓', toonew: '◔', test: '⚗', unknown: '?' };
function verdictChip(l: Launch): string {
  const key = `verdict.${l.verdict}` as const;
  return `<span class="chip chip-${l.verdict}"><span aria-hidden="true">${VERDICT_ICON[l.verdict] ?? '?'}</span> ${esc(t(key))}</span>`;
}
function stageOf(l: Launch): 'new' | 'near' | 'graduated' | 'other' {
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
  const initial = esc((l.symbol || l.name || '?').slice(0, 1).toUpperCase());
  const progress = l.statusName === 'graduated'
    ? `<p class="card-line">${esc(t('board.progress.done'))}</p>`
    : l.progressPct !== null
      ? `<div class="meter" role="img" aria-label="${esc(t('board.progress', { pct: fmtNum(l.progressPct, { maximumFractionDigits: 1 }) + '%' }))}"><div class="meter-fill" style="width:${Math.max(2, Math.min(100, l.progressPct))}%"></div></div><p class="card-line">${esc(t('board.progress', { pct: fmtNum(l.progressPct, { maximumFractionDigits: 1 }) + '%' }))}</p>`
      : `<p class="card-line">${esc(t('board.progress.none'))}</p>`;
  return `<article class="card">
    <div class="card-top"><span class="avatar" aria-hidden="true">${initial}</span>
      <div class="card-names"><a class="card-name" href="#/coin/${l.curve}">${esc(displayName(l))}</a>
      <span class="card-sym">${esc(l.symbol ?? '')}</span></div>${stagePill(l)}</div>
    <p class="card-line">${verdictChip(l)}</p>
    <p class="card-reason">${esc(cardReason(l))}</p>
    <p class="card-line">${esc(t('board.buyers', { n: fmtNum(l.evidence.uniqueBuyers) }))}</p>
    ${progress}
  </article>`;
}

// ---------- verdict sentences + evidence ----------
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
  // earliest early-sell case for this creator, preferring this coin
  const earlyLaunch = l.evidence.creatorSoldEarly ? l : (c?.earlySellLaunches.map((cv) => byCurve.get(cv)).find((x) => x?.evidence.creatorSoldEarly) ?? null);
  if (earlyLaunch) {
    const ev = earlyLaunch.evidence;
    const earlySells = ev.creatorSells.filter((s) => s.blocksAfterLaunch <= snap.params.earlyBlocks);
    const soldEarly = earlySells.reduce((sum, s) => sum + BigInt(s.amountIn), 0n);
    const bought = BigInt(ev.creatorBuyTotal || '0');
    if (bought > 0n && soldEarly > 0n) {
      const pct = fmtNum(Number((soldEarly * 10000n) / bought) / 100, { maximumFractionDigits: 1 }) + '%';
      out.push(t('verdict.sentence.sell', {
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
  items.push(`<li>${esc(t('coin.launched.at', { block: fmtNum(l.block) }))} · <a href="${txLink(l.tx)}" target="_blank" rel="noopener">${esc(t('evidence.tx'))}</a></li>`);
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

function verdictCard(l: Launch): string {
  const sentences = verdictSentences(l).map((s) => `<p>${esc(s)}</p>`).join('');
  return `<section class="panel verdict-panel">
    <h2>${esc(t('verdict.title'))}</h2>
    <p>${verdictChip(l)}</p>
    ${sentences}
    <div class="btn-row">
      <button class="btn btn-ghost" data-evidence="${l.curve}">${esc(t('verdict.receipts.btn'))}</button>
      <a class="btn btn-ghost" href="#/creator/${l.creator}">${esc(t('verdict.full.btn'))}</a>
    </div>
    <div class="drawer" id="drawer-${l.curve}" hidden>
      <h3>${esc(t('evidence.title'))}</h3>
      ${evidenceList(l)}
    </div>
  </section>`;
}

// ---------- pages ----------
function snapshotLine(): string {
  const built = new Date(snap.builtAt);
  const ago = fmtAgo(built);
  const live = deltaCount > 0;
  const txt = live || Date.now() - built.getTime() < 6.5 * 3600_000
    ? t('home.snapshot', { block: fmtNum(snap.headBlock), ago })
    : t('home.snapshot.stale', { block: fmtNum(snap.headBlock), ago });
  return `<p class="snapshot-line">${esc(txt)}${deltaCount ? ` ${esc(t('delta.note', { n: deltaCount }))}` : ''}</p>`;
}

function pageHome(): string {
  countView('home');
  const real = snap.launches.filter((l) => !l.testLaunch);
  const creators = snap.creators.length;
  const stages: ('new' | 'near' | 'graduated')[] = ['new', 'near', 'graduated'];
  const sections = stages.map((s) => {
    const items = snap.launches.filter((l) => stageOf(l) === s);
    const cards = items.length ? items.map(coinCard).join('') : `<p class="empty">${esc(t('board.empty'))}</p>`;
    return `<section class="stage"><h2>${esc(t(`stage.${s}`))}</h2><div class="grid">${cards}</div></section>`;
  }).join('');
  const weekFrom = snap.headBlock - 650_000;
  const weekNew = snap.launches.filter((l) => l.block >= weekFrom);
  const nearGrad = [...snap.launches]
    .filter((l) => l.statusName === 'trading' && l.progressPct !== null)
    .sort((a, b) => (b.progressPct ?? 0) - (a.progressPct ?? 0)).slice(0, 3);
  const weekly = `<section class="stage"><h2>${esc(t('weekly.title'))}</h2>
    <p class="card-line">${esc(t('weekly.sub'))}</p>
    <p class="card-line">${esc(t('weekly.new', { n: fmtNum(weekNew.length) }))} · ${esc(t('weekly.grads', { n: fmtNum(real.filter((l) => l.statusName === 'graduated').length) }))}</p>
    ${nearGrad.length ? `<div class="grid">${nearGrad.map(coinCard).join('')}</div>` : ''}</section>`;
  return `<section class="hero">
      <h1>${esc(t('home.headline'))}</h1>
      <p class="sub">${esc(t('home.sub'))}</p>
      <p class="fact">${esc(t('home.fact', { creators: fmtNum(creators), coins: fmtNum(snap.launches.length) }))}</p>
      ${snapshotLine()}
      <div class="search-row"><input id="search" type="search" placeholder="${esc(t('home.search.placeholder'))}" aria-label="${esc(t('home.search.placeholder'))}"></div>
      <div id="searchResults"></div>
    </section>
    <div id="board">${weekly}${sections}</div>`;
}

function wireHome() {
  const input = $<HTMLInputElement>('#search');
  const box = $('#searchResults');
  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    if (q.length < 2) { box.innerHTML = ''; return; }
    const coins = snap.launches.filter((l) =>
      (l.name ?? '').toLowerCase().includes(q) || (l.symbol ?? '').toLowerCase().includes(q) ||
      l.token.toLowerCase() === q || l.curve.toLowerCase() === q || l.creator.toLowerCase() === q).slice(0, 8);
    const creators = snap.creators.filter((c) => c.address.toLowerCase().includes(q)).slice(0, 5);
    if (!coins.length && !creators.length) { box.innerHTML = `<p class="empty">${esc(t('search.none'))}</p>`; return; }
    box.innerHTML = `<section class="stage"><h2>${esc(t('search.results'))}</h2>
      ${coins.length ? `<h3>${esc(t('search.coins'))}</h3><div class="grid">${coins.map(coinCard).join('')}</div>` : ''}
      ${creators.length ? `<h3>${esc(t('search.creators'))}</h3>${creators.map((c) => `<p class="card-line"><a href="#/creator/${c.address}">${esc(shortAddr(c.address))}</a> · ${esc(t('passport.launched', { n: c.totalLaunches }))}</p>`).join('')}` : ''}
    </section>`;
  });
}

async function pageCoin(curve: string): Promise<string> {
  countView('coin');
  const l = byCurve.get(curve.toLowerCase());
  if (!l) return `<p class="empty">${esc(t('search.none'))}</p><p><a href="#/">${esc(t('common.back'))}</a></p>`;
  const st = l.state;
  const raised = st?.quoteReserve ? fmtNum(Number(formatUnits(BigInt(st.quoteReserve), 18)), { maximumFractionDigits: 4 }) + ' ETH' : '—';
  const holders = l.evidence.holders
    ? `<p class="card-line">${esc(t('coin.state.holders'))}: ${fmtNum(l.evidence.holders.count)}</p>
       <p class="card-line">${esc(t('coin.state.holders.note', { top1: fmtNum(l.evidence.holders.top1Pct, { maximumFractionDigits: 1 }) + '%', top10: fmtNum(l.evidence.holders.top10Pct, { maximumFractionDigits: 1 }) + '%' }))}</p>`
    : '';
  return `<article class="coin">
    <p><a href="#/">${esc(t('common.back'))}</a></p>
    <div class="card-top"><span class="avatar avatar-lg" aria-hidden="true">${esc((l.symbol || l.name || '?').slice(0, 1).toUpperCase())}</span>
      <div class="card-names"><h1>${esc(displayName(l))}</h1><span class="card-sym">${esc(l.symbol ?? '')}</span></div>${stagePill(l)}</div>
    <p class="card-line">${esc(t('coin.creator'))} <a href="#/creator/${l.creator}">${esc(shortAddr(l.creator))}</a> · ${esc(t('coin.launched.at', { block: fmtNum(l.block) }))}</p>
    ${l.evidence.currentCreator.toLowerCase() !== l.creator.toLowerCase() ? `<p class="card-line">${esc(t('passport.currentnote', { addr: shortAddr(l.evidence.currentCreator) }))}</p>` : ''}
    <section class="panel">
      <h2>${esc(t('coin.state.title'))}</h2>
      <p class="card-line">${esc(t('coin.state.status'))}: ${esc(stageOf(l) === 'other' ? t('stage.all') : t(`stage.${stageOf(l)}`))}</p>
      <p class="card-line">${esc(t('coin.state.raised'))}: ${esc(raised)}</p>
      <p class="card-line">${esc(t('coin.state.swaps'))}: ${fmtNum(l.evidence.swapCount)}</p>
      <p class="card-line">${esc(t('coin.state.lasttrade'))}: ${l.evidence.lastSwapBlock ? esc(t('evidence.block', { block: fmtNum(l.evidence.lastSwapBlock) })) : esc(t('coin.state.lasttrade.none'))}</p>
      ${holders}
    </section>
    <section class="panel">
      <h2>${esc(t('coin.quote.title'))}</h2>
      <form id="quoteForm" class="quote-form">
        <label>${esc(t('coin.quote.amount'))} (ETH)
          <input id="quoteAmount" inputmode="decimal" value="0.01"></label>
        <button class="btn" type="submit">${esc(t('chain.check.btn'))}</button>
      </form>
      <div id="quoteOut" aria-live="polite"></div>
    </section>
    ${verdictCard(l)}
  </article>`;
}

function wireCoin(curve: string) {
  const l = byCurve.get(curve.toLowerCase());
  if (!l) return;
  const drawerBtn = document.querySelector<HTMLButtonElement>(`[data-evidence="${CSS.escape(l.curve)}"]`);
  drawerBtn?.addEventListener('click', () => {
    const d = document.getElementById(`drawer-${l.curve}`);
    if (d) d.hidden = !d.hidden;
  });
  const form = $<HTMLFormElement>('#quoteForm');
  const out = $('#quoteOut');
  const runQuote = async () => {
    const raw = $<HTMLInputElement>('#quoteAmount').value.trim().replace(',', '.');
    let amountIn: bigint;
    try { amountIn = parseUnits(raw as `${number}`, 18); if (amountIn <= 0n) throw new Error('zero'); }
    catch { out.innerHTML = `<p class="card-line">${esc(t('coin.quote.none'))}</p>`; return; }
    out.innerHTML = `<p class="card-line">${esc(t('common.loading'))}</p>`;
    const withTimeout = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
    try {
      const buy = await withTimeout(liveQuote(l.curve as Address, amountIn, false), 6000);
      let sellLine = '';
      try {
        const sell = await withTimeout(liveQuote(l.curve as Address, buy.amountOut, true), 6000);
        sellLine = `<p class="card-line">${esc(t('coin.quote.sellback'))} ${esc(fmtNum(Number(formatUnits(sell.amountOut, 18)), { maximumFractionDigits: 6 }))} ETH</p>`;
      } catch { /* sell-back is a bonus line; the buy quote already landed */ }
      out.innerHTML = `<p class="card-line">${esc(t('coin.quote.gets'))} ${esc(fmtNum(Number(formatUnits(buy.amountOut, l.decimals)), { maximumFractionDigits: 2 }))} ${esc(l.symbol ?? '')}</p>
        ${sellLine}
        <p class="card-line dim">${esc(t('coin.quote.live', { block: fmtNum(Number(buy.block)) }))}</p>`;
    } catch {
      // Fallback: indicative math from the snapshot curve state, labelled.
      const st = l.state;
      if (st?.sqrtPrice) {
        const sqrt = Number(BigInt(st.sqrtPrice)) / 2 ** 96;
        const price = sqrt * sqrt * 10 ** (l.decimals - 18); // quote per base, human units
        const est = price > 0 ? Number(formatUnits(amountIn, 18)) / price : 0;
        out.innerHTML = `<p class="card-line">${esc(t('coin.quote.gets'))} ${esc(fmtNum(est, { maximumFractionDigits: 2 }))} ${esc(l.symbol ?? '')}</p>
          <p class="card-line dim">${esc(t('coin.quote.stale', { block: fmtNum(snap.headBlock) }))}</p>`;
      } else {
        out.innerHTML = `<p class="card-line">${esc(t('coin.quote.none'))}</p>`;
      }
    }
  };
  form.addEventListener('submit', (e) => { e.preventDefault(); void runQuote(); });
  void runQuote();
}

function pageCreator(addr: string): string {
  countView('creator');
  const c = byCreator.get(addr.toLowerCase());
  const mine = snap.launches.filter((l) => l.creator.toLowerCase() === addr.toLowerCase());
  if (!c && !mine.length) return `<p class="empty">${esc(t('search.none'))}</p><p><a href="#/">${esc(t('common.back'))}</a></p>`;
  const real = mine.filter((l) => !l.testLaunch);
  const tests = mine.filter((l) => l.testLaunch);
  const early = real.filter((l) => l.evidence.creatorSoldEarly);
  const outcome = (label: string, n: number) => `<div class="stat"><span class="stat-n">${fmtNum(n)}</span><span class="stat-l">${esc(label)}</span></div>`;
  return `<article class="creator">
    <p><a href="#/">${esc(t('common.back'))}</a></p>
    <h1>${esc(t('passport.title'))}</h1>
    <p class="card-line"><a href="${addrLink(addr)}" target="_blank" rel="noopener">${esc(addr)}</a></p>
    <p class="card-line">${esc(t('passport.launched', { n: c?.totalLaunches ?? mine.length }))}</p>
    ${c && c.testLaunches ? `<p class="card-line">${esc(t('passport.testnote', { n: c.testLaunches }))}</p>` : ''}
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
           <p class="card-line dim">${esc(t('passport.earlysell.note', { blocks: fmtNum(snap.params.earlyBlocks) }))}</p>
           ${early.map((l) => `<div class="early-item"><a href="#/coin/${l.curve}">${esc(displayName(l))}</a>${evidenceList(l)}</div>`).join('')}`
        : `<p class="card-line">${esc(t('passport.noearly'))}</p>`}
    </section>
    <section class="stage"><h2>${esc(t('passport.coins'))}</h2><div class="grid">${real.map(coinCard).join('') || `<p class="empty">${esc(t('board.empty'))}</p>`}</div></section>
    ${tests.length ? `<section class="stage"><h2>${esc(t('verdict.test'))}</h2><div class="grid">${tests.map(coinCard).join('')}</div></section>` : ''}
    <p class="card-line"><a href="#/dispute">${esc(t('passport.dispute'))}</a></p>
  </article>`;
}

// ---------- money center (Glean engine) ----------
let moneyDisc: Discovery | null = null;
let moneyWallet: Wallet | null = null;
let moneyResult: LookupResult | null = null;

function pageMoney(): string {
  countView('money');
  return `<article class="money">
    <h1>${esc(t('money.title'))}</h1>
    <p class="sub">${esc(t('money.sub'))}</p>
    <form id="moneyForm" class="quote-form">
      <label>${esc(t('common.address'))}<input id="moneyAddr" placeholder="${esc(t('money.placeholder'))}" spellcheck="false"></label>
      <button class="btn" type="submit">${esc(t('money.check'))}</button>
    </form>
    <div id="moneyOut" aria-live="polite"></div>
  </article>`;
}

async function renderMoneyRows(res: LookupResult) {
  const out = $('#moneyOut');
  const claimable = res.rows.filter((r) => r.state === 'claimable' && r.amount && r.amount > 0n);
  const metas = new Map<string, { symbol: string; decimals: number }>();
  const metaOf = async (token: Address | null): Promise<{ symbol: string; decimals: number }> => {
    if (!token) return { symbol: 'ETH', decimals: 18 };
    const key = token.toLowerCase();
    if (!metas.has(key)) {
      const m = await tokenMeta(token);
      metas.set(key, { symbol: m.symbol || shortAddr(token), decimals: m.decimals });
    }
    return metas.get(key)!;
  };
  let totalLine = '';
  if (claimable.length) {
    const parts: string[] = [];
    for (const r of claimable) {
      const m = await metaOf(r.token);
      parts.push(`${formatAmount(r.amount!, m.decimals)} ${m.symbol}`);
    }
    totalLine = `<p class="fact">${esc(t('money.summary'))}: ${esc(parts.join(' · '))}</p>`;
  }
  const streamSections: string[] = [];
  const streams = ['surplus', 'leftover', 'partner', 'almm', 'arl', 'dfs'] as const;
  for (const s of streams) {
    const rows = res.rows.filter((r) => r.stream === s);
    const mine = rows.filter((r) => r.state === 'claimable' && r.amount && r.amount > 0n);
    const rowHtml: string[] = [];
    for (const r of mine) {
      const m = await metaOf(r.token);
      let src = '';
      if (r.source.launchToken) { const sm = await metaOf(r.source.launchToken); src = sm.symbol; }
      else if (r.source.pair) { const a = await metaOf(r.source.pair[0]); const b = await metaOf(r.source.pair[1]); src = `${a.symbol}/${b.symbol}`; }
      else if (r.source.vault) src = shortAddr(r.source.vault);
      const role = r.role === 'creator' ? t('row.role.creator') : r.role === 'referral' ? t('row.role.referral') : r.shareText ? t('row.role.recipient', { share: r.shareText }) : '';
      rowHtml.push(`<div class="money-row"><div><strong>${esc(formatAmount(r.amount!, m.decimals))} ${esc(m.symbol)}</strong> <span class="dim">${esc(src)} ${esc(role)}</span></div>
        <button class="btn" data-claim="${esc(r.key)}">${esc(t('money.claim'))}</button></div>`);
    }
    const okLine = res.streamOk[s]
      ? (mine.length ? '' : `<p class="card-line dim">${esc(t('row.zero'))}</p>`)
      : `<p class="card-line dim">${esc(t('row.unavailable'))}</p>`;
    streamSections.push(`<section class="panel"><h2>${esc(t(`stream.${s}.title`))}</h2><p class="card-line">${esc(t(`stream.${s}.about`))}</p>${rowHtml.join('')}${okLine}</section>`);
  }
  out.innerHTML = `<p class="card-line">${esc(t('money.resultsfor', { addr: shortAddr(res.address) }))}</p>
    ${totalLine || `<p class="fact">${esc(t('money.none'))}</p>`}
    ${Object.values(res.streamOk).some((v) => !v) ? `<p class="card-line dim">${esc(t('money.unavail'))}</p>` : ''}
    <div class="btn-row"><button class="btn btn-ghost" id="connectBtn">${esc(t('money.connect'))}</button></div>
    ${streamSections.join('')}`;
  $('#connectBtn')?.addEventListener('click', async () => {
    try {
      moneyWallet = await connectWallet();
      const btn = $('#connectBtn');
      if (btn) btn.textContent = shortAddr(moneyWallet.address);
    } catch { /* rejection is the visitor's choice; nothing to render */ }
  });
  out.querySelectorAll<HTMLButtonElement>('[data-claim]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const row = moneyResult?.rows.find((r) => r.key === btn.dataset.claim);
      if (!row) return;
      try {
        if (!moneyWallet) moneyWallet = await connectWallet();
        btn.disabled = true;
        await executeClaim(moneyWallet, row);
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
    if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) { out.innerHTML = `<p class="card-line">${esc(t('money.none'))}</p>`; return; }
    out.innerHTML = `<p class="card-line">${esc(t('money.checking'))}</p>`;
    try {
      if (!moneyDisc) moneyDisc = await discover();
      moneyResult = await lookup(addr as Address, moneyDisc, (done, total) => {
        out.innerHTML = `<p class="card-line">${esc(t('money.progress', { done, total }))}</p>`;
      });
      await renderMoneyRows(moneyResult);
    } catch {
      out.innerHTML = `<p class="card-line">${esc(t('row.unavailable'))}</p>`;
    }
  });
}

// ---------- chain checker ----------
function pageChain(): string {
  countView('chain');
  return `<article class="chain">
    <h1>${esc(t('chain.title'))}</h1>
    <p class="sub">${esc(t('chain.sub'))}</p>
    <p class="panel">${esc(t('chain.story'))}</p>
    <form id="chainForm" class="quote-form">
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
    out.innerHTML = `<p class="card-line">${esc(t('common.loading'))}</p>`;
    const v = await checkChainId(id);
    const text = v.kind === 'fake' ? t('chain.verdict.fake')
      : v.kind === 'unknown' ? t('chain.verdict.unknown', { id })
      : v.attested ? t('chain.verdict.real') : t('chain.verdict.attestfail');
    out.innerHTML = `<p class="verdict-box verdict-${v.kind}">${esc(text)}</p>`;
  };
  $<HTMLFormElement>('#chainForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = parseInt($<HTMLInputElement>('#chainInput').value.trim(), 10);
    if (Number.isFinite(id)) void show(id);
  });
  $('#walletChainBtn')?.addEventListener('click', async () => {
    const id = await walletChainId();
    if (id === null) { out.innerHTML = `<p class="card-line">${esc(t('chain.wallet.none'))}</p>`; return; }
    $<HTMLInputElement>('#chainInput').value = String(id);
    void show(id);
  });
}

// ---------- methodology + dispute ----------
function pageMethod(): string {
  countView('method');
  return `<article class="method">
    <h1>${esc(t('method.title'))}</h1>
    <p class="sub">${esc(t('method.intro'))}</p>
    <section class="panel"><p>${esc(t('method.graduated'))}</p><p>${esc(t('method.stopped', { stop: fmtNum(snap.params.stopBlocks) }))}</p>
    <p>${esc(t('method.early', { early: fmtNum(snap.params.earlyBlocks) }))}</p><p>${esc(t('method.bundle'))}</p>
    <p>${esc(t('method.test'))}</p><p>${esc(t('method.creators'))}</p></section>
  </article>`;
}

function pageDispute(): string {
  countView('dispute');
  return `<article class="dispute">
    <h1>${esc(t('dispute.title'))}</h1>
    <p class="sub">${esc(t('dispute.sub'))}</p>
    <p class="panel">${esc(t('dispute.policy'))}</p>
    <form id="disputeForm" class="dispute-form">
      <label>${esc(t('dispute.form.addr'))}<input id="dAddr" spellcheck="false"></label>
      <label>${esc(t('dispute.form.coin'))}<input id="dCoin" spellcheck="false"></label>
      <label>${esc(t('dispute.form.what'))}<textarea id="dWhat" rows="4"></textarea></label>
      <button class="btn" type="submit">${esc(t('dispute.form.btn'))}</button>
    </form>
    <p class="card-line dim">${esc(t('dispute.form.note'))}</p>
    <div id="disputeOut"></div>
    <section class="stage"><h2>${esc(t('dispute.log.title'))}</h2><p class="empty">${esc(t('dispute.log.empty'))}</p></section>
  </article>`;
}

function wireDispute() {
  $<HTMLFormElement>('#disputeForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const text = `Evenfield record dispute\nAddress: ${$<HTMLInputElement>('#dAddr').value.trim()}\nCoin/curve: ${$<HTMLInputElement>('#dCoin').value.trim()}\nWhat was misread: ${$<HTMLTextAreaElement>('#dWhat').value.trim()}`;
    $('#disputeOut').innerHTML = `<p class="card-line">${esc(t('dispute.ready'))}</p><textarea readonly rows="6" class="dispute-text">${esc(text)}</textarea>`;
  });
}

// ---------- shell + router ----------
function shell(active: string): string {
  const nav = [
    ['/', 'nav.board'], ['/money', 'nav.money'], ['/chain', 'nav.chain'], ['/method', 'nav.method'], ['/dispute', 'nav.dispute'],
  ] as const;
  return `<header class="topbar">
      <a class="brand" href="#/">Evenfield</a>
      <nav>${nav.map(([href, key]) => `<a href="#${href}" class="${active === href ? 'active' : ''}">${esc(t(key))}</a>`).join('')}</nav>
      <div class="top-right">
        <span class="chain-badge">${esc(t('chain.badge'))}</span>
        <div class="lang-toggle" role="group" aria-label="Language">
          <button data-lang="en" class="${getLang() === 'en' ? 'active' : ''}">EN</button>
          <button data-lang="id" class="${getLang() === 'id' ? 'active' : ''}">ID</button>
        </div>
      </div>
    </header>
    <main id="app"></main>
    <footer><p>${esc(t('footer.note'))}</p><p class="dim">${esc(t('app.tagline'))}</p></footer>`;
}

async function render() {
  const hash = location.hash.replace(/^#/, '') || '/';
  const [path, param] = hash.split('/').filter(Boolean).length
    ? [ '/' + (hash.split('/').filter(Boolean)[0] ?? ''), hash.split('/').filter(Boolean)[1] ]
    : ['/', undefined];
  document.body.innerHTML = shell(path === '/' ? '/' : path);
  document.querySelectorAll<HTMLButtonElement>('[data-lang]').forEach((b) =>
    b.addEventListener('click', () => { setLang(b.dataset.lang as 'en' | 'id'); void render(); }));
  const app = $('#app');
  if (path === '/' && !param) { app.innerHTML = pageHome(); wireHome(); }
  else if (path === '/coin' && param) { app.innerHTML = await pageCoin(param); wireCoin(param); }
  else if (path === '/creator' && param) { app.innerHTML = pageCreator(param); }
  else if (path === '/money') { app.innerHTML = pageMoney(); wireMoney(); }
  else if (path === '/chain') { app.innerHTML = pageChain(); wireChain(); }
  else if (path === '/method') { app.innerHTML = pageMethod(); }
  else if (path === '/dispute') { app.innerHTML = pageDispute(); wireDispute(); }
  else { app.innerHTML = pageHome(); wireHome(); }
  window.scrollTo(0, 0);
}

// ---------- boot ----------
async function loadSnapshot(): Promise<void> {
  try {
    const res = await fetch('snapshot.json', { cache: 'no-cache' });
    if (res.ok) {
      const j = (await res.json()) as Snapshot;
      if (j && j.schema === 1 && Array.isArray(j.launches)) { snap = j; return; }
    }
  } catch { /* fall through to the in-bundle snapshot */ }
  snap = fallbackSnapshot as unknown as Snapshot;
}

async function boot() {
  document.documentElement.lang = getLang() === 'id' ? 'id' : 'en';
  await loadSnapshot();
  for (const l of snap.launches) byCurve.set(l.curve.toLowerCase(), l);
  for (const c of snap.creators) byCreator.set(c.address.toLowerCase(), c);
  await render();
  window.addEventListener('hashchange', () => void render());
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* shell still works online */ });
  }
  // Delta sync in the background, hard 20 second budget, never blocking.
  const started = Date.now();
  try {
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
          state: null, statusName: 'pending', stopped: false, progressPct: null,
          evidence: { swapCount: 0, uniqueBuyers: 0, firstSwapBlock: null, lastSwapBlock: null, lastSwapTx: null, creatorBuys: 0, creatorBuyTotal: '0', creatorSellTotal: '0', creatorSells: [], creatorSoldEarly: false, currentCreator: d.creator, creatorTransferred: null, holders: null, windows: [] },
          testLaunch: false, testReason: null, verdict: 'toonew', verdictReasons: [],
        };
        snap.launches.unshift(nl);
        byCurve.set(nl.curve.toLowerCase(), nl);
      }
      if ((location.hash || '#/') === '#/' || location.hash === '') void render();
    }
    void started;
  } catch { /* delta is an enhancement, never a requirement (blueprint G5) */ }
}

void boot();
