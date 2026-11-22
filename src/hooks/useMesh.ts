/**
 * React data layer for the Mesh pool pages (react-query over the meshserver
 * pool API) plus the LP signer. Everything shown comes from the server or the
 * chain — no demo data.
 *
 * Network-aware: `meshApiFor(network)` picks the chipnet or mainnet server.
 * All hooks use the signer's network so pool listing, registration, strategy
 * previews and health checks talk to the right server automatically.
 */
import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { BCH_MESH_SERVER_URL, BCH_MESH_SERVER_MAINNET_URL } from '@/lib/config';
import { createMeshApi, meshWsUrl, type PoolListQuery } from '@/lib/mesh/meshApi';
import { LocalWifSigner, ExternalWcSigner, type MeshSigner, type BchNetwork } from '@/lib/mesh/signer';
import { useWDK } from '@/context/WDKProvider';
import { useExternalBCHWallet } from '@/context/ExternalBCHWalletProvider';
import { useActiveWallet } from '@/hooks/useActiveWallet';
import { electrumProviderFor } from '@/lib/bchElectrum';
import { addressSet as wizAddressSet } from '@/lib/wallets/wizardconnect';

// ── Network-aware API instances ──────────────────────────────────────────────

/** Chipnet API instance. */
const chipnetApi = createMeshApi(BCH_MESH_SERVER_URL);
/** Mainnet API instance — falls back to chipnet URL when mainnet URL isn't configured. */
const mainnetApi = BCH_MESH_SERVER_MAINNET_URL
  ? createMeshApi(BCH_MESH_SERVER_MAINNET_URL)
  : chipnetApi;

function getActiveBchNetwork(): BchNetwork {
  try {
    return localStorage.getItem('wdk_bch_network') === 'mainnet' ? 'mainnet' : 'chipnet';
  } catch {
    return 'chipnet';
  }
}

/** Returns the MeshApi instance for the given network. */
export function meshApiFor(network: BchNetwork): ReturnType<typeof createMeshApi> {
  return network === 'mainnet' ? mainnetApi : chipnetApi;
}
/** Returns the mesh server base URL for the given network. */
export function meshUrlFor(network: BchNetwork): string {
  return network === 'mainnet'
    ? (BCH_MESH_SERVER_MAINNET_URL || BCH_MESH_SERVER_URL)
    : BCH_MESH_SERVER_URL;
}

/**
 * Dynamic Proxy meshApi: delegates every method/property call to the active network's MeshApi.
 * Guarantees that even legacy or static calls (retry registration, previews, list, etc.)
 * automatically target the correct server based on the user's active network preference.
 */
export const meshApi: ReturnType<typeof createMeshApi> = new Proxy({} as ReturnType<typeof createMeshApi>, {
  get(_target, prop) {
    const net = getActiveBchNetwork();
    const active = meshApiFor(net);
    const value = (active as any)[prop];
    return typeof value === 'function' ? value.bind(active) : value;
  }
});

// ── React hooks (network-aware via useMeshSigner) ────────────────────────────

const keys = {
  all: ['mesh'] as const,
  stats: (n: string) => ['mesh', 'stats', n] as const,
  pools: (q: PoolListQuery, n: string) => ['mesh', 'pools', n, q] as const,
  pairs: (n: string) => ['mesh', 'pairs', n] as const,
  pool: (a: string) => ['mesh', 'pool', a] as const,
  activity: (a: string) => ['mesh', 'activity', a] as const,
  lps: (sort: string, n: string) => ['mesh', 'lps', n, sort] as const,
  lp: (o: string) => ['mesh', 'lp', o] as const,
  recent: (n: string) => ['mesh', 'recent', n] as const,
  marketRef: (t: string) => ['mesh', 'market-ref', t] as const,
  health: (n: string) => ['mesh', 'health', n] as const,
  templates: (n: string) => ['mesh', 'templates', n] as const,
  strategies: (o: string, n: string) => ['mesh', 'strategies', n, o] as const,
  strategy: (id: string) => ['mesh', 'strategy', id] as const,
};

/** Hook that returns the network-appropriate MeshApi. Must be called inside a React component. */
export function useMeshApi() {
  const { network } = useMeshSigner();
  return useMemo(() => meshApiFor(network), [network]);
}

export function useMeshStats(refetchMs = 15_000) {
  const { network } = useMeshSigner();
  const api = meshApiFor(network);
  return useQuery({ queryKey: keys.stats(network), queryFn: () => api.stats(), refetchInterval: refetchMs });
}

export function useMeshPools(q: PoolListQuery = {}, opts: { enabled?: boolean; refetchMs?: number } = {}) {
  const { network } = useMeshSigner();
  const api = meshApiFor(network);
  return useQuery({
    queryKey: keys.pools(q, network), queryFn: () => api.list(q), enabled: opts.enabled ?? true,
    refetchInterval: opts.refetchMs ?? 15_000,
    placeholderData: (prev, prevQuery) => {
      const previous = prevQuery?.queryKey[3] as PoolListQuery | undefined;
      return previous?.owner === q.owner ? prev : undefined;
    },
  });
}

export function useMeshPairs(refetchMs = 20_000) {
  const { network } = useMeshSigner();
  const api = meshApiFor(network);
  return useQuery({ queryKey: keys.pairs(network), queryFn: () => api.pairs(), refetchInterval: refetchMs });
}

export function useMeshPool(address: string | undefined, refetchMs = 12_000) {
  const { network } = useMeshSigner();
  const api = meshApiFor(network);
  return useQuery({
    queryKey: keys.pool(address ?? ''), queryFn: () => api.get(address!), enabled: !!address,
    refetchInterval: refetchMs, retry: (n, e: any) => e?.status !== 404 && n < 2,
  });
}

export function useMeshPoolActivity(address: string | undefined, limit = 200) {
  const { network } = useMeshSigner();
  const api = meshApiFor(network);
  return useQuery({
    queryKey: keys.activity(address ?? ''), queryFn: () => api.activity(address!, { limit }), enabled: !!address,
    refetchInterval: 20_000,
  });
}

export function useMeshLps(sort: 'tvl' | 'volume' | 'fees' | 'pnl' = 'tvl') {
  const { network } = useMeshSigner();
  const api = meshApiFor(network);
  return useQuery({ queryKey: keys.lps(sort, network), queryFn: () => api.lps({ sort }), refetchInterval: 30_000, placeholderData: keepPreviousData });
}

export function useMeshLp(owner: string | undefined) {
  const { network } = useMeshSigner();
  const api = meshApiFor(network);
  return useQuery({
    queryKey: keys.lp(owner ?? ''), queryFn: () => api.lp(owner!), enabled: !!owner,
    refetchInterval: 30_000, retry: (n, e: any) => e?.status !== 404 && n < 2,
  });
}

export function useRecentPoolFills(limit = 25) {
  const { network } = useMeshSigner();
  const api = meshApiFor(network);
  return useQuery({ queryKey: keys.recent(network), queryFn: () => api.recentActivity({ limit, type: 'FILL' }), refetchInterval: 20_000 });
}

export function useMarketRef(token: string | undefined) {
  const { network } = useMeshSigner();
  const api = meshApiFor(network);
  return useQuery({
    queryKey: keys.marketRef(token ?? ''), queryFn: () => api.marketRef(token!), enabled: !!token && token !== '0x',
    refetchInterval: 60_000, staleTime: 30_000,
  });
}

/** A pair's liquidity per level of the canonical bin grid (404 on servers before 2026-10-16). */
export function usePairDepth(token: string | undefined, step = 100) {
  const { network } = useMeshSigner();
  const api = meshApiFor(network);
  return useQuery({
    queryKey: ['mesh', 'depth', token ?? '', step, network], queryFn: () => api.depth(token!, step), enabled: !!token && token !== '0x',
    refetchInterval: 30_000, staleTime: 15_000, retry: (n, e: any) => e?.status !== 404 && n < 1,
  });
}

// ── Strategies ───────────────────────────────────────────────────────────────

export function useStrategyTemplates() {
  const { network } = useMeshSigner();
  const api = meshApiFor(network);
  return useQuery({ queryKey: keys.templates(network), queryFn: () => api.templates(), staleTime: 10 * 60_000 });
}

export function useStrategies(owner: string | undefined | null) {
  const { network } = useMeshSigner();
  const api = meshApiFor(network);
  return useQuery({
    queryKey: keys.strategies(owner ?? '', network), queryFn: () => api.strategies(owner ?? undefined),
    enabled: owner !== null, refetchInterval: 20_000,
    placeholderData: (prev, prevQuery) => (prevQuery?.queryKey[3] === (owner ?? '') ? prev : undefined),
  });
}

/**
 * Market context and suggested params for a template (null until a token is chosen).
 * A server without /suggest (before 2026-10-02) answers 404 → treated as "no suggestion".
 */
export function useStrategySuggest(q: { template: string; token?: string; tokens?: string[]; tokenA?: string; tokenB?: string } | null) {
  const { network } = useMeshSigner();
  const api = meshApiFor(network);
  return useQuery({
    queryKey: ['mesh', 'suggest', network, q?.template, q?.token, q?.tokens?.join(','), q?.tokenA, q?.tokenB],
    queryFn: () => api.suggest(q!),
    enabled: !!q && !!(q.token || q.tokens?.length || (q.tokenA && q.tokenB)),
    staleTime: 30_000, refetchInterval: 60_000, retry: (n, e: any) => e?.status !== 404 && n < 1,
  });
}

/** Idle liquidity for an owner (wallet proceeds, stale / one-sided pools, dust). */
export function useIdle(owner: string | undefined | null) {
  const { network } = useMeshSigner();
  const api = meshApiFor(network);
  return useQuery({
    queryKey: ['mesh', 'idle', owner ?? ''], queryFn: () => api.idle(owner!), enabled: !!owner,
    refetchInterval: 60_000, staleTime: 30_000, retry: (n, e: any) => e?.status !== 404 && n < 1,
  });
}

export function useStrategy(id: string | undefined) {
  const { network } = useMeshSigner();
  const api = meshApiFor(network);
  return useQuery({
    queryKey: keys.strategy(id ?? ''), queryFn: () => api.strategy(id!), enabled: !!id,
    refetchInterval: 15_000, retry: (n, e: any) => e?.status !== 404 && n < 2,
  });
}

/** Server network + reachability (for a network-mismatch warning). */
export function useMeshHealth() {
  const { network } = useMeshSigner();
  const url = meshUrlFor(network);
  return useQuery({
    queryKey: keys.health(network),
    queryFn: async () => {
      const t0 = performance.now();
      const res = await fetch(`${url}/health`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json() as { status: string; network: 'chipnet' | 'mainnet' };
      return { ...body, latencyMs: Math.round(performance.now() - t0) };
    },
    refetchInterval: 30_000,
    retry: 1,
  });
}

/** Invalidate pool queries when the server pushes pool events (subscribes to `pools` or `pool:<address>`). */
export function useMeshPoolStream(address?: string) {
  const qc = useQueryClient();
  const { network } = useMeshSigner();
  const url = meshUrlFor(network);
  useEffect(() => {
    let ws: WebSocket | null = null;
    let closed = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const connect = () => {
      try { ws = new WebSocket(meshWsUrl(url)); } catch { return; }
      ws.onopen = () => ws?.send(JSON.stringify({ action: 'subscribe', channel: address ? `pool:${address}` : 'pools' }));
      ws.onmessage = (m) => {
        let d: any;
        try { d = JSON.parse(String(m.data)); } catch { return; }
        if (typeof d?.type !== 'string' || !d.type.startsWith('pool:')) return;
        qc.invalidateQueries({ queryKey: keys.all });
      };
      ws.onclose = () => { if (!closed) retry = setTimeout(connect, 5_000); };
    };
    connect();
    return () => { closed = true; clearTimeout(retry); ws?.close(); };
  }, [address, qc, url, network]);
}

export function useInvalidateMesh() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: keys.all });
}

/** Spendable balances of the signing wallet (plain BCH, fungible tokens by category), read from chain. */
export function useSignerBalances(signer: MeshSigner | null) {
  return useQuery({
    queryKey: ['mesh', 'balances', signer?.address ?? ''],
    enabled: !!signer,
    refetchInterval: 15_000,
    queryFn: async () => {
      const utxos = await signer!.getUtxos();
      let sats = 0n;
      const tokens: Record<string, bigint> = {};
      for (const u of utxos) {
        if (!u.token) { sats += u.satoshis; continue; }
        if (u.token.nft) continue;
        const c = u.token.category.toLowerCase();
        tokens[c] = (tokens[c] ?? 0n) + u.token.amount;
      }
      return { sats, tokens, utxoCount: utxos.length };
    },
  });
}

// ── Signer ───────────────────────────────────────────────────────────────────

export interface MeshSignerState {
  signer: MeshSigner | null;
  /** Owner pkh of the connected wallet (compressed-key hash), or null. */
  pkh: string | null;
  address: string | null;
  network: BchNetwork;
  kind: 'local' | 'external' | null;
  label: string;
  /** Why signing is unavailable, if it is. */
  unavailable?: string;
}

/** The active BCH wallet (built-in or external) as a MeshSigner. */
export function useMeshSigner(): MeshSignerState {
  const wdk = useWDK();
  const ext = useExternalBCHWallet();
  const { isMainActive, activeExtWallet, activeWalletId } = useActiveWallet();
  const network = (wdk.bchNetwork ?? 'chipnet') as BchNetwork;
  const wif: string | undefined = (wdk.bchWallet as any)?.privateKeyWif;

  return useMemo<MeshSignerState>(() => {
    const provider = electrumProviderFor(network);
    try {
      if (isMainActive) {
        if (!wif) return { signer: null, pkh: null, address: null, network, kind: null, label: 'Cham Wallet', unavailable: 'Unlock or create the built-in wallet' };
        const s = new LocalWifSigner(wif, network, provider);
        return { signer: s, pkh: s.pkh, address: s.address, network, kind: 'local', label: 'Cham Wallet' };
      }
      if (activeExtWallet) {
        // For WizardConnect HD wallets: provide addressSet so all addresses' UTXOs are collected.
        const hdAddressSet = activeExtWallet.source === 'wizardconnect'
          ? () => Promise.resolve(wizAddressSet(activeExtWallet.id))
          : undefined;
        const s = new ExternalWcSigner(activeExtWallet.address, network, provider,
          (payload) => ext.signTransaction(activeExtWallet.id, payload as any),
          hdAddressSet);
        return { signer: s, pkh: s.pkh, address: s.address, network, kind: 'external', label: activeExtWallet.label };
      }
    } catch (e: any) {
      return { signer: null, pkh: null, address: null, network, kind: null, label: 'Wallet', unavailable: e?.message ?? String(e) };
    }
    return { signer: null, pkh: null, address: null, network, kind: null, label: 'Wallet', unavailable: 'Connect a BCH wallet' };
  }, [isMainActive, activeExtWallet, activeWalletId, wif, network, ext]);
}
