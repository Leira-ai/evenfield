// Monetization probes, round 3.
// Test 1c: Config registration using the OFFICIAL example config document
//          (src/launch/config-document.example.json from AmmoraLabs/
//          ammora-examples, which targets the live auto-route registry),
//          with configOwner = fresh address and partnerRecipient = product
//          stand-in. Built with the SDK's own buildCreateAmmoraV4Config and
//          validated with assertAmmoraV4Config, then eth_call-simulated.
// Test 2c: DFS createVault raw simulation with a checksummed-safe product
//          address (round 2 failed on address validation only).
import { createPublicClient, http, defineChain } from 'viem';
import { readFileSync } from 'node:fs';
import * as sdk from '@ammora-protocol/sdk';

const RPC_URL = 'https://sepolia-rpc.giwa.io';
const FRESH = '0x000000000000000000000000000000000000dead';
const PRODUCT = '0x000000000000000000000000000000000000ba11';
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
// Mirror of the examples repo's document parser: walk the V4 registry ABI.
function parseParam(param, value) {
  if (param.type === 'tuple[]') return value.map((v) => parseParam({ ...param, type: 'tuple' }, v));
  if (param.type === 'tuple') {
    const o = {};
    for (const c of param.components) o[c.name] = parseParam(c, value[c.name]);
    return o;
  }
  if (param.type === 'address' || param.type === 'bool') return value;
  const m = /^uint(\d+)$/.exec(param.type);
  if (m) return Number(m[1]) <= 48 ? value : BigInt(value);
  throw new Error(`unsupported type ${param.type}`);
}

// ---------- Test 1c ----------
try {
  const doc = JSON.parse(readFileSync(new URL('../probe/examples/src/launch/config-document.example.json', import.meta.url), 'utf8'));
  const abi = sdk.ammoraLaunchConfigRegistryV4Abi;
  const createFn = abi.find((f) => f.type === 'function' && f.name === 'createConfig');
  const config = parseParam(createFn.inputs[0], doc.config);
  const segments = parseParam(createFn.inputs[1], doc.segments);
  config.partnerRecipient = PRODUCT; // the monetization question: arbitrary fee recipient
  if (config.liquidityDistribution) config.liquidityDistribution.partner = PRODUCT;
  sdk.assertAmmoraV4Config(config, segments);
  const tx = sdk.buildCreateAmmoraV4Config(config, segments, FRESH);
  out.tests.configRegistration = { registry: REGISTRY, built: true, partnerRecipient: PRODUCT };
  try {
    const res = await client.call({ account: FRESH, to: REGISTRY, data: tx.data });
    out.tests.configRegistration.result = 'SIMULATION_OK';
    out.tests.configRegistration.returned = res.data ?? null;
    out.tests.configRegistration.verdict = 'PROVEN (by simulation): a fresh third-party address can register a new Config on the auto-route registry naming an arbitrary partner fee recipient.';
  } catch (e) {
    out.tests.configRegistration.result = 'SIMULATION_REVERTED';
    out.tests.configRegistration.error = errText(e);
    out.tests.configRegistration.verdict = 'The official example config, owned by a fresh address, reverts in simulation; registration is not open as simulated.';
  }
} catch (e) {
  out.tests.configRegistration = { result: 'SETUP_FAILED', error: errText(e) };
}

// ---------- Test 2c ----------
try {
  const fAbi = sdk.ammoraAFSFactoryAbi;
  const salt = '0x0000000000000000000000000000000000000000000000000000000000000001';
  const { encodeFunctionData } = await import('viem');
  await client.call({
    account: FRESH, to: DFS_FACTORY,
    data: encodeFunctionData({
      abi: fAbi, functionName: 'createVault',
      args: [FRESH, WETH, [FRESH, PRODUCT], [9500n, 500n], salt],
    }),
  });
  out.tests.dfsVault = {
    result: 'SIMULATION_OK',
    verdict: 'PROVEN (by simulation): a fresh address can create a DFS vault on the auto-route factory with a 5% open product weight (500/10000). The SDK DFSFactoryClient refuses this factory (it authenticates the sealed slot as reviewed), so the product uses the raw factory call, planner-fallback style.',
  };
} catch (e) {
  out.tests.dfsVault = { result: 'SIMULATION_REVERTED', error: errText(e), verdict: 'Raw createVault reverts in simulation from a fresh address.' };
}

console.log(JSON.stringify(out, null, 1));
