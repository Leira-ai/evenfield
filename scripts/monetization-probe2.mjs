// Monetization probes, round 2 (see monetization-probe.mjs for round 1).
// Test 1b: Config registration — decode get(1) with a type-widened ABI (the
//          registry's real ABI makes viem throw on a 1e24 field), rebuild the
//          config object, encode createConfig with the REAL abi, simulate
//          from the fresh address.
// Test 2b: DFS vault creation — the SDK factory client refuses the auto-route
//          factory (it authenticates a different reviewed slot), so the raw
//          factory call createVault(owner, token, recipients, shares, salt)
//          is simulated directly from the fresh address.
import { createPublicClient, http, defineChain, encodeFunctionData, decodeFunctionResult } from 'viem';
import * as sdk from '@ammora-protocol/sdk';

const RPC_URL = 'https://sepolia-rpc.giwa.io';
const FRESH = '0x000000000000000000000000000000000000dEaD';
const PRODUCT = '0x000000000000000000000000000000000000bA11';
const AUTO = sdk.giwaSepoliaAutoRouteDeployment;
const REGISTRY = AUTO.contracts.launch.configRegistry;
const WETH = AUTO.contracts.tokens.wrappedNative;
const DFS_FACTORY = AUTO.contracts.feeSharing.factory;

const giwaChain = defineChain({
  id: 91342, name: 'GIWA Sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: { default: { name: 'GIWA Explorer', url: 'https://sepolia-explorer.giwa.io' } },
});
const client = createPublicClient({ chain: giwaChain, transport: http(RPC_URL, { timeout: 30_000, retryCount: 3, retryDelay: 800 }) });
const out = { tests: {} };
function errText(e) {
  let cur = e, best = '';
  for (let i = 0; i < 8 && cur && typeof cur === 'object'; i++) {
    const o = cur;
    if (o.data?.errorName) best = o.data.errorName;
    if (!best && typeof o.shortMessage === 'string') best = o.shortMessage;
    cur = o.cause;
  }
  return (best || String(e?.message ?? e)).slice(0, 240);
}
function widen(node) {
  if (Array.isArray(node)) return node.map(widen);
  if (node && typeof node === 'object') {
    const o = {};
    for (const [k, v] of Object.entries(node)) {
      if (k === 'type' && typeof v === 'string' && /^u?int\d+$/.test(v) && v !== 'uint256') o[k] = 'uint256';
      else o[k] = widen(v);
    }
    return o;
  }
  return node;
}

// ---------- Test 1b ----------
try {
  const regAbi = sdk.segmentedALCConfigRegistryV3Abi;
  const getFn = regAbi.find((x) => x.type === 'function' && x.name === 'get');
  const curveFn = regAbi.find((x) => x.type === 'function' && x.name === 'getCurve');
  const getRaw = await client.call({ to: REGISTRY, data: encodeFunctionData({ abi: regAbi, functionName: 'get', args: [1n] }) });
  const cfg = decodeFunctionResult({ abi: [widen(getFn)], functionName: 'get', data: getRaw.data });
  const curveRaw = await client.call({ to: REGISTRY, data: encodeFunctionData({ abi: regAbi, functionName: 'getCurve', args: [1n] }) });
  const segs = decodeFunctionResult({ abi: [widen(curveFn)], functionName: 'getCurve', data: curveRaw.data });
  out.tests.configRegistration = { decoded: true, segments: segs.length, partnerRecipientInClonedConfig: cfg.partnerRecipient };
  try {
    const sim = await client.simulateContract({
      address: REGISTRY, abi: regAbi, functionName: 'createConfig', args: [cfg, segs, FRESH], account: FRESH,
    });
    out.tests.configRegistration.result = 'SIMULATION_OK';
    out.tests.configRegistration.newConfigId = String(sim.result);
    out.tests.configRegistration.verdict = 'PROVEN (by simulation): a fresh third-party address can register a Config on the auto-route registry (clone of config 1, owner = fresh address).';
  } catch (e) {
    out.tests.configRegistration.result = 'SIMULATION_REVERTED';
    out.tests.configRegistration.error = errText(e);
    out.tests.configRegistration.verdict = 'Registration from a fresh address reverts even with a valid cloned config; treat as NEEDS AMMORA PERMISSION / restricted.';
  }
} catch (e) {
  out.tests.configRegistration = { result: 'SETUP_FAILED', error: errText(e), verdict: 'UNTESTED: widened decode still failed.' };
}

// ---------- Test 2b ----------
try {
  const fAbi = sdk.ammoraAFSFactoryAbi;
  const salt = '0x0000000000000000000000000000000000000000000000000000000000000001';
  const predicted = await client.readContract({
    address: DFS_FACTORY, abi: fAbi, functionName: 'predictVault', args: [FRESH, WETH, WETH, salt],
  }).catch((e) => `predict failed: ${errText(e)}`);
  out.tests.dfsVault = { predictedVault: predicted };
  try {
    await client.call({
      account: FRESH, to: DFS_FACTORY,
      data: encodeFunctionData({
        abi: fAbi, functionName: 'createVault',
        args: [FRESH, WETH, [FRESH, PRODUCT], [9500n, 500n], salt],
      }),
    });
    out.tests.dfsVault.result = 'SIMULATION_OK';
    out.tests.dfsVault.verdict = 'PROVEN (by simulation): a fresh address can create a DFS vault on the auto-route factory with a 5% open product weight (500/10000). Note: the SDK DFSFactoryClient refuses this factory (it authenticates the sealed slot as reviewed), so the product must use the raw factory call, planner-fallback style.';
  } catch (e) {
    out.tests.dfsVault.result = 'SIMULATION_REVERTED';
    out.tests.dfsVault.error = errText(e);
    out.tests.dfsVault.verdict = 'Raw createVault reverts in simulation from a fresh address; see error.';
  }
} catch (e) {
  out.tests.dfsVault = { result: 'SETUP_FAILED', error: errText(e) };
}

console.log(JSON.stringify(out, null, 1));
