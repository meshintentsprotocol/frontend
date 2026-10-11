/**
 * React data layer for the Mesh pool pages (react-query over the meshserver
 * pool API) plus the LP signer. Everything shown comes from the server or the
 * chain — no demo data.
 */
import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { BCH_MESH_SERVER_URL } from '@/lib/config';
import { createMeshApi, meshWsUrl, type PoolListQuery } from '@/lib/mesh/meshApi';
import { LocalWifSigner, ExternalWcSigner, type MeshSigner, type BchNetwork } from '@/lib/mesh/signer';
import { useWDK } from '@/context/WDKProvider';
import { useExternalBCHWallet } from '@/context/ExternalBCHWalletProvider';
import { useActiveWallet } from '@/hooks/useActiveWallet';
import { electrumProviderFor } from '@/lib/bchElectrum';

export const meshApi = createMeshApi(BCH_MESH_SERVER_URL);

const keys = {
  all: ['mesh'] as const,
  stats: ['mesh', 'stats'] as const,
  pools: (q: PoolListQuery) => ['mesh', 'pools', q] as const,
  pairs: ['mesh', 'pairs'] as const,
  pool: (a: string) => ['mesh', 'pool', a] as const,
  activity: (a: string) => ['mesh', 'activity', a] as const,
  lps: (sort: string) => ['mesh', 'lps', sort] as const,
  lp: (o: string) => ['mesh', 'lp', o] as const,
  recent: ['mesh', 'recent'] as const,
  marketRef: (t: string) => ['mesh', 'market-ref', t] as const,
  health: ['mesh', 'health'] as const,
  templates: ['mesh', 'templates'] as const,
  strategies: (o: string) => ['mesh', 'strategies', o] as const,
  strategy: (id: string) => ['mesh', 'strategy', id] as const,
};

export function useMeshStats(refetchMs = 15_000) {
  return useQuery({ queryKey: keys.stats, queryFn: () => meshApi.stats(), refetchInterval: refetchMs });
}

export function useMeshPools(q: PoolListQuery = {}, opts: { enabled?: boolean; refetchMs?: number } = {}) {
  return useQuery({
    queryKey: keys.pools(q), queryFn: () => meshApi.list(q), enabled: opts.enabled ?? true,
    refetchInterval: opts.refetchMs ?? 15_000, placeholderData: keepPreviousData,
  });
}

export function useMeshPairs(refetchMs = 20_000) {
  return useQuery({ queryKey: keys.pairs, queryFn: () => meshApi.pairs(), refetchInterval: refetchMs });
}

export function useMeshPool(address: string | undefined, refetchMs = 12_000) {
  return useQuery({
    queryKey: keys.pool(address ?? ''), queryFn: () => meshApi.get(address!), enabled: !!address,
    refetchInterval: refetchMs, retry: (n, e: any) => e?.status !== 404 && n < 2,
  });
}

export function useMeshPoolActivity(address: string | undefined, limit = 200) {
  return useQuery({
    queryKey: keys.activity(address ?? ''), queryFn: () => meshApi.activity(address!, { limit }), enabled: !!address,
    refetchInterval: 20_000,
  });
}

export function useMeshLps(sort: 'tvl' | 'volume' | 'fees' | 'pnl' = 'tvl') {
  return useQuery({ queryKey: keys.lps(sort), queryFn: () => meshApi.lps({ sort }), refetchInterval: 30_000, placeholderData: keepPreviousData });
}

export function useMeshLp(owner: string | undefined) {
  return useQuery({
    queryKey: keys.lp(owner ?? ''), queryFn: () => meshApi.lp(owner!), enabled: !!owner,
    refetchInterval: 30_000, retry: (n, e: any) => e?.status !== 404 && n < 2,
  });
}

export function useRecentPoolFills(limit = 25) {
  return useQuery({ queryKey: keys.recent, queryFn: () => meshApi.recentActivity({ limit, type: 'FILL' }), refetchInterval: 20_000 });
}

export function useMarketRef(token: string | undefined) {
  return useQuery({
    queryKey: keys.marketRef(token ?? ''), queryFn: () => meshApi.marketRef(token!), enabled: !!token && token !== '0x',
    refetchInterval: 60_000, staleTime: 30_000,
  });
}

// ── Strategies ───────────────────────────────────────────────────────────────

export function useStrategyTemplates() {
  return useQuery({ queryKey: keys.templates, queryFn: () => meshApi.templates(), staleTime: 10 * 60_000 });
}

export function useStrategies(owner: string | undefined | null) {
  return useQuery({
    queryKey: keys.strategies(owner ?? ''), queryFn: () => meshApi.strategies(owner ?? undefined),
    enabled: owner !== null, refetchInterval: 20_000, placeholderData: keepPreviousData,
  });
}

/**
 * Market context and suggested params for a template (null until a token is chosen).
 * A server without /suggest (before 2026-10-02) answers 404 → treated as "no suggestion".
 */
export function useStrategySuggest(q: { template: string; token?: string; tokens?: string[]; tokenA?: string; tokenB?: string } | null) {
  return useQuery({
    queryKey: ['mesh', 'suggest', q?.template, q?.token, q?.tokens?.join(','), q?.tokenA, q?.tokenB],
    queryFn: () => meshApi.suggest(q!),
    enabled: !!q && !!(q.token || q.tokens?.length || (q.tokenA && q.tokenB)),
    staleTime: 30_000, refetchInterval: 60_000, retry: (n, e: any) => e?.status !== 404 && n < 1,
  });
}

/** Idle liquidity for an owner (wallet proceeds, stale / one-sided pools, dust). */
export function useIdle(owner: string | undefined | null) {
  return useQuery({
    queryKey: ['mesh', 'idle', owner ?? ''], queryFn: () => meshApi.idle(owner!), enabled: !!owner,
    refetchInterval: 60_000, staleTime: 30_000, retry: (n, e: any) => e?.status !== 404 && n < 1,
  });
}

export function useStrategy(id: string | undefined) {
  return useQuery({
    queryKey: keys.strategy(id ?? ''), queryFn: () => meshApi.strategy(id!), enabled: !!id,
    refetchInterval: 15_000, retry: (n, e: any) => e?.status !== 404 && n < 2,
  });
}

/** Server network + reachability (for a network-mismatch warning). */
export function useMeshHealth() {
  return useQuery({
    queryKey: keys.health,
    queryFn: async () => {
      const t0 = performance.now();
      const res = await fetch(`${BCH_MESH_SERVER_URL}/health`);
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
  useEffect(() => {
    let ws: WebSocket | null = null;
    let closed = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const connect = () => {
      try { ws = new WebSocket(meshWsUrl(BCH_MESH_SERVER_URL)); } catch { return; }
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
  }, [address, qc]);
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
        const s = new ExternalWcSigner(activeExtWallet.address, network, provider,
          (payload) => ext.signTransaction(activeWalletId, payload as any));
        return { signer: s, pkh: s.pkh, address: s.address, network, kind: 'external', label: activeExtWallet.label };
      }
    } catch (e: any) {
      return { signer: null, pkh: null, address: null, network, kind: null, label: 'Wallet', unavailable: e?.message ?? String(e) };
    }
    return { signer: null, pkh: null, address: null, network, kind: null, label: 'Wallet', unavailable: 'Connect a BCH wallet' };
  }, [isMainActive, activeExtWallet, activeWalletId, wif, network, ext]);
}
