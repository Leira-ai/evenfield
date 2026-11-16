// Evenfield Phase 0 census: enumerate every GIWA Sepolia deployment slot in
// the pinned SDK catalog, then scan LaunchCreated on EVERY launch factory the
// catalog names (not just the auto-route one), plus AFSVaultCreated on every
// fee-sharing factory. Closes the "second launch factory" question (blueprint
// gap G1) with evidence instead of assumption.
// Resumable: progress is checkpointed to census-progress.json after each chunk.
import { createPublicClient, http, decodeEventLog, toEventSelector } from 'viem';
import * as sdk from '@ammora-protocol/sdk';
import { readFileSync, writeFileSync, existsSync } from 'fs';

const RPC_URL = 'https://sepolia-rpc.giwa.io';
const LOG_CHUNK = 10_000;
const PROGRESS_PATH = new URL('./census-progress.json', import.meta.url).pathname;
const RESULT_PATH = new URL('./census-result.json', import.meta.url).pathname;

const client = createPublicClient({
  transport: http(RPC_URL, { timeout: 30_000, retryCount: 3, retryDelay: 800 }),
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function withRetry(fn, attempts = 5, base = 600) {
  let last;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); } catch (e) { last = e; if (i < attempts - 1) await sleep(base * 2 ** i + Math.random() * 200); }
  }
  throw last;
}

// ---- collect catalog slots ----
const slotObjects = [
  ['v4-auto-route-20260917', sdk.giwaSepoliaAutoRouteDeployment],
  ['giwa-auto-route-atomic-20261027', sdk.giwaSepoliaAtomicLaunchDeployment],
  ['permissionless', sdk.giwaSepoliaPermissionless],
  ['vaults', sdk.giwaSepoliaVaults],
  ['vnext', sdk.giwaSepoliaVNext],
  ['merged', sdk.giwaSepoliaMerged],
  ['sealed', sdk.giwaSepoliaSealed],
  ['audited', sdk.giwaSepoliaAudited],
];
const launchFactories = new Map(); // factory -> {slots:[], startBlock, protocolVersion}
const dfsFactories = new Map();
for (const [slot, dep] of slotObjects) {
  const c = dep.contracts ?? {};
  const lf = c.launch?.factory ?? c.launchFactory;
  if (lf) {
    const key = lf.toLowerCase();
    const entry = launchFactories.get(key) ?? { address: lf, slots: [], startBlock: Infinity, protocolVersion: c.launch?.protocolVersion ?? null };
    entry.slots.push(slot);
    entry.startBlock = Math.min(entry.startBlock, Number(dep.startBlock ?? 0) || Infinity);
    launchFactories.set(key, entry);
  }
  const df = c.feeSharing?.factory;
  if (df) {
    const key = df.toLowerCase();
    const entry = dfsFactories.get(key) ?? { address: df, slots: [], startBlock: Infinity };
    entry.slots.push(slot);
    entry.startBlock = Math.min(entry.startBlock, Number(dep.startBlock ?? 0) || Infinity);
    dfsFactories.set(key, entry);
  }
}
console.log('launch factories:', [...launchFactories.values()].map((f) => `${f.address} slots=${f.slots.join('+')} start=${f.startBlock}`));
console.log('dfs factories:', [...dfsFactories.values()].map((f) => `${f.address} slots=${f.slots.join('+')} start=${f.startBlock}`));

// ---- attestation attempt ----
let attestation = 'not attempted';
try {
  const src = sdk.createAmmoraDeploymentSource([sdk.giwaSepoliaAutoRouteDeployment]);
  const provider = {
    id: 'giwa-sepolia-public-rpc',
    client: {
      getChainId: () => client.getChainId(),
      getBytecode: ({ address }) => client.getBytecode({ address }),
    },
  };
  const res = await sdk.attestAmmoraDeployment({ chainId: 91342, source: src, providers: [provider] });
  attestation = `PASS: ${res.evidence.contracts.length} contracts verified at ${res.evidence.verifiedAt}`;
} catch (e) {
  attestation = `failed: ${String(e?.evidence?.failure?.reason ?? e?.message ?? e).slice(0, 300)}`;
}
console.log('attestation:', attestation);

// ---- generic resumable scan ----
let progress = existsSync(PROGRESS_PATH) ? JSON.parse(readFileSync(PROGRESS_PATH, 'utf8')) : {};
function saveProgress() { writeFileSync(PROGRESS_PATH, JSON.stringify(progress)); }

async function scanFactory(kind, entry, abi, eventName) {
  const key = `${kind}:${entry.address.toLowerCase()}`;
  const head = Number(await withRetry(() => client.getBlockNumber()));
  const eventEntry = abi.find((x) => x.type === 'event' && x.name === eventName);
  const topic = toEventSelector(`${eventName}(${eventEntry.inputs.map((i) => i.type).join(',')})`);
  const state = progress[key] ?? { nextFrom: entry.startBlock, records: [], failedChunks: [] };
  progress[key] = state;
  const chunks = [];
  for (let s = state.nextFrom; s <= head; s += LOG_CHUNK) chunks.push([s, Math.min(s + LOG_CHUNK - 1, head)]);
  console.log(`${key}: scanning ${chunks.length} chunks from ${state.nextFrom} to ${head}, already have ${state.records.length} records`);
  let idx = 0;
  let doneChunks = 0;
  const worker = async () => {
    while (idx < chunks.length) {
      const [from, to] = chunks[idx++];
      try {
        const logs = await withRetry(() => client.request({
          method: 'eth_getLogs',
          params: [{ address: entry.address, topics: [topic], fromBlock: `0x${from.toString(16)}`, toBlock: `0x${to.toString(16)}` }],
        }));
        for (const log of logs) {
          try {
            const dec = decodeEventLog({ abi, data: log.data, topics: log.topics });
            const args = JSON.parse(JSON.stringify(dec.args, (k, v) => (typeof v === 'bigint' ? v.toString() : v)));
            state.records.push({ args, block: Number(BigInt(log.blockNumber)), tx: log.transactionHash });
          } catch { /* undecodable: skip */ }
        }
      } catch {
        state.failedChunks.push([from, to]);
      }
      doneChunks++;
      if (doneChunks % 100 === 0) {
        state.nextFrom = Math.min(...chunks.slice(idx).map((c) => c[0]).concat([head + 1]));
        saveProgress();
        console.log(`${key}: ${doneChunks}/${chunks.length} chunks, ${state.records.length} records, ${state.failedChunks.length} failed`);
      }
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  state.nextFrom = head + 1;
  state.headAtScan = head;
  saveProgress();
  console.log(`${key}: DONE ${state.records.length} records, ${state.failedChunks.length} failed chunks`);
  return state;
}

const result = { generatedAt: new Date().toISOString(), attestation, slots: {}, launchFactories: {}, dfsFactories: {} };
for (const [slot, dep] of slotObjects) {
  const c = dep.contracts ?? {};
  result.slots[slot] = {
    startBlock: Number(dep.startBlock ?? 0) || null,
    launchFactory: c.launch?.factory ?? c.launchFactory ?? null,
    configRegistry: c.launch?.configRegistry ?? c.configRegistry ?? null,
    feeSharingFactory: c.feeSharing?.factory ?? null,
    concentratedFactory: c.launch?.concentratedFactory ?? null,
    protocolVersion: c.launch?.protocolVersion ?? null,
    status: dep.status ?? null,
  };
}
for (const entry of launchFactories.values()) {
  const st = await scanFactory('launch', entry, sdk.ammoraLaunchFactoryV4Abi, 'LaunchCreated');
  result.launchFactories[entry.address] = {
    slots: entry.slots, startBlock: entry.startBlock, protocolVersion: entry.protocolVersion,
    launchCount: st.records.length, failedChunks: st.failedChunks.length,
    records: st.records.map((r) => ({ token: r.args.token, curve: r.args.curve, creator: r.args.creator, block: r.block, tx: r.tx })),
  };
}
for (const entry of dfsFactories.values()) {
  const st = await scanFactory('dfs', entry, sdk.ammoraAFSFactoryAbi, 'AFSVaultCreated');
  result.dfsFactories[entry.address] = {
    slots: entry.slots, startBlock: entry.startBlock,
    vaultCount: st.records.length, failedChunks: st.failedChunks.length,
    records: st.records.map((r) => ({ vault: r.args.vault, owner: r.args.owner, token: r.args.token, block: r.block, tx: r.tx })),
  };
}
writeFileSync(RESULT_PATH, JSON.stringify(result, null, 1));
console.log('CENSUS COMPLETE ->', RESULT_PATH);
for (const [addr, f] of Object.entries(result.launchFactories)) console.log(`launch ${addr}: ${f.launchCount} launches (slots ${f.slots.join('+')})`);
for (const [addr, f] of Object.entries(result.dfsFactories)) console.log(`dfs ${addr}: ${f.vaultCount} vaults (slots ${f.slots.join('+')})`);
