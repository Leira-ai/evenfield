// Evenfield live reads: quotes, delta sync, chain attestation.
// Transport comes from money.ts (the Glean-proven client): no batching,
// retry with backoff, concurrency-limited queues.
import {
  ALCClient,
  attestAmmoraDeployment,
  createAmmoraDeploymentSource,
  giwaSepoliaAutoRouteDeployment as AUTO,
  segmentedBondingCurveV3Abi,
} from '@ammora-protocol/sdk';
import { decodeEventLog, keccak256, parseAbiItem, toHex, type Address } from 'viem';
import { publicClient, withRetry, getBlockNumber } from './money';

export const EXPLORER = 'https://sepolia-explorer.giwa.io';
export const REGISTRY = AUTO.contracts.launch.configRegistry as Address;
export const CHAIN_ID = 91342;

export interface LiveQuote {
  amountOut: bigint;
  fee: bigint;
  amountIn: bigint;
  block: bigint;
}

/** Live buy/sell quote for a curve via the SDK ALC client. Throws on failure;
 *  callers decide the labelled fallback. Never rendered raw. */
export async function liveQuote(curve: Address, amountIn: bigint, baseForQuote: boolean): Promise<LiveQuote> {
  const alc = new ALCClient(publicClient, curve, REGISTRY);
  const q = await withRetry(() => alc.quoteExactInput(amountIn, baseForQuote), 2, 400);
  const block = await getBlockNumber();
  return { amountOut: q.amountOut, fee: q.fee, amountIn: q.amountIn, block };
}

export async function curveStatus(curve: Address): Promise<number | null> {
  try {
    const s = await withRetry(
      () => publicClient.readContract({ address: curve, abi: segmentedBondingCurveV3Abi as never, functionName: 'status' as never }),
      2, 350,
    );
    return Number(s);
  } catch {
    return null;
  }
}

// ---------- delta sync: LaunchCreated from the snapshot watermark ----------
const LAUNCH_TOPIC = keccak256(toHex('LaunchCreated(address,address,address,uint256,bytes32,uint16,string)'));
const launchAbi = [parseAbiItem('event LaunchCreated(address indexed token, address indexed curve, address indexed creator, uint256 configId, bytes32 configHash, uint16 protocolVersion, string metadataURI)')];
const CHUNK = 10_000;

export interface DeltaLaunch {
  token: string;
  curve: string;
  creator: string;
  configId: string;
  protocolVersion: number;
  uri: string;
  block: number;
  tx: string;
  factory: string;
  slots: string[];
}

/** Scan LaunchCreated across every catalog launch factory from `fromBlock`
 *  to head. Returns what it found; callers enforce the time budget and never
 *  block a screen on this. */
export async function deltaScan(factories: { factory: string; slots: string[] }[], fromBlock: number): Promise<{ launches: DeltaLaunch[]; head: number }> {
  const head = Number(await getBlockNumber());
  const out: DeltaLaunch[] = [];
  if (head <= fromBlock) return { launches: out, head };
  for (const f of factories) {
    for (let s = fromBlock + 1; s <= head; s += CHUNK) {
      const e = Math.min(s + CHUNK - 1, head);
      const logs = await withRetry(
        () =>
          publicClient.request({
            method: 'eth_getLogs',
            params: [{ address: f.factory as Address, topics: [LAUNCH_TOPIC], fromBlock: `0x${s.toString(16)}`, toBlock: `0x${e.toString(16)}` }],
          } as never),
        2, 500,
      ).catch(() => null);
      if (!logs) continue;
      for (const log of logs as { data: `0x${string}`; topics: [`0x${string}`, ...`0x${string}`[]]; blockNumber: string; transactionHash: string }[]) {
        try {
          const dec = decodeEventLog({ abi: launchAbi, data: log.data, topics: log.topics });
          out.push({
            token: dec.args.token,
            curve: dec.args.curve,
            creator: dec.args.creator,
            configId: dec.args.configId.toString(),
            protocolVersion: Number(dec.args.protocolVersion),
            uri: dec.args.metadataURI ?? '',
            block: Number(BigInt(log.blockNumber)),
            tx: log.transactionHash,
            factory: f.factory,
            slots: f.slots,
          });
        } catch { /* skip undecodable */ }
      }
    }
  }
  return { launches: out, head };
}

// ---------- chain checker ----------
export type ChainVerdict =
  | { kind: 'real'; attested: boolean }
  | { kind: 'reserved' }
  | { kind: 'unknown' };

/** The attested catalog knows exactly one chain: GIWA Sepolia 91342.
 *  9134 is GIWA's RESERVED mainnet chain id: real in the public registry,
 *  but the mainnet has NOT launched, and a copycat chain using that id
 *  drained wallets in September 2026 precisely because the reservation
 *  made it look official. A matching chain id is not proof of the real
 *  chain; only the attested catalog is. Everything else is unknown. For
 *  91342 we additionally run the SDK runtime attestation. */
export async function checkChainId(id: number): Promise<ChainVerdict> {
  if (id === 9134) return { kind: 'reserved' };
  if (id !== CHAIN_ID) return { kind: 'unknown' };
  try {
    const source = createAmmoraDeploymentSource([AUTO]);
    const provider = {
      id: 'giwa-sepolia-public-rpc',
      client: {
        getChainId: () => publicClient.getChainId(),
        getBytecode: ({ address }: { address: Address }) => publicClient.getBytecode({ address }),
      },
    };
    await attestAmmoraDeployment({ chainId: CHAIN_ID, source, providers: [provider] });
    return { kind: 'real', attested: true };
  } catch {
    return { kind: 'real', attested: false };
  }
}

export async function walletChainId(): Promise<number | null> {
  const eth = (window as unknown as { ethereum?: { request: (a: { method: string }) => Promise<string> } }).ethereum;
  if (!eth) return null;
  try {
    const hex = await eth.request({ method: 'eth_chainId' });
    return parseInt(hex, 16);
  } catch {
    return null;
  }
}
