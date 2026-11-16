import { defineChain, createPublicClient, http, erc20Abi, toEventSelector, decodeEventLog } from "viem";
import { giwaSepoliaAutoRouteDeployment, ammoraLaunchPoolV4Abi, ammoraLaunchFactoryV4Abi, almmBinPoolAbi, ammConcentratedPoolV3Abi, feeVaultAbi, DFSClient, almmFactoryAbi, ammConcentratedFactoryV3Abi, ammoraAFSFactoryAbi, AmmoraV4LaunchCurveClient } from "@ammora-protocol/sdk";
const RPC_URL = "https://sepolia-rpc.giwa.io";
const EXPLORER = "https://sepolia-explorer.giwa.io";
const FACTORY = giwaSepoliaAutoRouteDeployment.contracts.launch.factory;
const FEE_POLICY = giwaSepoliaAutoRouteDeployment.contracts.launch.feePolicy;
const ALMM_FACTORY = giwaSepoliaAutoRouteDeployment.contracts.liquidityMarketMaker.factory;
const CONC_FACTORY = giwaSepoliaAutoRouteDeployment.contracts.launch.concentratedFactory;
const DFS_FACTORY = giwaSepoliaAutoRouteDeployment.contracts.feeSharing.factory;
const DFS_FACTORY_LEGACY = "0x6eb2b96270001fb6a82cec6c2542cda1039c1d28";
const WETH = giwaSepoliaAutoRouteDeployment.contracts.tokens.wrappedNative;
const DEPLOY_START = Number(giwaSepoliaAutoRouteDeployment.startBlock);
const LEGACY_DFS_START = 32500768;
const LOG_CHUNK = 1e4;
const ZERO = "0x0000000000000000000000000000000000000000";
const giwaChain = defineChain({
  id: 91342,
  name: "GIWA Sepolia",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: { default: { name: "GIWA Explorer", url: EXPLORER } }
});
const publicClient = createPublicClient({
  chain: giwaChain,
  // No batch:true: the GIWA public RPC silently drops calls when a burst of
  // batched eth_calls lands at once (proven during the Slipway build).
  // Plain transport + explicit retries + a narrow queue below is reliable.
  transport: http(RPC_URL, { timeout: 3e4, retryCount: 3, retryDelay: 800 })
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function withRetry(fn, attempts = 4, baseDelayMs = 400) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i < attempts - 1) await sleep(baseDelayMs * 2 ** i + Math.floor(Math.random() * 150));
    }
  }
  throw lastErr;
}
function makeQueue(max) {
  let active = 0;
  const waiters = [];
  return function queued2(fn) {
    return new Promise((resolve, reject) => {
      const run = () => {
        active++;
        fn().then(resolve, reject).finally(() => {
          active--;
          const next = waiters.shift();
          if (next) next();
        });
      };
      if (active < max) run();
      else waiters.push(run);
    });
  };
}
const queued = makeQueue(3);
function read(params) {
  return queued(() => withRetry(() => publicClient.readContract(params), 5, 600));
}
function simulate(params) {
  return queued(() => withRetry(() => publicClient.simulateContract(params), 5, 600));
}
function getBlockNumber() {
  return withRetry(() => publicClient.getBlockNumber(), 3, 500);
}
function lsGet(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function lsSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
  }
}
function mergeRanges(ranges) {
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const out = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r[0] <= last[1] + 1) last[1] = Math.max(last[1], r[1]);
    else out.push([...r]);
  }
  return out;
}
function gaps(ranges, from, to) {
  const out = [];
  let cur = from;
  for (const [a, b] of mergeRanges(ranges)) {
    if (b < cur) continue;
    if (a > cur) out.push([cur, Math.min(a - 1, to)]);
    cur = Math.max(cur, b + 1);
    if (cur > to) return out;
  }
  if (cur <= to) out.push([cur, to]);
  return out;
}
async function scanSource(src, head) {
  const lsRecords = `evenfield.v1.scan.${src.key}.records`;
  const lsRanges = `evenfield.v1.scan.${src.key}.ranges`;
  const byId = /* @__PURE__ */ new Map();
  for (const r of lsGet(lsRecords) ?? []) byId.set(src.idOf(r).toLowerCase(), r);
  let ranges = lsGet(lsRanges) ?? [];
  const eventEntry = src.abi.find((x) => x.type === "event" && x.name === src.eventName);
  if (!eventEntry) throw new Error(`event ${src.eventName} not in ABI`);
  const topic = toEventSelector(`${src.eventName}(${eventEntry.inputs.map((i) => i.type).join(",")})`);
  const chunks = [];
  for (const [a, b] of gaps(ranges, src.startBlock, head)) {
    for (let s = a; s <= b; s += LOG_CHUNK) chunks.push([s, Math.min(s + LOG_CHUNK - 1, b)]);
  }
  chunks.sort((x, y) => y[1] - x[1]);
  let failed = 0;
  let idx = 0;
  const worker = async () => {
    while (idx < chunks.length) {
      const [from, to] = chunks[idx++];
      try {
        const logs = await withRetry(
          () => publicClient.request({
            method: "eth_getLogs",
            params: [
              {
                address: src.address,
                topics: [topic],
                fromBlock: `0x${from.toString(16)}`,
                toBlock: `0x${to.toString(16)}`
              }
            ]
          }),
          3,
          600
        );
        for (const log of logs) {
          try {
            const decoded = decodeEventLog({ abi: src.abi, data: log.data, topics: log.topics });
            const rec = src.map(decoded.args, Number(BigInt(log.blockNumber)));
            byId.set(src.idOf(rec).toLowerCase(), rec);
          } catch {
          }
        }
        ranges = mergeRanges([...ranges, [from, to]]);
      } catch {
        failed++;
      }
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  const records = [...byId.values()];
  lsSet(lsRecords, records);
  lsSet(lsRanges, ranges);
  return { records, complete: failed === 0 };
}
async function discover() {
  const head = Number(await getBlockNumber());
  const [launches, almm, conc, dfsNew, dfsOld] = await Promise.all([
    scanSource(
      {
        key: "launches",
        address: FACTORY,
        abi: ammoraLaunchFactoryV4Abi,
        eventName: "LaunchCreated",
        startBlock: DEPLOY_START,
        map: (a, block) => ({ token: a.token, curve: a.curve, creator: a.creator, block }),
        idOf: (r) => r.curve
      },
      head
    ),
    scanSource(
      {
        key: "almm",
        address: ALMM_FACTORY,
        abi: almmFactoryAbi,
        eventName: "PoolCreated",
        startBlock: DEPLOY_START,
        map: (a, block) => ({ pool: a.pool, baseToken: a.baseToken, quoteToken: a.quoteToken, block }),
        idOf: (r) => r.pool
      },
      head
    ),
    scanSource(
      {
        key: "conc",
        address: CONC_FACTORY,
        abi: ammConcentratedFactoryV3Abi,
        eventName: "PoolCreated",
        startBlock: DEPLOY_START,
        map: (a, block) => ({
          pool: a.pool,
          creator: a.creator,
          baseToken: a.baseToken,
          quoteToken: a.quoteToken,
          block
        }),
        idOf: (r) => r.pool
      },
      head
    ),
    scanSource(
      {
        key: "dfsnew",
        address: DFS_FACTORY,
        abi: ammoraAFSFactoryAbi,
        eventName: "AFSVaultCreated",
        startBlock: DEPLOY_START,
        map: (a, block) => ({ vault: a.vault, owner: a.owner, token: a.token, block }),
        idOf: (r) => r.vault
      },
      head
    ),
    scanSource(
      {
        key: "dfsold",
        address: DFS_FACTORY_LEGACY,
        abi: ammoraAFSFactoryAbi,
        eventName: "AFSVaultCreated",
        startBlock: LEGACY_DFS_START,
        map: (a, block) => ({ vault: a.vault, owner: a.owner, token: a.token, block }),
        idOf: (r) => r.vault
      },
      head
    )
  ]);
  return {
    launches: launches.records,
    almmPools: almm.records,
    concPools: conc.records,
    dfsVaults: [...dfsNew.records, ...dfsOld.records],
    complete: {
      launches: launches.complete,
      almm: almm.complete,
      conc: conc.complete,
      dfs: dfsNew.complete && dfsOld.complete
    },
    head
  };
}
const LS_META = "evenfield.v1.meta";
const metaCache = /* @__PURE__ */ new Map();
for (const [k, v] of Object.entries(lsGet(LS_META) ?? {})) {
  if (v && v.name && v.symbol) metaCache.set(k, { ...v, resolved: true });
}
const metaInflight = /* @__PURE__ */ new Map();
const metaFailedAt = /* @__PURE__ */ new Map();
const META_FALLBACK = { name: "", symbol: "", decimals: 18, resolved: false };
function tokenMeta(token) {
  if (token.toLowerCase() === WETH.toLowerCase()) {
    return Promise.resolve({ name: "Wrapped Ether", symbol: "WETH", decimals: 18, resolved: true });
  }
  const key = token.toLowerCase();
  const hit = metaCache.get(key);
  if (hit) return Promise.resolve(hit);
  const flying = metaInflight.get(key);
  if (flying) return flying;
  const failedAt = metaFailedAt.get(key);
  if (failedAt && Date.now() - failedAt < 2e4) return Promise.resolve(META_FALLBACK);
  const job = (async () => {
    try {
      const one = async (functionName) => read({ address: token, abi: erc20Abi, functionName }).catch(() => null);
      const [name, symbol, decimals] = await Promise.all([one("name"), one("symbol"), one("decimals")]);
      if (typeof name === "string" && name && typeof symbol === "string" && symbol) {
        const meta = { name, symbol, decimals: typeof decimals === "number" ? decimals : 18, resolved: true };
        metaCache.set(key, meta);
        metaFailedAt.delete(key);
        lsSet(LS_META, Object.fromEntries(metaCache));
        return meta;
      }
      metaFailedAt.set(key, Date.now());
      return META_FALLBACK;
    } finally {
      metaInflight.delete(key);
    }
  })();
  metaInflight.set(key, job);
  return job;
}
const poolAbi = ammoraLaunchPoolV4Abi;
const factoryAbi = ammoraLaunchFactoryV4Abi;
function revertName(e) {
  let cur = e;
  for (let i = 0; i < 6 && cur && typeof cur === "object"; i++) {
    const o = cur;
    if (typeof o.data?.errorName === "string") return o.data.errorName;
    if (typeof o.errorName === "string") return o.errorName;
    cur = o.cause;
  }
  return "";
}
const NOT_READY = /NotReady|NothingTo|NoSurplus|NoLeftover|NotYet/i;
function isContractRevert(e) {
  let cur = e;
  for (let i = 0; i < 8 && cur && typeof cur === "object"; i++) {
    const o = cur;
    if (o.name === "ContractFunctionExecutionError") return true;
    cur = o.cause;
  }
  return false;
}
async function curveInfo(curve) {
  try {
    const vc = new AmmoraV4LaunchCurveClient(publicClient, curve, { launchFactory: FACTORY, feePolicy: FEE_POLICY });
    const st = await queued(() => withRetry(() => vc.getState(), 2, 400));
    return {
      status: st.status,
      creator: st.creator,
      baseToken: st.baseToken,
      quoteToken: st.quoteToken,
      partnerRecipient: st.partnerRecipient
    };
  } catch {
    const [status, creator, baseToken, quoteToken] = await Promise.all([
      read({ address: curve, abi: poolAbi, functionName: "status" }),
      read({ address: curve, abi: poolAbi, functionName: "creator" }),
      read({ address: curve, abi: poolAbi, functionName: "baseToken" }),
      read({ address: curve, abi: poolAbi, functionName: "quoteToken" })
    ]);
    return { status: Number(status), creator, baseToken, quoteToken, partnerRecipient: ZERO };
  }
}
async function lookup(target, disc2, onProgress) {
  const rows = [];
  const streamOk = {
    surplus: disc2.complete.launches,
    leftover: disc2.complete.launches,
    partner: disc2.complete.launches,
    almm: disc2.complete.almm,
    arl: disc2.complete.conc,
    dfs: disc2.complete.dfs
  };
  const mine = disc2.launches.filter((l) => l.creator.toLowerCase() === target.toLowerCase());
  mine.length + disc2.launches.length + disc2.almmPools.length + disc2.concPools.length + disc2.dfsVaults.length;
  await Promise.all(
    mine.map(async (l) => {
      try {
        const info = await curveInfo(l.curve);
        if (info.creator.toLowerCase() !== target.toLowerCase()) return;
        if (info.status === 2) {
          try {
            const { result } = await simulate({
              address: l.curve,
              abi: poolAbi,
              functionName: "claimSurplus",
              account: target
            });
            rows.push({
              key: `surplus-${l.curve}`,
              stream: "surplus",
              source: { launchToken: l.token },
              token: info.quoteToken,
              amount: result,
              state: result > 0n ? "claimable" : "zero",
              claim: { kind: "surplus", curve: l.curve }
            });
          } catch (e) {
            const notReady = isContractRevert(e) || NOT_READY.test(revertName(e));
            if (!notReady) streamOk.surplus = false;
            rows.push({
              key: `surplus-${l.curve}`,
              stream: "surplus",
              source: { launchToken: l.token },
              token: info.quoteToken,
              amount: null,
              state: notReady ? "notready" : "unavailable",
              claim: { kind: "surplus", curve: l.curve }
            });
          }
        } else if (info.status === 3) {
          try {
            const { result } = await simulate({
              address: l.curve,
              abi: poolAbi,
              functionName: "withdrawLeftover",
              account: target
            });
            rows.push({
              key: `leftover-${l.curve}`,
              stream: "leftover",
              source: { launchToken: l.token },
              token: info.quoteToken,
              amount: result,
              state: result > 0n ? "claimable" : "zero",
              claim: { kind: "leftover", curve: l.curve }
            });
          } catch (e) {
            const notReady = isContractRevert(e) || NOT_READY.test(revertName(e));
            if (!notReady) streamOk.leftover = false;
            rows.push({
              key: `leftover-${l.curve}`,
              stream: "leftover",
              source: { launchToken: l.token },
              token: info.quoteToken,
              amount: null,
              state: notReady ? "notready" : "unavailable",
              claim: { kind: "leftover", curve: l.curve }
            });
          }
        }
      } catch {
        streamOk.surplus = false;
        streamOk.leftover = false;
      } finally {
      }
    })
  );
  await Promise.all(
    disc2.launches.map(async (l) => {
      try {
        const partner = await read({
          address: FACTORY,
          abi: factoryAbi,
          functionName: "poolCreationFeePartner",
          args: [l.curve]
        });
        if (partner && partner.toLowerCase() === target.toLowerCase()) {
          try {
            const { result } = await simulate({
              address: FACTORY,
              abi: factoryAbi,
              functionName: "claimPartnerPoolCreationFee",
              args: [l.curve],
              account: target
            });
            rows.push({
              key: `partner-${l.curve}`,
              stream: "partner",
              source: { launchToken: l.token },
              token: null,
              // paid in native ETH
              amount: result,
              state: result > 0n ? "claimable" : "zero",
              claim: { kind: "partner", curve: l.curve }
            });
          } catch (e) {
            const notReady = isContractRevert(e) || NOT_READY.test(revertName(e));
            if (!notReady) streamOk.partner = false;
            rows.push({
              key: `partner-${l.curve}`,
              stream: "partner",
              source: { launchToken: l.token },
              token: null,
              amount: null,
              state: notReady ? "notready" : "unavailable",
              claim: { kind: "partner", curve: l.curve }
            });
          }
        }
      } catch {
        streamOk.partner = false;
      } finally {
      }
    })
  );
  await Promise.all(
    disc2.almmPools.map(async (p) => {
      try {
        const [baseOwed, quoteOwed] = await Promise.all([
          read({ address: p.pool, abi: almmBinPoolAbi, functionName: "referralFeeBaseOwed", args: [target] }),
          read({ address: p.pool, abi: almmBinPoolAbi, functionName: "referralFeeQuoteOwed", args: [target] })
        ]);
        for (const [token, amount] of [
          [p.baseToken, baseOwed],
          [p.quoteToken, quoteOwed]
        ]) {
          rows.push({
            key: `almm-${p.pool}-${token}`,
            stream: "almm",
            source: { pair: [p.baseToken, p.quoteToken] },
            token,
            amount,
            state: amount > 0n ? "claimable" : "zero",
            claim: { kind: "almm", pool: p.pool, token }
          });
        }
      } catch {
        streamOk.almm = false;
      } finally {
      }
    })
  );
  {
    const vaultOf = /* @__PURE__ */ new Map();
    await Promise.all(
      disc2.concPools.map(async (p) => {
        try {
          const feeVault = await read({
            address: p.pool,
            abi: ammConcentratedPoolV3Abi,
            functionName: "feeVault"
          });
          if (feeVault && feeVault !== ZERO) vaultOf.set(p.pool.toLowerCase(), feeVault);
        } catch {
          streamOk.arl = false;
        } finally {
        }
      })
    );
    const byVault = /* @__PURE__ */ new Map();
    for (const p of disc2.concPools) {
      const fv = vaultOf.get(p.pool.toLowerCase());
      if (!fv) continue;
      const key = fv.toLowerCase();
      const entry = byVault.get(key) ?? { feeVault: fv, pools: [], tokens: /* @__PURE__ */ new Map() };
      entry.pools.push(p);
      entry.tokens.set(p.baseToken.toLowerCase(), p.baseToken);
      entry.tokens.set(p.quoteToken.toLowerCase(), p.quoteToken);
      byVault.set(key, entry);
    }
    await Promise.all(
      [...byVault.values()].map(async (entry) => {
        const role = entry.pools.some((p) => p.creator.toLowerCase() === target.toLowerCase()) ? "creator" : "referral";
        for (const token of entry.tokens.values()) {
          try {
            const amount = await read({
              address: entry.feeVault,
              abi: feeVaultAbi,
              functionName: "claimable",
              args: [token, target]
            });
            rows.push({
              key: `arl-${entry.feeVault}-${token}`,
              stream: "arl",
              source: { vault: entry.feeVault },
              token,
              amount,
              state: amount > 0n ? "claimable" : "zero",
              role,
              claim: { kind: "arl", pool: entry.pools[0].pool, feeVault: entry.feeVault, token }
            });
          } catch {
            streamOk.arl = false;
          }
        }
      })
    );
  }
  await Promise.all(
    disc2.dfsVaults.map(async (v) => {
      try {
        const dc = new DFSClient(publicClient, v.vault);
        const st = await queued(() => withRetry(() => dc.getState(), 2, 400));
        for (const r of st.recipients) {
          if (r.recipient.toLowerCase() !== target.toLowerCase()) continue;
          const totalShare = st.totalShare > 0n ? st.totalShare : 1n;
          const pct = Number(r.share * 10000n / totalShare) / 100;
          rows.push({
            key: `dfs-${v.vault}-${r.index}`,
            stream: "dfs",
            source: { vault: v.vault },
            token: st.token,
            amount: r.claimable,
            state: r.claimable > 0n ? "claimable" : "zero",
            shareText: `${pct}%`,
            claim: { kind: "dfs", vault: v.vault, index: r.index }
          });
        }
      } catch {
        streamOk.dfs = false;
      } finally {
      }
    })
  );
  return { address: target, rows, streamOk, block: disc2.head };
}
const A1 = "0x13cd27a6e337097db858c9c4fa472fbad2f2c637";
const disc = await discover();
console.log("discovery complete:", JSON.stringify(disc.complete), "launches:", disc.launches.length, "dfsVaults:", disc.dfsVaults.length);
const res = await lookup(A1, disc);
console.log("streamOk:", JSON.stringify(res.streamOk));
for (const r of res.rows) {
  if (r.amount === null || r.amount > 0n || r.state !== "zero") {
    let sym = "ETH";
    if (r.token) {
      const m = await tokenMeta(r.token);
      sym = m.symbol;
    }
    console.log(r.stream, r.state, r.amount?.toString(), sym, "src:", JSON.stringify(r.source), "role:", r.role ?? "");
  }
}
console.log("total rows:", res.rows.length, "nonzero rows:", res.rows.filter((r) => r.amount && r.amount > 0n).length);
