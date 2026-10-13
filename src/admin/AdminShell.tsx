/**
 * Admin console layout: a sticky sidebar grouped by job (monitor, trading,
 * liquidity, operations), a top bar with the server's network, chain clock,
 * polling control and admin-key status, and the page outlet.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, Outlet, Link, useLocation } from 'react-router-dom';
import { useIsFetching } from '@tanstack/react-query';
import {
  LayoutDashboard, Activity, ArrowDownUp, Zap, Repeat, Users, Waves, Layers, UserCircle, Recycle, SlidersHorizontal,
  Undo2, Server, KeyRound, Pause, Play, Menu, X, ShieldCheck, ShieldAlert, History, ArrowLeft, RefreshCw, Scale, ArrowLeftRight, Radar, Wallet, Settings2,
  Globe, Fuel, Coins, LineChart, ScrollText, PiggyBank, Landmark,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { AdminProvider, useAdmin, POLL_OPTIONS } from './AdminContext';
import { AssetProvider } from './assets';
import { useOverview } from './hooks';
import { ago, useNow } from './kit';
import { AdminApiError } from './api';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface NavItem { to: string; label: string; icon: typeof Activity; end?: boolean; badge?: (o: NonNullable<ReturnType<typeof useOverview>['data']>) => { n: number; tone: 'amber' | 'rose' | 'zinc' } | null }

const NAV: Array<{ group: string; items: NavItem[] }> = [
  {
    group: 'Monitor', items: [
      { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true, badge: o => (o.alerts.length ? { n: o.alerts.length, tone: o.alerts.some(a => a.severity === 'error') ? 'rose' : 'amber' } : null) },
      { to: '/admin/events', label: 'Events', icon: Activity, badge: o => (o.events.h24.bySeverity.error ? { n: o.events.h24.bySeverity.error, tone: 'rose' } : null) },
    ],
  },
  {
    group: 'Trading', items: [
      { to: '/admin/intents', label: 'Intents', icon: ArrowDownUp, badge: o => { const p = o.intents.problems.failing + o.intents.problems.refund_failed; return p ? { n: p, tone: 'rose' } : o.intents.open ? { n: o.intents.open, tone: 'zinc' } : null; } },
      { to: '/admin/fills', label: 'Fills', icon: Zap },
      { to: '/admin/twap', label: 'TWAP orders', icon: Repeat, badge: o => (o.twap.byStatus.RUNNING ? { n: o.twap.byStatus.RUNNING, tone: 'zinc' } : null) },
      { to: '/admin/traders', label: 'Traders', icon: Users },
    ],
  },
  {
    group: 'Liquidity', items: [
      { to: '/admin/pools', label: 'Pools', icon: Waves, badge: o => (o.pools.exhausted ? { n: o.pools.exhausted, tone: 'amber' } : null) },
      { to: '/admin/strategies', label: 'Strategies', icon: Layers },
      { to: '/admin/lps', label: 'LPs', icon: UserCircle },
      { to: '/admin/idle', label: 'Idle & recycle', icon: Recycle },
    ],
  },
  {
    group: 'Operations', items: [
      { to: '/admin/operations', label: 'Routing & solver', icon: SlidersHorizontal, badge: o => { const off = [o.routes.meshEnabled, o.routes.cauldronEnabled, o.routes.solverEnabled].filter(x => !x).length; return off ? { n: off, tone: 'amber' } : !o.solver.ready ? { n: 1, tone: 'rose' } : null; } },
      { to: '/admin/refunds', label: 'Refunds', icon: Undo2, badge: o => (o.intents.refundableNow ? { n: o.intents.refundableNow, tone: 'amber' } : null) },
      { to: '/admin/system', label: 'System', icon: Server },
      { to: '/admin/legacy', label: 'Legacy admin', icon: History },
    ],
  },
  {
    group: 'Balancer bot', items: [
      { to: '/admin/balancer', label: 'Bot overview', icon: Scale, end: true, badge: o => (!o.balancer?.seen ? null : !o.balancer.online && o.balancer.enabled ? { n: 1, tone: 'rose' } : o.balancer.state === 'error' ? { n: 1, tone: 'rose' } : !o.balancer.enabled ? { n: 1, tone: 'amber' } : null) },
      { to: '/admin/balancer/trades', label: 'Trades', icon: ArrowLeftRight, badge: o => (o.balancer?.trades24h ? { n: o.balancer.trades24h, tone: 'zinc' } : null) },
      { to: '/admin/balancer/opportunities', label: 'Opportunities', icon: Radar },
      { to: '/admin/balancer/wallet', label: 'Wallet', icon: Wallet },
      { to: '/admin/balancer/settings', label: 'Settings', icon: Settings2 },
    ],
  },
  // cctp-swap-server: a separate server with its own admin key (see ./swap)
  {
    group: 'Swap server', items: [
      { to: '/admin/swap', label: 'Overview', icon: Globe, end: true },
      { to: '/admin/swap/profits', label: 'Profits & treasury', icon: PiggyBank },
      { to: '/admin/swap/events', label: 'Events', icon: ScrollText },
      { to: '/admin/swap/settings', label: 'Settings', icon: Settings2 },
    ],
  },
  {
    group: 'Cross-chain USDC', items: [
      { to: '/admin/swap/cctp', label: 'Transfers', icon: ArrowLeftRight, end: true },
      { to: '/admin/swap/cctp/chains', label: 'Chains & relayer', icon: Fuel },
    ],
  },
  {
    group: 'Bitcoin Cash', items: [
      { to: '/admin/swap/bch', label: 'BCH Swaps', icon: ArrowLeftRight, end: true },
      { to: '/admin/swap/bch/tokens', label: '1Click Tokens', icon: Coins },
      { to: '/admin/swap/bch/chains', label: 'Cross-Chain Matrix', icon: Globe },
    ],
  },
  {
    group: 'Solana swaps', items: [
      { to: '/admin/swap/solana', label: 'Swaps', icon: Coins, end: true },
      { to: '/admin/swap/solana/tokens', label: 'Tokens & stocks', icon: LineChart },
    ],
  },
  {
    group: 'Lending', items: [
      { to: '/admin/swap/lend', label: 'Overview', icon: Landmark, end: true },
      { to: '/admin/swap/lend/loans', label: 'Loans', icon: Coins },
    ],
  },
];

const BADGE_TONE = { amber: 'bg-amber-500/15 text-amber-300', rose: 'bg-rose-500/15 text-rose-300', zinc: 'bg-white/[0.06] text-zinc-400' };

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { data } = useOverview();
  return (
    <nav aria-label="Admin" className="flex flex-col gap-5 p-3">
      <Link to="/admin" onClick={onNavigate} className="flex items-center gap-2.5 px-2 pt-1">
        <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center">
          <ShieldCheck className="w-4 h-4 text-emerald-300" aria-hidden />
        </div>
        <div>
          <div className="text-sm font-heading font-bold text-white leading-none">Mesh Control</div>
          <div className="text-[10px] text-zinc-500 mt-1">Admin console</div>
        </div>
      </Link>
      {NAV.map(g => (
        <div key={g.group}>
          <div className="px-2 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-600">{g.group}</div>
          <ul className="space-y-0.5">
            {g.items.map(it => {
              const b = data && it.badge ? it.badge(data) : null;
              const Icon = it.icon;
              return (
                <li key={it.to}>
                  <NavLink to={it.to} end={it.end} onClick={onNavigate}
                    className={({ isActive }) => cn(
                      'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] transition-colors duration-150',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50',
                      isActive ? 'bg-emerald-500/10 text-emerald-200 font-medium' : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.04]',
                    )}>
                    <Icon className="w-4 h-4 shrink-0" aria-hidden />
                    <span className="flex-1 truncate">{it.label}</span>
                    {b && <span className={cn('min-w-[20px] text-center px-1.5 py-px rounded text-[10px] font-semibold tabular-nums', BADGE_TONE[b.tone])}>{b.n}</span>}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <Link to="/" onClick={onNavigate} className="mt-auto flex items-center gap-2 px-2.5 py-2 text-xs text-zinc-500 hover:text-zinc-200">
        <ArrowLeft className="w-3.5 h-3.5" aria-hidden /> Back to app
      </Link>
    </nav>
  );
}

function PollControl() {
  const { pollMs, setPollMs, paused, setPaused } = useAdmin();
  const fetching = useIsFetching({ queryKey: ['admin'] });
  const qc = useQueryClient();
  return (
    <div className="flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.02] p-0.5">
      <button type="button" onClick={() => setPaused(!paused)} aria-label={paused ? 'Resume polling' : 'Pause polling'} title={paused ? 'Resume polling' : 'Pause polling'}
        className={cn('p-1.5 rounded-md', paused ? 'text-amber-300 bg-amber-500/10' : 'text-zinc-300 hover:bg-white/5')}>
        {paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
      </button>
      <label className="sr-only" htmlFor="admin-poll">Refresh interval</label>
      <select id="admin-poll" value={pollMs} onChange={e => setPollMs(Number(e.target.value))} disabled={paused}
        className="bg-transparent text-xs text-zinc-300 pr-1 focus:outline-none disabled:opacity-40">
        {POLL_OPTIONS.map(o => <option key={o.ms} value={o.ms} className="bg-zinc-900">{o.label}</option>)}
      </select>
      <button type="button" onClick={() => void qc.invalidateQueries({ queryKey: ['admin'] })} aria-label="Refresh now" title="Refresh now"
        className="p-1.5 rounded-md text-zinc-300 hover:bg-white/5">
        <RefreshCw className={cn('w-3.5 h-3.5', fetching > 0 && 'animate-spin text-emerald-300')} />
      </button>
    </div>
  );
}

function KeyDialog() {
  const { keyDialogOpen, openKeyDialog, setAdminKey, api, keySource } = useAdmin();
  const [value, setValue] = useState('');
  const [state, setState] = useState<{ checking: boolean; error: string | null }>({ checking: false, error: null });
  const save = async () => {
    setState({ checking: true, error: null });
    try {
      await api.checkKey(value.trim());
      setAdminKey(value.trim());
      setValue('');
      setState({ checking: false, error: null });
      openKeyDialog(false);
    } catch (e) {
      const s = e instanceof AdminApiError ? e.status : 0;
      setState({ checking: false, error: s === 401 ? 'The server rejected this key.' : s === 503 ? 'ADMIN_API_KEY is not configured on the server.' : e instanceof Error ? e.message : String(e) });
    }
  };
  return (
    <Dialog open={keyDialogOpen} onOpenChange={o => openKeyDialog(o)}>
      <DialogContent className="bg-[#0b0d12] border-white/10 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white font-heading flex items-center gap-2"><KeyRound className="w-4 h-4 text-emerald-300" />Admin key</DialogTitle>
          <DialogDescription className="text-zinc-400 text-sm">
            The console sends this key as <code className="text-zinc-300">x-admin-key</code> with every request, to read as well as to act. It is checked against the server and kept only in this browser.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={e => { e.preventDefault(); void save(); }} className="space-y-2">
          <label htmlFor="admin-key" className="text-xs font-medium text-zinc-300">ADMIN_API_KEY</label>
          <input id="admin-key" type="password" autoComplete="off" value={value} onChange={e => setValue(e.target.value)}
            className="w-full h-9 px-3 rounded-lg bg-white/[0.03] border border-white/10 text-sm text-white font-mono focus:outline-none focus:border-emerald-400/50" />
          {state.error && <p role="alert" className="text-xs text-rose-300">{state.error}</p>}
          {keySource !== 'none' && <p className="text-[11px] text-zinc-500">A key is saved in this browser.</p>}
        </form>
        <DialogFooter className="gap-2">
          {keySource === 'stored' && (
            <button type="button" onClick={() => { setAdminKey(null); openKeyDialog(false); }} className="h-9 px-3 rounded-lg text-xs font-semibold text-rose-300 border border-rose-400/25 hover:bg-rose-500/10">Forget key</button>
          )}
          <button type="button" onClick={() => void save()} disabled={!value.trim() || state.checking}
            className="h-9 px-4 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40">
            {state.checking ? 'Checking…' : 'Verify and save'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TopBar({ onMenu }: { onMenu: () => void }) {
  const { data, dataUpdatedAt, error } = useOverview();
  const { keySource, openKeyDialog, serverUrl } = useAdmin();
  const now = useNow(1000);
  const lag = data?.chain.lagSec ?? 0;
  return (
    <header className="sticky top-0 z-30 flex items-center gap-2 sm:gap-3 h-14 px-3 sm:px-5 border-b border-white/[0.06] bg-[#07080b]/90 backdrop-blur">
      <button type="button" onClick={onMenu} className="lg:hidden p-2 -ml-1 rounded-lg text-zinc-300 hover:bg-white/5" aria-label="Open navigation"><Menu className="w-5 h-5" /></button>
      <div className="flex items-center gap-2 min-w-0">
        <span className={cn('inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-[11px] font-semibold uppercase tracking-wide',
          error ? 'border-rose-400/30 bg-rose-500/10 text-rose-300' : data?.network === 'mainnet' ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300' : 'border-sky-400/30 bg-sky-500/10 text-sky-300')}>
          <span className={cn('w-1.5 h-1.5 rounded-full', error ? 'bg-rose-400' : 'bg-current animate-pulse')} aria-hidden />
          {error ? (error instanceof AdminApiError && error.status === 404 ? 'Server needs restart' : error instanceof AdminApiError && error.status === 401 ? 'Key rejected' : 'Server unreachable') : data?.network ?? (keySource === 'none' ? 'locked' : '…')}
        </span>
        <span className="hidden md:inline text-[11px] text-zinc-500 font-mono truncate" title={serverUrl}>{serverUrl.replace(/^https?:\/\//, '')}</span>
      </div>
      {data && (
        <div className="hidden md:flex items-center gap-3 text-[11px] text-zinc-500">
          <span title="Chain median-time-past (covenant time)">MTP <span className="font-mono text-zinc-300 tabular-nums">{new Date(data.chain.mtp * 1000).toLocaleTimeString()}</span></span>
          <span className={cn(lag > 3600 && 'text-amber-300')} title="How far covenant time lags the wall clock">lag <span className="font-mono tabular-nums">{Math.round(lag / 60)}m</span></span>
          <span>up <span className="font-mono tabular-nums text-zinc-300">{Math.floor(data.uptimeSec / 3600)}h</span></span>
        </div>
      )}
      <div className="ml-auto flex items-center gap-2">
        {dataUpdatedAt > 0 && <span className="hidden sm:inline text-[11px] text-zinc-500 tabular-nums" aria-live="polite">updated {ago(Math.floor(dataUpdatedAt / 1000), now)}</span>}
        <PollControl />
        <button type="button" onClick={() => openKeyDialog()}
          className={cn('inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border text-xs font-semibold',
            keySource === 'none' ? 'border-amber-400/30 bg-amber-500/10 text-amber-200' : 'border-emerald-400/25 bg-emerald-500/10 text-emerald-200')}>
          {keySource === 'none' ? <ShieldAlert className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">{keySource === 'none' ? 'Enter key' : 'Admin'}</span>
        </button>
      </div>
    </header>
  );
}

function Locked({ rejected }: { rejected: boolean }) {
  const { openKeyDialog } = useAdmin();
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 sm:p-8 text-center space-y-4 mt-10">
      <div className="mx-auto w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-400/25 flex items-center justify-center"><KeyRound className="w-5 h-5 text-amber-300" aria-hidden /></div>
      <h1 className="text-lg font-heading font-bold text-white">{rejected ? 'The server rejected this key' : 'Admin key needed'}</h1>
      <p className="text-sm text-zinc-400 leading-relaxed">
        {rejected ? 'The key saved in this browser no longer matches the server. Enter the current one.' : 'The admin console reads wallets, orders, LPs and settings, so the server answers only with the admin key.'} It stays in this browser.
      </p>
      <button type="button" onClick={() => openKeyDialog()} className="h-9 px-4 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white">Enter admin key</button>
    </div>
  );
}

function Frame({ children }: { children: ReactNode }) {
  const [menu, setMenu] = useState(false);
  const loc = useLocation();
  const { data, error } = useOverview();
  const { adminKey } = useAdmin();
  // the server shows nothing without a valid key: ask for it in place of the pages
  const rejected = error instanceof AdminApiError && error.status === 401;
  // the swap-server pages talk to another server with its own key; they carry their own gate
  const swapArea = loc.pathname.startsWith('/admin/swap');
  const locked = !swapArea && (!adminKey || rejected);
  useEffect(() => setMenu(false), [loc.pathname]);
  return (
    <AssetProvider network={data?.network ?? 'chipnet'}>
      <div className="min-h-screen bg-[#07080b] text-zinc-200 font-sans">
        <aside className="hidden lg:flex fixed inset-y-0 left-0 w-60 border-r border-white/[0.06] bg-[#090a0e] overflow-y-auto">
          <Sidebar />
        </aside>
        {menu && (
          <div className="lg:hidden fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/70" onClick={() => setMenu(false)} aria-hidden />
            <aside className="absolute inset-y-0 left-0 w-64 bg-[#090a0e] border-r border-white/[0.08] overflow-y-auto">
              <button type="button" onClick={() => setMenu(false)} className="absolute top-3 right-3 p-1.5 rounded-lg text-zinc-400 hover:bg-white/5" aria-label="Close navigation"><X className="w-4 h-4" /></button>
              <Sidebar onNavigate={() => setMenu(false)} />
            </aside>
          </div>
        )}
        <div className="lg:pl-60 min-w-0">
          <TopBar onMenu={() => setMenu(true)} />
          <main className="px-3 sm:px-5 lg:px-8 py-5 sm:py-6 max-w-[1500px] mx-auto space-y-5">{locked ? <Locked rejected={rejected} /> : children}</main>
        </div>
        <KeyDialog />
      </div>
    </AssetProvider>
  );
}

export function AdminShell() {
  return (
    <AdminProvider>
      <Frame><Outlet /></Frame>
    </AdminProvider>
  );
}
