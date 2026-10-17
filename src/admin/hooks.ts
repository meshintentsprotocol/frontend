/**
 * React-query hooks for the admin console. Every read polls at the console's
 * cadence (AdminContext) and keeps the previous data while refetching, so
 * tables never blank out. Heavier reads poll at a multiple of the cadence.
 */
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAdmin } from './AdminContext';
import { AdminApiError, type Query } from './api';

const k = (...parts: unknown[]) => ['admin', ...parts];

function usePolled<T>(key: unknown[], fn: () => Promise<T>, factor = 1, enabled = true) {
  const { interval, adminKey } = useAdmin();
  // the server answers nothing without the key: do not ask until there is one
  return useQuery({ queryKey: key, queryFn: fn, refetchInterval: interval(factor), placeholderData: keepPreviousData, enabled: enabled && !!adminKey, retry: 1 });
}

export function useOverview() { const { api } = useAdmin(); return usePolled(k('overview'), api.overview); }
export function useEvents(q: Query) { const { api } = useAdmin(); return usePolled(k('events', q), () => api.events(q)); }
export function useIntents(q: Query) { const { api } = useAdmin(); return usePolled(k('intents', q), () => api.intents(q)); }
export function useIntent(id: string) { const { api } = useAdmin(); return usePolled(k('intent', id), () => api.intent(id), 1, !!id); }
export function useFills(q: Query) { const { api } = useAdmin(); return usePolled(k('fills', q), () => api.fills(q)); }
export function useTraders() { const { api } = useAdmin(); return usePolled(k('traders'), () => api.traders({ limit: 500 }), 3); }
export function usePools(q: Query) { const { api } = useAdmin(); return usePolled(k('pools', q), () => api.pools(q), 2); }
export function useLps() { const { api } = useAdmin(); return usePolled(k('lps'), api.lps, 3); }
export function useLp(owner: string) { const { api } = useAdmin(); return usePolled(k('lp', owner), () => api.lp(owner), 2, !!owner); }
export function useStrategies(q: Query) { const { api } = useAdmin(); return usePolled(k('strategies', q), () => api.strategies(q), 2); }
export function useStrategy(id: string) { const { api } = useAdmin(); return usePolled(k('strategy', id), () => api.strategy(id), 2, !!id); }
export function useIdle() { const { api } = useAdmin(); return usePolled(k('idle'), api.idle, 3); }
export function useTwaps(q: Query) { const { api } = useAdmin(); return usePolled(k('twaps', q), () => api.twaps(q)); }
export function useTwap(id: string) { const { api } = useAdmin(); return usePolled(k('twap', id), () => api.twap(id), 1, !!id); }
export function useMarket(hours = 24) { const { api } = useAdmin(); return usePolled(k('market', hours), () => api.market(hours), 3); }
export function useLiquidity() { const { api } = useAdmin(); return usePolled(k('liquidity'), () => api.liquidity(), 3); }
export function useV4Positions() { const { api } = useAdmin(); return usePolled(k('v4-positions'), () => api.v4Positions(), 2); }
export function useV4Health() { const { api } = useAdmin(); return usePolled(k('v4-health'), () => api.v4Health(), 2); }
export function useV4Migration() { const { api } = useAdmin(); return usePolled(k('v4-migration'), () => api.v4Migration(), 3); }
export function useSystem() { const { api } = useAdmin(); return usePolled(k('system'), api.system, 3); }
export function useBalancer() { const { api } = useAdmin(); return usePolled(k('balancer'), api.balancer); }
export function useBalancerTrades(q: Query) { const { api } = useAdmin(); return usePolled(k('balancer-trades', q), () => api.balancerTrades(q)); }
export function useBalancerTrade(id: string) { const { api } = useAdmin(); return usePolled(k('balancer-trade', id), () => api.balancerTrade(id), 1, !!id); }
export function useBalancerOpportunities(q: Query) { const { api } = useAdmin(); return usePolled(k('balancer-opps', q), () => api.balancerOpportunities(q)); }
export function useBalancerWallet() { const { api } = useAdmin(); return usePolled(k('balancer-wallet'), api.balancerWallet); }
export function useBalancerConfig() { const { api } = useAdmin(); return usePolled(k('balancer-config'), api.balancerConfig, 2); }
export function useRefunds() { const { api } = useAdmin(); return usePolled(k('refunds'), api.refunds); }

/**
 * A console action: requires the admin key, shows a toast with the outcome and
 * refetches every admin query so the new state shows at once.
 */
export function useAdminAction<A, R>(fn: (args: A) => Promise<R>, opts: { success: (r: R, a: A) => string; label: string }) {
  const { adminKey, openKeyDialog } = useAdmin();
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: fn,
    onSuccess: (r, a) => {
      toast.success(opts.success(r, a));
      void qc.invalidateQueries({ queryKey: ['admin'] });
    },
    onError: (e: unknown) => {
      const status = e instanceof AdminApiError ? e.status : 0;
      if (status === 401 || status === 503) openKeyDialog();
      toast.error(`${opts.label} failed`, { description: e instanceof Error ? e.message : String(e) });
    },
  });
  return {
    ...m,
    /** Runs the action, or asks for the admin key first. */
    run: (a: A) => (adminKey ? m.mutate(a) : openKeyDialog()),
    needsKey: !adminKey,
  };
}
