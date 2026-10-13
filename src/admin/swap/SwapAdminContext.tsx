/**
 * Swap-server side of the admin console: its own server URL and its own admin key.
 *
 * The swap server (cross-chain USDC + Solana swaps) is a different process from the mesh server, with a
 * different ADMIN_API_KEY, so these pages work whether or not the mesh server is up or unlocked. The key is
 * kept in this browser only, like the mesh one.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { toast } from 'sonner';
import { KeyRound, ServerOff } from 'lucide-react';
import { CCTP_SWAP_SERVER_URL } from '@/lib/config';
import { useAdmin } from '../AdminContext';
import { createSwapAdminApi, SwapApiError, type Query, type SwapAdminApi } from './swapApi';

const KEY_STORAGE = 'swap-admin-key';
const read = (): string => { try { return localStorage.getItem(KEY_STORAGE) ?? ''; } catch { return ''; } };
const write = (v: string | null) => { try { if (v === null) localStorage.removeItem(KEY_STORAGE); else localStorage.setItem(KEY_STORAGE, v); } catch { /* storage blocked */ } };

interface SwapAdminState { api: SwapAdminApi; serverUrl: string; adminKey: string; setAdminKey: (k: string | null) => void }
const Ctx = createContext<SwapAdminState | null>(null);

export function useSwapAdmin(): SwapAdminState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSwapAdmin outside SwapAdminProvider');
  return v;
}

const k = (...parts: unknown[]) => ['admin', 'swap', ...parts];

/** Polls at the console's cadence (the top-bar control) and keeps the previous data while refetching. */
function usePolled<T>(key: unknown[], fn: () => Promise<T>, factor = 1, enabled = true) {
  const { interval } = useAdmin();
  const { adminKey } = useSwapAdmin();
  return useQuery({ queryKey: key, queryFn: fn, refetchInterval: interval(factor), placeholderData: keepPreviousData, enabled: enabled && !!adminKey, retry: 1 });
}

export function useSwapOverview() { const { api } = useSwapAdmin(); return usePolled(k('overview'), api.overview); }
export function useSwapEvents(q: Query) { const { api } = useSwapAdmin(); return usePolled(k('events', q), () => api.events(q)); }
export function useSwapSettings() { const { api } = useSwapAdmin(); return usePolled(k('settings'), api.settings, 2); }
export function useSwapSystem() { const { api } = useSwapAdmin(); return usePolled(k('system'), api.system, 3); }
export function useTransfers(q: Query) { const { api } = useSwapAdmin(); return usePolled(k('transfers', q), () => api.transfers(q)); }
export function useTransfer(id: string) { const { api } = useSwapAdmin(); return usePolled(k('transfer', id), () => api.transfer(id), 1, !!id); }
export function useSolanaSwaps(q: Query) { const { api } = useSwapAdmin(); return usePolled(k('swaps', q), () => api.swaps(q)); }
export function useSolanaSwap(id: string) { const { api } = useSwapAdmin(); return usePolled(k('swapd', id), () => api.swap(id), 1, !!id); }
export function useLendOverview() { const { api } = useSwapAdmin(); return usePolled(k('lend', 'overview'), api.lendOverview); }
export function useLendLoans(q: Query) { const { api } = useSwapAdmin(); return usePolled(k('lend', 'loans', q), () => api.lendLoans(q)); }
export function useLendLoan(ref: string) { const { api } = useSwapAdmin(); return usePolled(k('lend', 'loan', ref), () => api.lendLoan(ref), 1, !!ref); }
export function useProfits() { const { api } = useSwapAdmin(); return usePolled(k('profits'), () => api.profits(), 2); }
export function useBchSwaps(q: Query = {}) { const { api } = useSwapAdmin(); return usePolled(k('bch-swaps', q), () => api.bchSwaps(q)); }
export function useBchSwap(id: string) { const { api } = useSwapAdmin(); return usePolled(k('bch-swap', id), () => api.bchSwap(id), 1, !!id); }
export function useBchTokens(chain?: string) { const { api } = useSwapAdmin(); return usePolled(k('bch-tokens', chain), () => api.bchTokens(chain), 5); }
export function useBlockedTokens() { const { api } = useSwapAdmin(); return usePolled(k('blocked'), api.blockedTokens, 3); }
export function useTokenBrowser(mode: 'tokens' | 'stocks', q: Query) {
  const { api } = useSwapAdmin();
  return usePolled(k('catalog', mode, q), () => (mode === 'stocks' ? api.stocks(q) : api.tokens(q)), 6);
}

/** An operator action: toast with the outcome, then refetch every swap-server query. */
export function useSwapAction<A, R>(fn: (args: A) => Promise<R>, opts: { success: (r: R, a: A) => string; label: string }) {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: fn,
    onSuccess: (r, a) => { toast.success(opts.success(r, a)); void qc.invalidateQueries({ queryKey: ['admin', 'swap'] }); },
    onError: (e: unknown) => { toast.error(`${opts.label} failed`, { description: e instanceof Error ? e.message : String(e) }); },
  });
  return { ...m, run: (a: A) => m.mutate(a) };
}

function KeyForm({ rejected, unreachable }: { rejected: boolean; unreachable: boolean }) {
  const { api, setAdminKey, serverUrl, adminKey } = useSwapAdmin();
  const [value, setValue] = useState('');
  const [state, setState] = useState<{ checking: boolean; error: string | null }>({ checking: false, error: null });
  const save = async () => {
    setState({ checking: true, error: null });
    try {
      await api.checkKey(value.trim());
      setAdminKey(value.trim());
      setState({ checking: false, error: null });
    } catch (e) {
      const s = e instanceof SwapApiError ? e.status : 0;
      setState({ checking: false, error: s === 401 ? 'The server rejected this key.' : s === 503 ? 'ADMIN_API_KEY is not set on the swap server.' : e instanceof Error ? e.message : String(e) });
    }
  };
  if (unreachable && adminKey) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 sm:p-8 text-center space-y-3 mt-10">
        <div className="mx-auto w-11 h-11 rounded-xl bg-rose-500/10 border border-rose-400/25 flex items-center justify-center"><ServerOff className="w-5 h-5 text-rose-300" aria-hidden /></div>
        <h1 className="text-lg font-heading font-bold text-white">Swap server unreachable</h1>
        <p className="text-sm text-zinc-400 leading-relaxed">Nothing answered at <code className="text-zinc-300">{serverUrl}</code>. Start it with <code className="text-zinc-300">node --import tsx src/index.ts</code> in <code className="text-zinc-300">arc-cctp/cctp-swap-server</code>. This page retries by itself.</p>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 sm:p-8 space-y-4 mt-10">
      <div className="text-center space-y-3">
        <div className="mx-auto w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-400/25 flex items-center justify-center"><KeyRound className="w-5 h-5 text-amber-300" aria-hidden /></div>
        <h1 className="text-lg font-heading font-bold text-white">{rejected ? 'The swap server rejected this key' : 'Swap server key needed'}</h1>
        <p className="text-sm text-zinc-400 leading-relaxed">
          Cross-chain USDC and Solana swaps run on their own server (<code className="text-zinc-300">{serverUrl.replace(/^https?:\/\//, '')}</code>) with their own key: <code className="text-zinc-300">ADMIN_API_KEY</code> in its <code className="text-zinc-300">.env</code>. It stays in this browser.
        </p>
      </div>
      <form onSubmit={e => { e.preventDefault(); void save(); }} className="space-y-2">
        <label htmlFor="swap-admin-key" className="text-xs font-medium text-zinc-300">Swap server ADMIN_API_KEY</label>
        <input id="swap-admin-key" type="password" autoComplete="off" value={value} onChange={e => setValue(e.target.value)}
          className="w-full h-9 px-3 rounded-lg bg-white/[0.03] border border-white/10 text-sm text-white font-mono focus:outline-none focus:border-emerald-400/50" />
        {state.error && <p role="alert" className="text-xs text-rose-300">{state.error}</p>}
        <button type="submit" disabled={!value.trim() || state.checking}
          className="w-full h-9 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40">
          {state.checking ? 'Checking…' : 'Verify and save'}
        </button>
      </form>
    </div>
  );
}

/** Shows the pages only once the swap server answers with a valid key. */
function Gate({ children }: { children: ReactNode }) {
  const { adminKey } = useSwapAdmin();
  const o = useSwapOverview();
  const status = o.error instanceof SwapApiError ? o.error.status : null;
  const rejected = status === 401;
  const unreachable = status === 0 && !o.data;
  if (!adminKey || rejected || unreachable) return <KeyForm rejected={rejected} unreachable={unreachable} />;
  return <>{children}</>;
}

export function SwapAdminProvider({ children }: { children: ReactNode }) {
  const [stored, setStored] = useState<string>(read);
  const api = useMemo(() => createSwapAdminApi(CCTP_SWAP_SERVER_URL, () => stored), [stored]);
  const setAdminKey = useCallback((key: string | null) => { write(key); setStored(key ?? ''); }, []);
  return (
    <Ctx.Provider value={{ api, serverUrl: CCTP_SWAP_SERVER_URL, adminKey: stored, setAdminKey }}>
      <Gate>{children}</Gate>
    </Ctx.Provider>
  );
}
