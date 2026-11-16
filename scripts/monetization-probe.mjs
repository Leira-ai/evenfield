// Evenfield Phase 0 monetization probes. SIMULATION ONLY (eth_call from a
// fresh, never-used address). Nothing is broadcast, nothing is signed.
// Test 1: can a third party register a NEW launch Config on the auto-route
//         config registry (0x6d043014...)?  (Launchparty fee-recipient path)
// Test 2: can anyone create a DFS fee-sharing vault that includes an open
//         product weight?  (Potluck revenue path)
import { createPublicClient, http, defineChain, encodeFunctionData, toFunctionSelector } from 'viem';
import * as sdk from '@ammora-protocol/sdk';

const RPC_URL = 'https://sepolia-rpc.giwa.io';
const FRESH = '0x000000000000000000000000000000000000dEaD'; // simulation sender only
const PRODUCT = '0x000000000000000000000000000000000000bA11'; // stand-in product recipient
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
const out = { freshSender: FRESH, tests: {} };
function errText(e) {
  let cur = e, best = '';
  for (let i = 0; i < 8 && cur && typeof cur === 'object'; i++) {
    const o = cur;
    if (o.data?.errorName) best = o.data.errorName;
    if (!best && typeof o.shortMessage === 'string') best = o.shortMessage;
    cur = o.cause;
  }
  return (best || String(e?.message ?? e)).slice(0, 220);
}
const strip0x = (h) => h.slice(2);
const word = (n) => BigInt(n).toString(16).padStart(64, '0');

// ---------- Test 1: third-party Config registration (raw-bytes clone) ----------
// viem's decoder throws on this registry (a config field holds 1e24, the
// documented Slipway bug), so the existing config is cloned as RAW return
// bytes of get(1) and re-submitted to createConfig from the fresh address.
try {
  const regAbi = sdk.segmentedALCConfigRegistryV3Abi;
  const createFn = regAbi.find((x) => x.type === 'function' && x.name === 'createConfig');
  out.tests.configRegistration = { createInputs: createFn.inputs.map((i) => `${i.type} ${i.name}`) };
  const getData = encodeFunctionData({ abi: regAbi, functionName: 'get', args: [1n] });
  const getRaw = await client.call({ to: REGISTRY, data: getData });
  let cfgHex = strip0x(getRaw.data);
  // Single static tuple return: no leading offset expected. If the first
  // word is 0x20 and the remainder is a whole number of words, strip it.
  if (cfgHex.slice(0, 64) === word(32) && (cfgHex.length - 64) % 64 === 0 && cfgHex.length > 128) {
    // Ambiguous: a config whose first field (quoteToken address) could look
    // like an offset is impossible (addresses are 20 bytes, left-padded, so
    // word == 0x20 exactly would mean address 0x...20). Treat as offset only
    // if word 2 is a plausible address too; otherwise keep. We keep it simple:
    // addresses never equal 32, so this IS an offset.
    cfgHex = cfgHex.slice(64);
  }
  const curveData = encodeFunctionData({ abi: regAbi, functionName: 'getCurve', args: [1n] });
  const curveRaw = await client.call({ to: REGISTRY, data: curveData });
  let segsHex = strip0x(curveRaw.data);
  if (segsHex.slice(0, 64) === word(32)) segsHex = segsHex.slice(64); // array return: strip offset, keep length+elements
  const cfgWords = cfgHex.length / 64;
  const offset = (cfgWords + 2) * 32;
  const selector = toFunctionSelector(createFn);
  const addrWord = FRESH.slice(2).toLowerCase().padStart(64, '0');
  const calldata = selector + cfgHex + word(offset) + addrWord + segsHex;
  out.tests.configRegistration.configWords = cfgWords;
  try {
    const res = await client.call({ account: FRESH, to: REGISTRY, data: calldata });
    out.tests.configRegistration.result = 'SIMULATION_OK';
    out.tests.configRegistration.returned = res.data;
    out.tests.configRegistration.verdict = 'PROVEN (by simulation): a fresh third-party address can register a Config on the auto-route registry.';
  } catch (e) {
    out.tests.configRegistration.result = 'SIMULATION_REVERTED';
    out.tests.configRegistration.error = errText(e);
    out.tests.configRegistration.verdict = 'Registration from a fresh address reverts; treat as NEEDS AMMORA PERMISSION / restricted.';
  }
} catch (e) {
  out.tests.configRegistration = { ...(out.tests.configRegistration ?? {}), result: 'SETUP_FAILED', error: errText(e), verdict: 'UNTESTED: raw clone path failed before simulation.' };
}

// ---------- Test 2: DFS vault creation with an open product weight ----------
try {
  const fc = new sdk.DFSFactoryClient(client, DFS_FACTORY);
  const params = {
    owner: FRESH,
    token: WETH,
    base: WETH,
    recipients: [
      { recipient: FRESH, share: 9500n },
      { recipient: PRODUCT, share: 500n },
    ],
    userSalt: '0x0000000000000000000000000000000000000000000000000000000000000001',
  };
  const pre = await fc.getVaultCreationPreflight(params);
  out.tests.dfsVault = { preflight: { ready: pre.ready, issues: pre.issues, expectedSender: pre.expectedSender, tokenSupported: pre.tokenPolicy?.supported } };
  const plan = await fc.planCreateVault(params);
  const tx = plan.transaction ?? plan;
  out.tests.dfsVault.planKeys = Object.keys(plan ?? {});
  if (tx && tx.to && tx.data) {
    try {
      await client.call({ account: FRESH, to: tx.to, data: tx.data, value: tx.value ?? 0n });
      out.tests.dfsVault.result = 'SIMULATION_OK';
      out.tests.dfsVault.verdict = 'PROVEN (by simulation): a fresh address can create a weighted DFS vault including a 5% product weight.';
    } catch (e) {
      out.tests.dfsVault.result = 'SIMULATION_REVERTED';
      out.tests.dfsVault.error = errText(e);
      out.tests.dfsVault.verdict = 'Vault creation tx reverts in simulation from a fresh address; see error.';
    }
  } else {
    out.tests.dfsVault.result = 'NO_TX_IN_PLAN';
    out.tests.dfsVault.planPreview = JSON.stringify(plan, (k, v) => (typeof v === 'bigint' ? v.toString() : v)).slice(0, 400);
    out.tests.dfsVault.verdict = 'UNTESTED: planner returned no transaction to simulate.';
  }
} catch (e) {
  out.tests.dfsVault = { result: 'PLANNER_FAILED', error: errText(e), verdict: 'UNTESTED: the SDK planner itself rejected the creation parameters.' };
}

console.log(JSON.stringify(out, null, 1));
