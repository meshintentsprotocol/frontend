/**
 * Admin console building blocks: dark, data-dense DeFi surfaces with hairline
 * borders, numbers in JetBrains Mono, status always as text + colour.
 *
 * Tones: emerald = healthy / filled, sky = in progress, amber = attention,
 * rose = failure, violet = TWAP / recycle, zinc = closed / neutral.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle, CheckCircle2, Info, XCircle, Copy, Check, ExternalLink, Loader2, Search, ChevronLeft, ChevronRight,
  Inbox, ArrowDownUp, Zap, Waves, Boxes, Recycle, Clock, Route, Server, Layers, Repeat, Undo2, Scale,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { explorerAddress, explorerTx, shortHex } from '@/lib/mesh/format';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { AdminApiError, type EventCategory, type EventRef, type FillMethod, type IntentKind, type Severity } from './api';
import { useOverview } from './hooks';

// ── Tones ────────────────────────────────────────────────────────────────────

export type Tone = 'emerald' | 'sky' | 'amber' | 'rose' | 'violet' | 'cyan' | 'zinc';
const TONE: Record<Tone, { pill: string; dot: string; text: string }> = {
  emerald: { pill: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25', dot: 'bg-emerald-400', text: 'text-emerald-300' },
  sky: { pill: 'bg-sky-500/10 text-sky-300 border-sky-500/25', dot: 'bg-sky-400', text: 'text-sky-300' },
  amber: { pill: 'bg-amber-500/10 text-amber-300 border-amber-500/25', dot: 'bg-amber-400', text: 'text-amber-300' },
  rose: { pill: 'bg-rose-500/10 text-rose-300 border-rose-500/25', dot: 'bg-rose-400', text: 'text-rose-300' },
  violet: { pill: 'bg-violet-500/10 text-violet-300 border-violet-500/25', dot: 'bg-violet-400', text: 'text-violet-300' },
  cyan: { pill: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/25', dot: 'bg-cyan-400', text: 'text-cyan-300' },
  zinc: { pill: 'bg-zinc-500/10 text-zinc-300 border-zinc-500/20', dot: 'bg-zinc-500', text: 'text-zinc-400' },
};
export const toneText = (t: Tone) => TONE[t].text;

export function Pill({ tone = 'zinc', dot, children, className, title }: { tone?: Tone; dot?: boolean; children: ReactNode; className?: string; title?: string }) {
  return (
    <span title={title} className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] font-semibold whitespace-nowrap', TONE[tone].pill, className)}>
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full', TONE[tone].dot)} aria-hidden />}
      {children}
    </span>
  );
}

// ── Domain badges ────────────────────────────────────────────────────────────

const INTENT_STATUS: Record<string, { tone: Tone; label: string }> = {
  awaiting_funding: { tone: 'zinc', label: 'Awaiting funding' },
  scheduled: { tone: 'sky', label: 'Scheduled' },
  active: { tone: 'sky', label: 'Active' },
  underfunded: { tone: 'amber', label: 'Underfunded' },
  expired: { tone: 'amber', label: 'Expired · refund due' },
  expired_unfunded: { tone: 'zinc', label: 'Expired unfunded' },
  refund_pending: { tone: 'amber', label: 'Refund pending' },
  filled: { tone: 'emerald', label: 'Filled' },
  refunded: { tone: 'violet', label: 'Refunded' },
  cancelled: { tone: 'zinc', label: 'Cancelled' },
  closed_external: { tone: 'rose', label: 'Spent externally' },
};
export const intentStatusLabel = (s: string) => INTENT_STATUS[s]?.label ?? s;
export function IntentStatusBadge({ status }: { status: string }) {
  const s = INTENT_STATUS[status] ?? { tone: 'zinc' as Tone, label: status };
  return <Pill tone={s.tone} dot>{s.label}</Pill>;
}

const KIND: Record<IntentKind, { tone: Tone; label: string }> = {
  limit: { tone: 'cyan', label: 'Limit' }, dutch: { tone: 'sky', label: 'Dutch' }, twap: { tone: 'violet', label: 'TWAP' },
};
export function KindBadge({ kind, slice }: { kind: IntentKind; slice?: number }) {
  const k = KIND[kind] ?? { tone: 'zinc' as Tone, label: kind };
  return <Pill tone={k.tone}>{k.label}{slice !== undefined ? ` #${slice + 1}` : ''}</Pill>;
}

export const METHOD_META: Record<FillMethod, { tone: Tone; label: string; color: string }> = {
  MESH_POOL: { tone: 'emerald', label: 'Mesh', color: '#34d399' },
  CAULDRON: { tone: 'sky', label: 'Cauldron', color: '#38bdf8' },
  SOLVER_INVENTORY: { tone: 'amber', label: 'Solver', color: '#fbbf24' },
  SPLIT: { tone: 'violet', label: 'Split', color: '#a78bfa' },
};
export function MethodBadge({ method }: { method?: string | null }) {
  if (!method) return <span className="text-zinc-600 text-xs">—</span>;
  const m = METHOD_META[method as FillMethod] ?? { tone: 'zinc' as Tone, label: method };
  return <Pill tone={m.tone}>{m.label}</Pill>;
}

const VENUE: Record<string, { tone: Tone; label: string; icon: typeof Waves }> = {
  mesh: { tone: 'emerald', label: 'Mesh pool', icon: Waves },
  cauldron: { tone: 'sky', label: 'Cauldron', icon: Boxes },
  solver: { tone: 'amber', label: 'Solver inventory', icon: Zap },
};
export function VenueBadge({ venue }: { venue: string }) {
  const v = VENUE[venue] ?? { tone: 'zinc' as Tone, label: venue, icon: Layers };
  const Icon = v.icon;
  return <Pill tone={v.tone}><Icon className="w-3 h-3" aria-hidden />{v.label}</Pill>;
}

export const SEVERITY: Record<Severity, { tone: Tone; icon: typeof Info; label: string }> = {
  info: { tone: 'sky', icon: Info, label: 'Info' },
  success: { tone: 'emerald', icon: CheckCircle2, label: 'Success' },
  warn: { tone: 'amber', icon: AlertTriangle, label: 'Warning' },
  error: { tone: 'rose', icon: XCircle, label: 'Error' },
};
export function SeverityIcon({ severity, className }: { severity: Severity; className?: string }) {
  const s = SEVERITY[severity] ?? SEVERITY.info;
  const Icon = s.icon;
  return <Icon className={cn('w-4 h-4 shrink-0', TONE[s.tone].text, className)} aria-label={s.label} />;
}

export const CATEGORY: Record<EventCategory, { label: string; icon: typeof Info; tone: Tone; color: string }> = {
  intent: { label: 'Intents', icon: ArrowDownUp, tone: 'cyan', color: '#22d3ee' },
  fill: { label: 'Fills', icon: Zap, tone: 'emerald', color: '#34d399' },
  refund: { label: 'Refunds', icon: Undo2, tone: 'amber', color: '#fbbf24' },
  pool: { label: 'Pools', icon: Waves, tone: 'sky', color: '#38bdf8' },
  strategy: { label: 'Strategies', icon: Layers, tone: 'emerald', color: '#10b981' },
  recycle: { label: 'Recycle', icon: Recycle, tone: 'violet', color: '#a78bfa' },
  twap: { label: 'TWAP', icon: Repeat, tone: 'violet', color: '#c084fc' },
  route: { label: 'Routing', icon: Route, tone: 'amber', color: '#f59e0b' },
  balancer: { label: 'Balancer', icon: Scale, tone: 'cyan', color: '#2dd4bf' },
  system: { label: 'System', icon: Server, tone: 'zinc', color: '#a1a1aa' },
};
export function CategoryIcon({ category, className }: { category: EventCategory; className?: string }) {
  const c = CATEGORY[category] ?? CATEGORY.system;
  const Icon = c.icon;
  return <Icon className={cn('w-4 h-4 shrink-0', TONE[c.tone].text, className)} aria-label={c.label} />;
}

// ── Surfaces ─────────────────────────────────────────────────────────────────

export function Section({ title, icon, description, actions, children, className, bodyClassName }: {
  title?: ReactNode; icon?: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string;
}) {
  return (
    <section className={cn(
      'relative rounded-2xl border border-white/[0.07] bg-[#0b0d12] overflow-hidden',
      'before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-emerald-400/30 before:to-transparent',
      className,
    )}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 px-4 sm:px-5 pt-4">
          <div className="min-w-0">
            {title && <h2 className="flex items-center gap-2 text-sm font-heading font-semibold text-white tracking-tight">{icon}{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-zinc-500 leading-relaxed">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn('p-4 sm:p-5', title || actions ? 'pt-3' : '', bodyClassName)}>{children}</div>
    </section>
  );
}

export function KpiTile({ label, value, sub, icon, tone, to, className, loading }: {
  label: string; value: ReactNode; sub?: ReactNode; icon?: ReactNode; tone?: Tone; to?: string; className?: string; loading?: boolean;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">{label}</span>
        {icon && <span className={cn('opacity-80', tone ? TONE[tone].text : 'text-zinc-500')}>{icon}</span>}
      </div>
      {loading
        ? <div className="mt-2 h-6 w-24 rounded bg-white/[0.05] animate-pulse" />
        : <div className={cn('mt-1.5 text-xl font-semibold font-mono tabular-nums truncate', tone ? TONE[tone].text : 'text-white')}>{value}</div>}
      {sub !== undefined && <div className="mt-1 text-[11px] text-zinc-500 truncate">{sub}</div>}
    </>
  );
  const cls = cn('block min-w-0 rounded-xl border border-white/[0.07] bg-white/[0.015] p-3.5', className);
  return to
    ? <Link to={to} className={cn(cls, 'transition-colors duration-200 hover:border-emerald-400/30 hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50')}>{body}</Link>
    : <div className={cls}>{body}</div>;
}

export function KeyValue({ rows, className }: { rows: Array<[ReactNode, ReactNode] | null | false>; className?: string }) {
  return (
    <dl className={cn('grid grid-cols-[minmax(110px,auto)_1fr] gap-x-4 gap-y-2 text-xs', className)}>
      {rows.filter(Boolean).map((r, i) => {
        const [k, v] = r as [ReactNode, ReactNode];
        return (
          <div key={i} className="contents">
            <dt className="text-zinc-500">{k}</dt>
            <dd className="text-zinc-200 min-w-0 break-words">{v}</dd>
          </div>
        );
      })}
    </dl>
  );
}

export function PageHeader({ title, description, icon, actions, crumbs }: {
  title: ReactNode; description?: ReactNode; icon?: ReactNode; actions?: ReactNode; crumbs?: Array<{ label: string; to?: string }>;
}) {
  return (
    <div className="space-y-2">
      {crumbs && crumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-[11px] text-zinc-500">
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="w-3 h-3" aria-hidden />}
              {c.to ? <Link to={c.to} className="hover:text-zinc-200">{c.label}</Link> : <span className="text-zinc-400">{c.label}</span>}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2.5 text-xl sm:text-2xl font-heading font-bold text-white tracking-tight">{icon}{title}</h1>
          {description && <p className="mt-1 text-sm text-zinc-500 max-w-3xl">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

// ── Identifiers & links ──────────────────────────────────────────────────────

export function CopyButton({ value, className }: { value: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" aria-label="Copy" title="Copy"
      onClick={e => { e.stopPropagation(); void navigator.clipboard?.writeText(value).then(() => { setDone(true); setTimeout(() => setDone(false), 1200); }); }}
      className={cn('p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-400/60', className)}>
      {done ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

function useNetwork(): 'chipnet' | 'mainnet' {
  return useOverview().data?.network ?? 'chipnet';
}

/** A shortened id with copy, optionally linking inside the console or out to the explorer. */
export function Hash({ value, to, href, head = 8, tail = 6, className, copy = true }: {
  value?: string | null; to?: string; href?: string; head?: number; tail?: number; className?: string; copy?: boolean;
}) {
  if (!value) return <span className="text-zinc-600 text-xs">—</span>;
  const text = shortHex(value, head, tail);
  const cls = cn('font-mono text-xs text-zinc-300', className);
  return (
    <span className="inline-flex items-center gap-0.5 min-w-0" title={value}>
      {to ? <Link to={to} onClick={e => e.stopPropagation()} className={cn(cls, 'hover:text-emerald-300 hover:underline underline-offset-2')}>{text}</Link>
        : href ? <a href={href} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className={cn(cls, 'hover:text-sky-300 inline-flex items-center gap-1')}>{text}<ExternalLink className="w-3 h-3 opacity-60" aria-hidden /></a>
          : <span className={cls}>{text}</span>}
      {copy && <CopyButton value={value} />}
    </span>
  );
}

export function TxLink({ txid, className }: { txid?: string | null; className?: string }) {
  const network = useNetwork();
  return <Hash value={txid} href={txid ? explorerTx(network, txid) : undefined} className={className} />;
}

export function AddressLink({ address, to, className }: { address?: string | null; to?: string; className?: string }) {
  const network = useNetwork();
  if (!address) return <span className="text-zinc-600 text-xs">—</span>;
  return to ? <Hash value={address} to={to} className={className} /> : <Hash value={address} href={explorerAddress(network, address)} className={className} />;
}

export const adminUrl = {
  intent: (id: string) => `/admin/intents/${encodeURIComponent(id)}`,
  pool: (a: string) => `/admin/pools/${encodeURIComponent(a)}`,
  strategy: (id: string) => `/admin/strategies/${encodeURIComponent(id)}`,
  lp: (pkh: string) => `/admin/lps/${encodeURIComponent(pkh)}`,
  twap: (id: string) => `/admin/twap/${encodeURIComponent(id)}`,
  trader: (owner: string) => `/admin/intents?owner=${encodeURIComponent(owner)}`,
  balancerTrade: (id: string) => `/admin/balancer/trades/${encodeURIComponent(id)}`,
};

/** Link for an event subject / related ref. */
export function refUrl(r: EventRef): string | undefined {
  switch (r.kind) {
    case 'intent': return adminUrl.intent(r.id);
    case 'pool': return adminUrl.pool(r.id);
    case 'strategy': return adminUrl.strategy(r.id);
    case 'lp': return /^[0-9a-f]{40}$/.test(r.id) ? adminUrl.lp(r.id) : adminUrl.trader(r.id);
    case 'twap': return adminUrl.twap(r.id);
    case 'route': return '/admin/operations';
    default: return undefined;
  }
}

// ── Time ─────────────────────────────────────────────────────────────────────

/** Re-renders every `ms` so relative times stay current. */
export function useNow(ms = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}

export function ago(sec: number, nowMs = Date.now()): string {
  const d = Math.max(0, Math.floor(nowMs / 1000 - sec));
  if (d < 60) return `${d}s ago`;
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86_400) return `${Math.floor(d / 3600)}h ${Math.floor((d % 3600) / 60)}m ago`;
  return `${Math.floor(d / 86_400)}d ago`;
}

export function duration(sec: number | null | undefined): string {
  if (sec === null || sec === undefined) return '—';
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`;
  if (sec < 86_400) return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
  return `${Math.floor(sec / 86_400)}d ${Math.floor((sec % 86_400) / 3600)}h`;
}

/** Relative time with the absolute time as a tooltip. `at` in seconds (or ms with unit="ms"). */
export function TimeAgo({ at, unit = 's', className }: { at?: number | null; unit?: 's' | 'ms'; className?: string }) {
  const now = useNow(15_000);
  if (!at) return <span className="text-zinc-600 text-xs">—</span>;
  const sec = unit === 'ms' ? Math.floor(at / 1000) : at;
  return <time dateTime={new Date(sec * 1000).toISOString()} title={new Date(sec * 1000).toLocaleString()} className={cn('text-xs text-zinc-400 whitespace-nowrap tabular-nums', className)}>{ago(sec, now)}</time>;
}

// ── States ───────────────────────────────────────────────────────────────────

export function LoadingBlock({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)} aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }, (_, i) => <div key={i} className="h-9 rounded-lg bg-white/[0.03] animate-pulse" />)}
    </div>
  );
}

export function ErrorBlock({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-xl border border-rose-500/25 bg-rose-500/[0.06] p-4 text-sm">
      <XCircle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-rose-200">Could not load this data</div>
        <div className="text-xs text-rose-200/70 mt-0.5 break-words">{error instanceof Error ? error.message : String(error)}</div>
        {error instanceof AdminApiError && error.status === 404 && (
          <div className="text-xs text-rose-100/80 mt-1.5">This server does not have the admin console API yet. Restart meshserver on the latest commit.</div>
        )}
      </div>
      {onRetry && <button type="button" onClick={onRetry} className="text-xs font-semibold text-rose-200 hover:text-white px-2 py-1 rounded border border-rose-400/30">Retry</button>}
    </div>
  );
}

export function EmptyBlock({ title, children, icon }: { title: string; children?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="py-10 text-center">
      <div className="mx-auto w-fit text-zinc-600 mb-2">{icon ?? <Inbox className="w-6 h-6" aria-hidden />}</div>
      <div className="text-sm font-semibold text-zinc-300">{title}</div>
      {children && <div className="mt-1 text-xs text-zinc-500 max-w-md mx-auto">{children}</div>}
    </div>
  );
}

/** Wraps a query: loading skeleton, error with retry, or children. */
export function QueryState<T>({ q, children, rows }: { q: { data?: T; error: unknown; isLoading: boolean; refetch: () => unknown }; children: (data: T) => ReactNode; rows?: number }) {
  if (q.isLoading && !q.data) return <LoadingBlock rows={rows} />;
  if (q.error && !q.data) return <ErrorBlock error={q.error} onRetry={() => void q.refetch()} />;
  if (!q.data) return null;
  return <>{children(q.data)}</>;
}

// ── Table ────────────────────────────────────────────────────────────────────

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: 'left' | 'right' | 'center';
  className?: string;
  /** hide below this breakpoint */
  hideBelow?: 'sm' | 'md' | 'lg' | 'xl';
}

const HIDE: Record<string, string> = { sm: 'hidden sm:table-cell', md: 'hidden md:table-cell', lg: 'hidden lg:table-cell', xl: 'hidden xl:table-cell' };

export function DataTable<T>({ columns, rows, rowKey, onRowClick, empty, loading, className, rowClassName }: {
  columns: Column<T>[]; rows: T[]; rowKey: (r: T) => string; onRowClick?: (r: T) => void; empty?: ReactNode; loading?: boolean; className?: string;
  rowClassName?: (r: T) => string | undefined;
}) {
  if (loading && rows.length === 0) return <LoadingBlock />;
  if (rows.length === 0) return <>{empty ?? <EmptyBlock title="Nothing here yet" />}</>;
  return (
    <div className={cn('overflow-x-auto -mx-4 sm:-mx-5', className)}>
      <table className="w-full text-sm border-separate border-spacing-0">
        <thead>
          <tr>
            {columns.map(c => (
              <th key={c.key} scope="col" className={cn(
                'sticky top-0 bg-[#0b0d12] px-3 first:pl-4 sm:first:pl-5 last:pr-4 sm:last:pr-5 py-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 border-b border-white/[0.06] whitespace-nowrap',
                c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left', c.hideBelow && HIDE[c.hideBelow], c.className,
              )}>{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={rowKey(r)}
              onClick={onRowClick ? () => onRowClick(r) : undefined}
              onKeyDown={onRowClick ? e => { if (e.key === 'Enter') onRowClick(r); } : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              className={cn('group', onRowClick && 'cursor-pointer hover:bg-white/[0.025] focus-visible:outline-none focus-visible:bg-white/[0.04]', rowClassName?.(r))}>
              {columns.map(c => (
                <td key={c.key} className={cn(
                  'px-3 first:pl-4 sm:first:pl-5 last:pr-4 sm:last:pr-5 py-2.5 border-b border-white/[0.04] align-middle',
                  c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left', c.hideBelow && HIDE[c.hideBelow], c.className,
                )}>{c.cell(r)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pager({ offset, limit, total, onChange }: { offset: number; limit: number; total: number; onChange: (offset: number) => void }) {
  if (total <= limit) return null;
  const page = Math.floor(offset / limit) + 1;
  const pages = Math.ceil(total / limit);
  return (
    <div className="flex items-center justify-between pt-3 text-xs text-zinc-500">
      <span className="tabular-nums">{offset + 1}–{Math.min(total, offset + limit)} of {total}</span>
      <div className="flex items-center gap-1">
        <button type="button" disabled={page <= 1} onClick={() => onChange(Math.max(0, offset - limit))} aria-label="Previous page"
          className="p-1.5 rounded border border-white/10 disabled:opacity-30 hover:bg-white/5"><ChevronLeft className="w-3.5 h-3.5" /></button>
        <span className="px-2 tabular-nums">{page} / {pages}</span>
        <button type="button" disabled={page >= pages} onClick={() => onChange(offset + limit)} aria-label="Next page"
          className="p-1.5 rounded border border-white/10 disabled:opacity-30 hover:bg-white/5"><ChevronRight className="w-3.5 h-3.5" /></button>
      </div>
    </div>
  );
}

// ── Filters (synced to the URL so views can be linked) ──────────────────────

export function useUrlState(defaults: Record<string, string>) {
  const [params, setParams] = useSearchParams();
  const state = useMemo(() => {
    const s: Record<string, string> = { ...defaults };
    for (const k of Object.keys(defaults)) { const v = params.get(k); if (v !== null) s[k] = v; }
    return s;
  }, [params.toString()]);
  const set = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === '' || v === defaults[k]) next.delete(k); else next.set(k, v);
    }
    if (!('offset' in patch)) next.delete('offset');
    setParams(next, { replace: true });
  };
  return [state, set] as const;
}

export function Segmented({ options, value, onChange, label }: {
  options: Array<{ value: string; label: ReactNode; count?: number }>; value: string; onChange: (v: string) => void; label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap items-center gap-1 rounded-lg border border-white/[0.07] bg-white/[0.015] p-0.5">
      {options.map(o => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          className={cn('px-2.5 py-1 rounded-md text-xs font-medium transition-colors duration-150 inline-flex items-center gap-1.5',
            value === o.value ? 'bg-emerald-500/15 text-emerald-200' : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.04]')}>
          {o.label}
          {o.count !== undefined && <span className={cn('tabular-nums text-[10px]', value === o.value ? 'text-emerald-300/80' : 'text-zinc-600')}>{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder, className }: { value: string; onChange: (v: string) => void; placeholder: string; className?: string }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  useEffect(() => { const t = setTimeout(() => { if (v !== value) onChange(v); }, 300); return () => clearTimeout(t); }, [v]);
  return (
    <label className={cn('relative flex items-center', className)}>
      <span className="sr-only">{placeholder}</span>
      <Search className="absolute left-2.5 w-3.5 h-3.5 text-zinc-500" aria-hidden />
      <input value={v} onChange={e => setV(e.target.value)} placeholder={placeholder}
        className="w-full h-8 pl-8 pr-3 rounded-lg bg-white/[0.03] border border-white/[0.08] text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-400/50 focus:ring-1 focus:ring-emerald-400/30" />
    </label>
  );
}

// ── Actions ──────────────────────────────────────────────────────────────────

export function ActionButton({ children, onClick, disabled, pending, tone = 'default', icon, className, title }: {
  children: ReactNode; onClick?: () => void; disabled?: boolean; pending?: boolean; tone?: 'default' | 'primary' | 'danger' | 'warn'; icon?: ReactNode; className?: string; title?: string;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled || pending} title={title}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold border transition-colors duration-150',
        'disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50',
        tone === 'primary' ? 'bg-emerald-500/15 border-emerald-400/30 text-emerald-200 hover:bg-emerald-500/25'
          : tone === 'danger' ? 'bg-rose-500/10 border-rose-400/30 text-rose-200 hover:bg-rose-500/20'
            : tone === 'warn' ? 'bg-amber-500/10 border-amber-400/30 text-amber-200 hover:bg-amber-500/20'
              : 'bg-white/[0.03] border-white/10 text-zinc-200 hover:bg-white/[0.07]',
        className,
      )}>
      {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
}

/** A button that asks for confirmation (what will happen, and that it is logged) before running. */
export function ConfirmAction({ label, title, description, confirmLabel, onConfirm, tone = 'default', icon, disabled, pending, children }: {
  label: ReactNode; title: string; description: ReactNode; confirmLabel?: string; onConfirm: () => void;
  tone?: 'default' | 'primary' | 'danger' | 'warn'; icon?: ReactNode; disabled?: boolean; pending?: boolean; children?: ReactNode;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <span><ActionButton tone={tone} icon={icon} disabled={disabled} pending={pending}>{label}</ActionButton></span>
      </AlertDialogTrigger>
      <AlertDialogContent className="bg-[#0b0d12] border-white/10">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-white font-heading">{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="text-sm text-zinc-400 space-y-2">
              <div>{description}</div>
              {children}
              <div className="text-[11px] text-zinc-500 flex items-center gap-1.5"><Clock className="w-3 h-3" aria-hidden />Recorded in the event log.</div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="bg-transparent border-white/10 text-zinc-300 hover:bg-white/5">Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}
            className={cn(tone === 'danger' ? 'bg-rose-600 hover:bg-rose-500' : tone === 'warn' ? 'bg-amber-600 hover:bg-amber-500' : 'bg-emerald-600 hover:bg-emerald-500', 'text-white')}>
            {confirmLabel ?? 'Confirm'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ── Small visuals ────────────────────────────────────────────────────────────

/** Horizontal stacked bar of parts (with a text legend, never colour alone). */
export function SplitBar({ parts, className }: { parts: Array<{ label: string; value: number; color: string }>; className?: string }) {
  const total = parts.reduce((a, p) => a + p.value, 0);
  if (!total) return <div className={cn('text-xs text-zinc-600', className)}>No data</div>;
  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex h-2 rounded-full overflow-hidden bg-white/[0.04]" role="img" aria-label={parts.map(p => `${p.label} ${Math.round((p.value / total) * 100)}%`).join(', ')}>
        {parts.filter(p => p.value > 0).map(p => <div key={p.label} style={{ width: `${(p.value / total) * 100}%`, background: p.color }} />)}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {parts.map(p => (
          <span key={p.label} className="inline-flex items-center gap-1.5 text-[11px] text-zinc-400">
            <span className="w-2 h-2 rounded-sm" style={{ background: p.color }} aria-hidden />
            {p.label} <span className="font-mono tabular-nums text-zinc-200">{p.value}</span>
            <span className="text-zinc-600 tabular-nums">{Math.round((p.value / total) * 100)}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function Progress({ value, max, tone = 'emerald', label }: { value: number; max: number; tone?: Tone; label?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2 min-w-[90px]" aria-label={label ?? `${value} of ${max}`}>
      <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden"><div className={cn('h-full rounded-full', TONE[tone].dot)} style={{ width: `${pct}%` }} /></div>
      <span className="text-[11px] font-mono tabular-nums text-zinc-400">{value}/{max}</span>
    </div>
  );
}
