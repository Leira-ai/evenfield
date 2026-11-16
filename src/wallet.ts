// Wallet layer, Gate 8 (wagmi v3, study decision D3): EIP-6963
// discovery, one injected connector per announced provider, a
// WalletConnect option for mobile users, four explicit states
// (disconnected, connecting, connected, wrong-network), silent
// reconnect on load, and chain switching with an EIP-3085 add-chain
// fallback using the verified GIWA Sepolia profile. No signature is
// ever requested for browsing or connecting; signatures happen only
// inside an action, after Gate 9 simulation, in the money engine.
// The 9134 guard is a copy rule, not a block: 9134 is GIWA's
// reserved-but-unreleased mainnet id, and this app never points a
// wallet at it.
import {
  createConfig, connect, disconnect, reconnect, watchAccount, getAccount,
  switchChain, getWalletClient, http, type Config,
} from '@wagmi/core';
import { injected, walletConnect } from '@wagmi/connectors';
import { defineChain, type Address, type WalletClient } from 'viem';
import { CHAIN_ID } from './chain';

export interface WalletState {
  status: 'disconnected' | 'connecting' | 'connected' | 'wrong-network';
  address?: Address;
  chainId?: number;
}
export interface WalletOption { id: string; name: string; icon?: string }

export const WALLETCONNECT_PROJECT_ID: string =
  (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_WC_PROJECT_ID ?? '';

const giwaChain = defineChain({
  id: CHAIN_ID,
  name: 'GIWA Sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://sepolia-rpc.giwa.io'] } },
  blockExplorers: { default: { name: 'GIWA Sepolia Explorer', url: 'https://sepolia-explorer.giwa.io' } },
  testnet: true,
});

interface Announced { info: { uuid: string; name: string; icon?: string; rdns?: string }; provider: never }
const announced = new Map<string, Announced>();
let discoveryStarted = false;
let config: Config | null = null;
let connectorById = new Map<string, ReturnType<typeof injected> | ReturnType<typeof walletConnect>>();
let unwatch: (() => void) | null = null;
const listeners = new Set<(s: WalletState) => void>();
let state: WalletState = { status: 'disconnected' };

function emit() { for (const fn of listeners) fn(state); }
function setState(next: WalletState) { state = next; emit(); }

function rebuildConfig() {
  connectorById = new Map();
  const connectors: Array<ReturnType<typeof injected> | ReturnType<typeof walletConnect>> = [];
  for (const [uuid, a] of announced) {
    const c = injected({
      target: { id: a.info.rdns ?? a.info.uuid, name: a.info.name, provider: a.provider as never },
    });
    connectorById.set(uuid, c);
    connectors.push(c);
  }
  if (announced.size === 0) {
    const shim = injected();
    connectorById.set('injected-shim', shim);
    connectors.push(shim);
  }
  if (WALLETCONNECT_PROJECT_ID) {
    const wc = walletConnect({ projectId: WALLETCONNECT_PROJECT_ID, showQrModal: true });
    connectorById.set('walletconnect', wc);
    connectors.push(wc);
  }
  config = createConfig({
    chains: [giwaChain],
    connectors,
    transports: { [giwaChain.id]: http('https://sepolia-rpc.giwa.io') },
  });
  if (unwatch) unwatch();
  unwatch = watchAccount(config, {
    onChange(account) {
      if (account.status === 'connected') {
        setState({
          status: account.chainId === giwaChain.id ? 'connected' : 'wrong-network',
          address: account.address,
          chainId: account.chainId,
        });
      } else if (account.status === 'connecting' || account.status === 'reconnecting') {
        setState({ status: 'connecting', address: state.address, chainId: state.chainId });
      } else {
        setState({ status: 'disconnected' });
      }
    },
  });
}

function startDiscovery() {
  if (discoveryStarted || typeof window === 'undefined') return;
  discoveryStarted = true;
  window.addEventListener('eip6963:announceProvider', (ev) => {
    const detail = (ev as CustomEvent<Announced>).detail;
    if (!detail?.info?.uuid) return;
    const isNew = !announced.has(detail.info.uuid);
    announced.set(detail.info.uuid, detail);
    if (isNew && state.status === 'disconnected') rebuildConfig();
  });
  window.dispatchEvent(new Event('eip6963:requestProvider'));
  rebuildConfig();
}

export function subscribeWallet(fn: (s: WalletState) => void): () => void {
  listeners.add(fn);
  fn(state);
  return () => listeners.delete(fn);
}

export async function initWallet(): Promise<void> {
  startDiscovery();
  await new Promise((r) => setTimeout(r, 450));
  if (announced.size > 0) rebuildConfig();
  if (!config) rebuildConfig();
  try { await reconnect(config!); } catch { /* nothing stored, fine */ }
}

export function listWalletOptions(): WalletOption[] {
  startDiscovery();
  const out: WalletOption[] = [];
  for (const [uuid, a] of announced) out.push({ id: uuid, name: a.info.name, icon: a.info.icon });
  if (announced.size === 0 && typeof window !== 'undefined' && (window as { ethereum?: unknown }).ethereum) {
    out.push({ id: 'injected-shim', name: 'Browser wallet' });
  }
  if (WALLETCONNECT_PROJECT_ID) out.push({ id: 'walletconnect', name: 'WalletConnect' });
  return out;
}

export async function connectWith(id: string): Promise<void> {
  if (!config) rebuildConfig();
  const connector = connectorById.get(id);
  if (!connector) throw new Error('wallet option unavailable');
  setState({ status: 'connecting' });
  try {
    await connect(config!, { connector });
  } catch (e) {
    setState({ status: 'disconnected' });
    throw e;
  }
}

export async function disconnectWallet(): Promise<void> {
  if (!config) return;
  try { await disconnect(config); } catch { /* already gone */ }
  setState({ status: 'disconnected' });
}

export async function switchToGiwa(): Promise<void> {
  if (!config) rebuildConfig();
  try {
    await switchChain(config!, { chainId: giwaChain.id });
  } catch (e) {
    const code = (e as { code?: number; cause?: { code?: number } })?.code ?? (e as { cause?: { code?: number } })?.cause?.code;
    if (code !== 4902) throw e;
    const account = getAccount(config!);
    const provider = await account.connector?.getProvider() as { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> } | undefined;
    if (!provider) throw e;
    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [{
        chainId: '0x' + giwaChain.id.toString(16),
        chainName: giwaChain.name,
        nativeCurrency: giwaChain.nativeCurrency,
        rpcUrls: ['https://sepolia-rpc.giwa.io'],
        blockExplorerUrls: ['https://sepolia-explorer.giwa.io'],
      }],
    });
    await switchChain(config!, { chainId: giwaChain.id });
  }
}

/** Chain id of any available provider, connected or not (chain checker). */
export async function anyProviderChainId(): Promise<number | null> {
  startDiscovery();
  const first = announced.values().next().value as Announced | undefined;
  const provider = (first?.provider ?? (typeof window !== 'undefined' ? (window as { ethereum?: unknown }).ethereum : undefined)) as
    | { request: (a: { method: string }) => Promise<string> } | undefined;
  if (!provider) return null;
  try {
    const hex = await provider.request({ method: 'eth_chainId' });
    return parseInt(hex, 16);
  } catch { return null; }
}

/** The connected visitor wallet for the money engine (Gate 9 lives there). */
export async function getConnectedWallet(): Promise<{ address: Address; client: WalletClient }> {
  if (!config || state.status !== 'connected' || !state.address) throw new Error('wallet not connected');
  const client = await getWalletClient(config, { chainId: giwaChain.id });
  return { address: state.address, client };
}
