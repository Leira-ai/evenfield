// Evenfield snapshot builder. Runs locally and in GitHub Actions CI.
// Scans every launch factory in the attested SDK catalog, reads each curve's
// state field by field, gathers swap evidence in bounded windows, classifies
// protocol test launches, aggregates creator records, and writes
// public/snapshot.json (+ src/fallback-snapshot.json, the in-bundle copy).
// Transport discipline (proven in Slipway and Glean): no batching, retry with
// backoff, concurrency 3, only successes are kept, no raw RPC errors surface.
import { createPublicClient, http, decodeEventLog, parseAbiItem, keccak256, toHex } from 'viem';
import { writeFileSync, mkdirSync } from 'node:fs';
import * as sdk from '@ammora-protocol/sdk';

const RPC_URL = process.env.GIWA_RPC_URL || 'https://sepolia-rpc.giwa.io';
const CHUNK = 10_000n;
const STOP_BLOCKS = 100_000; // blueprint B12: no swap for this many blocks + not graduated = stopped
const EARLY_BLOCKS = 7_200; // blueprint B12: creator sells inside this window count as early
const EARLY_WINDOW = 200_000; // forward evidence window from launch block
const RECENT_WINDOW = 300_000; // backward evidence window from head

const client = createPublicClient({ transport: http(RPC_URL, { timeout: 30_000, retryCount: 3, retryDelay: 700 }) });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function withRetry(fn, tries = 4, base = 500) {
  let last;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } catch (e) { last = e; await sleep(base * 2 ** i + Math.random() * 250); }
  }
  throw last;
}
async function pool(items, size, fn) {
  const out = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); }
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker));
  return out;
}

// ---------- catalog ----------
function catalogSlots() {
  const slots = [];
  for (const [exportName, value] of Object.entries(sdk)) {
    if (!value || typeof value !== 'object') continue;
    const contracts = value.contracts;
    if (!contracts || typeof contracts !== 'object') continue;
    const chainId = value.chainId ?? value.chain?.id;
    if (chainId !== 91342) continue;
    const slot = typeof value.id === 'string' ? value.id : exportName;
    if (contracts.launch?.factory) {
      slots.push({ slot, factory: contracts.launch.factory, start: Number(contracts.launch.deploymentBlock ?? 31_900_000) });
    }
  }
  const byFactory = new Map();
  for (const s of slots) {
    const key = s.factory.toLowerCase();
    if (!byFactory.has(key)) byFactory.set(key, { factory: s.factory, slots: [], start: s.start });
    byFactory.get(key).slots.push(s.slot);
    byFactory.get(key).start = Math.min(byFactory.get(key).start, s.start);
  }
  return [...byFactory.values()];
}

const LAUNCH_TOPIC = keccak256(toHex('LaunchCreated(address,address,address,uint256,bytes32,uint16,string)'));
const launchAbi = [parseAbiItem('event LaunchCreated(address indexed token, address indexed curve, address indexed creator, uint256 configId, bytes32 configHash, uint16 protocolVersion, string metadataURI)')];
const curveAbi = sdk.segmentedBondingCurveV3Abi;
const SWAP_TOPIC = keccak256(toHex('Swap(address,bool,bool,uint256,uint256,uint256,uint256,uint128,address)'));
const TRANSFER_TOPIC = keccak256(toHex('Transfer(address,address,uint256)'));
const CREATOR_TRANSFERRED_TOPIC = keccak256(toHex('CreatorTransferred(address,address)'));

let failedChunks = 0;
async function getLogsRange(address, topic, from, to) {
  const ranges = [];
  for (let s = from; s <= to; s += Number(CHUNK)) ranges.push([s, Math.min(s + Number(CHUNK) - 1, to)]);
  const parts = await pool(ranges, 3, async ([s, e]) => {
    const part = await withRetry(() =>
      client.request({
        method: 'eth_getLogs',
        params: [{ address, topics: [topic], fromBlock: `0x${s.toString(16)}`, toBlock: `0x${e.toString(16)}` }],
      }),
    ).catch(() => null);
    if (part) return part;
    failedChunks++;
    console.warn(`WARN chunk failed: ${address} ${s}-${e} (total failed: ${failedChunks})`);
    return [];
  });
  return parts.flat();
}

// ---------- test-launch classification (named rules, auditable) ----------
function classifyTest(name, symbol, uri) {
  const n = `${name} ${symbol}`.toLowerCase();
  const u = (uri || '').toLowerCase();
  if (u.includes('canary')) return 'metadata URI marks it as a protocol canary';
  if (u.includes('isolated')) return 'metadata URI marks it as an isolated protocol test';
  if (/sdk\s*\d/.test(n)) return 'name follows the SDK test series (SDK + number)';
  if (n.includes('guide') && n.includes('demo')) return 'name marks it as a guide demo';
  if (/\bdemo\b/.test(n)) return 'name contains "demo"';
  if (/\btest\b|testing|cek vesting|vesting check|fee sharing check/.test(n)) return 'name marks it as a protocol check or test';
  if (/^ammora\b/.test(n) && /(v4|v3) (validation|smoke|check)/.test(n)) return 'name marks it as an Ammora validation launch';
  return null;
}

// ---------- per-launch evidence ----------
async function readCurveState(curve) {
  const read = (functionName) =>
    withRetry(() => client.readContract({ address: curve, abi: curveAbi, functionName }), 2, 350).catch(() => undefined);
  const [status, sqrtPrice, baseReserve, quoteReserve, threshold, baseToken, quoteToken, canonicalPool, feeBps] =
    await Promise.all([
      read('status'), read('sqrtPrice'), read('baseReserve'), read('quoteReserve'),
      read('migrationQuoteThreshold'), read('baseToken'), read('quoteToken'), read('canonicalPool'), read('currentFeeBps'),
    ]);
  if (status === undefined && sqrtPrice === undefined) return null;
  return {
    status: status !== undefined ? Number(status) : null,
    sqrtPrice: sqrtPrice?.toString() ?? null,
    baseReserve: baseReserve?.toString() ?? null,
    quoteReserve: quoteReserve?.toString() ?? null,
    migrationQuoteThreshold: threshold?.toString() ?? null,
    baseToken: baseToken ?? null,
    quoteToken: quoteToken ?? null,
    canonicalPool: canonicalPool ?? null,
    feeBps: feeBps !== undefined ? Number(feeBps) : null,
  };
}

async function erc20Meta(token) {
  const abi = [
    parseAbiItem('function name() view returns (string)'),
    parseAbiItem('function symbol() view returns (string)'),
    parseAbiItem('function decimals() view returns (uint8)'),
    parseAbiItem('function totalSupply() view returns (uint256)'),
  ];
  const r = async (i) => withRetry(() => client.readContract({ address: token, abi: [abi[i]], functionName: abi[i].name }), 2, 350).catch(() => undefined);
  const [name, symbol, decimals, totalSupply] = await Promise.all([r(0), r(1), r(2), r(3)]);
  return {
    name: typeof name === 'string' && name ? name : null,
    symbol: typeof symbol === 'string' && symbol ? symbol : null,
    decimals: typeof decimals === 'number' ? decimals : 18,
    totalSupply: totalSupply?.toString() ?? null,
  };
}

const addrOfTopic = (t) => ('0x' + t.slice(26)).toLowerCase();

async function gatherEvidence(rec, head) {
  const curve = rec.curve;
  const launchBlock = rec.block;
  const fwdTo = Math.min(launchBlock + EARLY_WINDOW, head);
  const recentFrom = Math.max(head - RECENT_WINDOW, launchBlock);
  const ranges = [[launchBlock, fwdTo]];
  if (recentFrom > fwdTo) ranges.push([recentFrom, head]);
  const swaps = new Map();
  let currentCreator = null;
  for (const [a, b] of ranges) {
    const logs = await getLogsRange(curve, SWAP_TOPIC, a, b);
    for (const log of logs) {
      const key = `${log.transactionHash}:${log.logIndex}`;
      if (swaps.has(key)) continue;
      try {
        const dec = decodeEventLog({ abi: curveAbi, data: log.data, topics: log.topics });
        if (dec.eventName !== 'Swap') continue;
        swaps.set(key, {
          trader: dec.args.trader.toLowerCase(),
          sell: Boolean(dec.args.baseForQuote),
          amountIn: dec.args.amountIn.toString(),
          amountOut: dec.args.amountOut.toString(),
          block: Number(BigInt(log.blockNumber)),
          tx: log.transactionHash,
        });
      } catch { /* skip undecodable */ }
    }
    const ct = await getLogsRange(curve, CREATOR_TRANSFERRED_TOPIC, a, b);
    for (const log of ct) {
      const blk = Number(BigInt(log.blockNumber));
      if (!currentCreator || blk >= currentCreator.block) {
        currentCreator = { address: addrOfTopic(log.topics[2]), block: blk, tx: log.transactionHash };
      }
    }
  }
  const list = [...swaps.values()].sort((x, y) => x.block - y.block);
  const creator = rec.creator.toLowerCase();
  const buyers = new Set(list.filter((s) => !s.sell).map((s) => s.trader));
  const creatorSells = list.filter((s) => s.sell && s.trader === creator);
  const creatorBuys = list.filter((s) => !s.sell && s.trader === creator);
  const earlySells = creatorSells.filter((s) => s.block - launchBlock <= EARLY_BLOCKS);
  const lastSwap = list.length ? list[list.length - 1] : null;
  // holder concentration from token transfers inside the same windows
  let holders = null;
  try {
    const balances = new Map();
    for (const [a, b] of ranges) {
      const logs = await getLogsRange(rec.token, TRANSFER_TOPIC, a, b);
      for (const log of logs) {
        const from = addrOfTopic(log.topics[1]);
        const to = addrOfTopic(log.topics[2]);
        const v = BigInt(log.data);
        if (from !== '0x0000000000000000000000000000000000000000') balances.set(from, (balances.get(from) ?? 0n) - v);
        balances.set(to, (balances.get(to) ?? 0n) + v);
      }
    }
    const curveLc = curve.toLowerCase();
    const pos = [...balances.entries()].filter(([a, v]) => v > 0n && a !== curveLc);
    const total = pos.reduce((s, [, v]) => s + v, 0n);
    if (total > 0n && pos.length) {
      pos.sort((x, y) => (y[1] > x[1] ? 1 : -1));
      const top1 = Number((pos[0][1] * 10000n) / total) / 100;
      const top10 = Number((pos.slice(0, 10).reduce((s, [, v]) => s + v, 0n) * 10000n) / total) / 100;
      holders = { count: pos.length, top1Pct: top1, top10Pct: top10, windowed: true };
    }
  } catch { holders = null; }
  return {
    swapCount: list.length,
    uniqueBuyers: buyers.size,
    firstSwapBlock: list.length ? list[0].block : null,
    lastSwapBlock: lastSwap ? lastSwap.block : null,
    lastSwapTx: lastSwap ? lastSwap.tx : null,
    creatorBuys: creatorBuys.length,
    creatorBuyTotal: creatorBuys.reduce((sum, s) => sum + BigInt(s.amountOut), 0n).toString(),
    creatorSellTotal: creatorSells.reduce((sum, s) => sum + BigInt(s.amountIn), 0n).toString(),
    creatorSells: creatorSells.map((s) => ({ block: s.block, tx: s.tx, amountIn: s.amountIn, blocksAfterLaunch: s.block - launchBlock })),
    creatorSoldEarly: earlySells.length > 0,
    currentCreator: currentCreator ? currentCreator.address : creator,
    creatorTransferred: currentCreator ? { tx: currentCreator.tx, block: currentCreator.block } : null,
    holders,
    windows: ranges,
  };
}

// ---------- main ----------
const t0 = Date.now();
const head = Number(await withRetry(() => client.getBlockNumber()));
console.log(`head block ${head}`);
const factories = catalogSlots();
console.log('launch factories:', factories.map((f) => `${f.factory} (${f.slots.join('+')})`).join('; '));

const byCurve = new Map();
for (const f of factories) {
  const logs = await getLogsRange(f.factory, LAUNCH_TOPIC, f.start, head);
  for (const log of logs) {
    try {
      const dec = decodeEventLog({ abi: launchAbi, data: log.data, topics: log.topics });
      const curve = dec.args.curve.toLowerCase();
      byCurve.set(curve, {
        token: dec.args.token,
        curve: dec.args.curve,
        creator: dec.args.creator,
        configId: dec.args.configId.toString(),
        protocolVersion: Number(dec.args.protocolVersion),
        uri: dec.args.metadataURI ?? '',
        block: Number(BigInt(log.blockNumber)),
        tx: log.transactionHash,
        slots: f.slots,
        factory: f.factory,
      });
    } catch { /* skip */ }
  }
  console.log(`${f.factory}: cumulative launches ${byCurve.size}`);
}
const launches = [...byCurve.values()].sort((a, b) => b.block - a.block);
console.log(`total unique launches: ${launches.length}`);

const enriched = await pool(launches, 3, async (rec) => {
  const [meta, state, evidence] = [
    await erc20Meta(rec.token),
    await readCurveState(rec.curve),
    await gatherEvidence(rec, head),
  ];
  const testReason = classifyTest(meta.name ?? '', meta.symbol ?? '', rec.uri);
  // Curve lifecycle (SDK docs/v4-graduation-lifecycle.md): 0 pending,
  // 1 Trading, 2 ReadyToMigrate (fill complete), 3 Migrated (pool live).
  // Graduated = the curve filled: status 2 or 3. readyToMigrate marks 2.
  const statusName = state === null ? 'unreadable' : state.status === 2 || state.status === 3 ? 'graduated' : state.status === 1 ? 'trading' : state.status === 0 ? 'pending' : 'unknown';
  const readyToMigrate = state !== null && state.status === 2;
  const stopped = statusName === 'trading' || statusName === 'pending'
    ? evidence.lastSwapBlock === null
      ? head - rec.block > STOP_BLOCKS
      : head - evidence.lastSwapBlock > STOP_BLOCKS
    : false;
  const progressPct = readyToMigrate || (state && state.status === 3)
    ? 100
    : state && state.migrationQuoteThreshold && state.quoteReserve && BigInt(state.migrationQuoteThreshold) > 0n
      ? Math.min(100, Number((BigInt(state.quoteReserve) * 10000n) / BigInt(state.migrationQuoteThreshold)) / 100)
      : null;
  return {
    ...rec,
    name: meta.name, symbol: meta.symbol, decimals: meta.decimals, totalSupply: meta.totalSupply,
    state, statusName, readyToMigrate, stopped, progressPct,
    evidence,
    testLaunch: testReason !== null, testReason,
  };
});

// ---------- creator aggregates (computed per creator, test launches apart) ----------
const creators = new Map();
for (const l of enriched) {
  const key = l.creator.toLowerCase();
  if (!creators.has(key)) creators.set(key, { address: l.creator, launches: [], testLaunches: 0 });
  const c = creators.get(key);
  c.launches.push(l.curve.toLowerCase());
  if (l.testLaunch) c.testLaunches++;
}
const creatorRecords = [...creators.values()].map((c) => {
  const mine = enriched.filter((l) => c.launches.includes(l.curve.toLowerCase()));
  const real = mine.filter((l) => !l.testLaunch);
  const count = (arr, fn) => arr.filter(fn).length;
  const earlySellLaunches = real.filter((l) => l.evidence.creatorSoldEarly);
  return {
    address: c.address,
    totalLaunches: mine.length,
    testLaunches: c.testLaunches,
    realLaunches: real.length,
    graduated: count(real, (l) => l.statusName === 'graduated'),
    trading: count(real, (l) => l.statusName === 'trading' && !l.stopped),
    stopped: count(real, (l) => l.stopped),
    pending: count(real, (l) => l.statusName === 'pending'),
    unreadable: count(real, (l) => l.statusName === 'unreadable'),
    earlySellCount: earlySellLaunches.length,
    earlySellLaunches: earlySellLaunches.map((l) => l.curve),
    firstLaunchBlock: Math.min(...mine.map((l) => l.block)),
    lastLaunchBlock: Math.max(...mine.map((l) => l.block)),
  };
}).sort((a, b) => b.totalLaunches - a.totalLaunches);

// ---------- verdicts (evidence only, no motive words) ----------
const creatorByAddr = new Map(creatorRecords.map((c) => [c.address.toLowerCase(), c]));
for (const l of enriched) {
  const c = creatorByAddr.get(l.creator.toLowerCase());
  const reasons = [];
  let verdict;
  if (l.testLaunch) {
    verdict = 'test';
    reasons.push({ kind: 'test', text: l.testReason });
  } else if (l.statusName === 'unreadable') {
    verdict = 'unknown';
    reasons.push({ kind: 'unreadable' });
  } else {
    if (c && c.earlySellCount > 0) reasons.push({ kind: 'creator_early_sell', launches: c.earlySellLaunches.length, total: c.realLaunches });
    if (l.evidence.creatorSoldEarly) reasons.push({ kind: 'this_coin_early_sell', sells: l.evidence.creatorSells.filter((s) => s.blocksAfterLaunch <= EARLY_BLOCKS) });
    if (l.stopped) reasons.push({ kind: 'stopped', lastSwapBlock: l.evidence.lastSwapBlock, tx: l.evidence.lastSwapTx });
    if (l.statusName === 'graduated') reasons.push({ kind: 'graduated' });
    const ageBlocks = head - l.block;
    if (reasons.some((r) => r.kind === 'creator_early_sell' || r.kind === 'this_coin_early_sell' || r.kind === 'stopped')) verdict = 'careful';
    else if (ageBlocks <= EARLY_BLOCKS || l.evidence.swapCount < 3) verdict = 'toonew';
    else verdict = 'clean';
  }
  l.verdict = verdict;
  l.verdictReasons = reasons;
}

const snapshot = {
  schema: 1,
  builtAt: new Date().toISOString(),
  headBlock: head,
  chainId: 91342,
  params: { stopBlocks: STOP_BLOCKS, earlyBlocks: EARLY_BLOCKS },
  factories: factories.map((f) => ({ factory: f.factory, slots: f.slots })),
  launches: enriched,
  creators: creatorRecords,
};
mkdirSync(new URL('../public', import.meta.url), { recursive: true });
mkdirSync(new URL('../src', import.meta.url), { recursive: true });
const json = JSON.stringify(snapshot);
writeFileSync(new URL('../public/snapshot.json', import.meta.url), json);
writeFileSync(new URL('../src/fallback-snapshot.json', import.meta.url), json);
console.log(`snapshot written: ${enriched.length} launches, ${creatorRecords.length} creators, ${(json.length / 1024).toFixed(0)} KiB, ${((Date.now() - t0) / 1000).toFixed(0)}s`);
