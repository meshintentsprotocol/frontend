/**
 * DeFi-style building blocks for the Mesh strategy and pool pages
 * (MeshDocs/AlphaV3/10 §2): hairline rectangles on near-black surfaces,
 * numbers in JetBrains Mono, emerald for bids / positive, rose for asks /
 * negative, amber for idle and warnings, sky for the market mid.
 * Side and status are never shown by colour alone (icon or text too).
 */
import type { ReactNode } from 'react';
import {
  Target, ArrowLeftRight, Network, Scale, Repeat, Grid3x3, TrendingUp, TrendingDown, Boxes, Recycle, Moon,
  ArrowUpRight, ArrowDownRight, Minus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MarketContext, PoolStatus } from '@/lib/mesh/meshApi';
import { formatNumber } from '@/lib/mesh/format';

// ── Templates ────────────────────────────────────────────────────────────────

export const TEMPLATE_META: Record<string, { name: string; icon: typeof Target; category: string }> = {
  fixed: { name: 'Fixed price', icon: Target, category: 'Limit' },
  spread: { name: 'Spread market', icon: ArrowLeftRight, category: 'Market making' },
  'multi-pair': { name: 'Multi-pair quote', icon: Network, category: 'Multi-asset' },
  'stable-pair': { name: 'Stable pair', icon: Scale, category: 'Stable' },
  'recycling-pair': { name: 'Recycling pair', icon: Repeat, category: 'Range' },
  grid: { name: 'Grid', icon: Grid3x3, category: 'Range' },
  'take-profit': { name: 'Take-profit ladder', icon: TrendingUp, category: 'Directional' },
  accumulate: { name: 'Accumulate ladder', icon: TrendingDown, category: 'Directional' },
};
export const templateName = (id: string) => TEMPLATE_META[id]?.name ?? id.replace(/-/g, ' ');

export function TemplateIcon({ id, className }: { id: string; className?: string }) {
  const Icon = TEMPLATE_META[id]?.icon ?? Boxes;
  return (
    <div className={cn('w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0', className)}>
      <Icon className="w-4 h-4" aria-hidden />
    </div>
  );
}

// ── Surfaces ─────────────────────────────────────────────────────────────────

/** The DeFi rectangle: hairline border, faint top glow, lift on hover when interactive. */
export function DefiCard({ children, className, interactive, tone = 'default' }: {
  children: ReactNode; className?: string; interactive?: boolean; tone?: 'default' | 'idle' | 'muted';
}) {
  return (
    <div className={cn(
      'relative overflow-hidden rounded-2xl border bg-[#0b0d12] p-4 sm:p-5',
      'before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-emerald-400/40 before:to-transparent',
      tone === 'idle' ? 'border-amber-400/25 before:via-amber-300/50' : tone === 'muted' ? 'border-white/[0.05] opacity-75' : 'border-white/[0.08]',
      interactive && 'transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-400/30 hover:shadow-[0_8px_30px_-12px_rgba(16,185,129,0.35)] focus-within:border-emerald-400/40',
      className,
    )}>
      {children}
    </div>
  );
}

export function MetricCell({ label, value, sub, accent, className }: { label: string; value: ReactNode; sub?: ReactNode; accent?: string; className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">{label}</div>
      <div className={cn('mt-0.5 font-mono text-sm font-semibold tabular-nums truncate', accent ?? 'text-white')}>{value}</div>
      {sub !== undefined && <div className="font-mono text-[10px] text-zinc-500 tabular-nums truncate">{sub}</div>}
    </div>
  );
}

// ── Pills and chips ──────────────────────────────────────────────────────────

const STATUS: Record<PoolStatus, { label: string; cls: string; dot: string }> = {
  active: { label: 'Active', cls: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25', dot: 'bg-emerald-400 animate-pulse' },
  exhausted: { label: 'Needs withdraw', cls: 'bg-amber-500/10 text-amber-300 border-amber-500/25', dot: 'bg-amber-400' },
  closed: { label: 'Closed', cls: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20', dot: 'bg-zinc-500' },
};

export function StatusPill({ status, className }: { status: PoolStatus; className?: string }) {
  const s = STATUS[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold', s.cls, className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', s.dot)} aria-hidden />{s.label}
    </span>
  );
}

export function IdlePill({ title, className }: { title?: string; className?: string }) {
  return (
    <span title={title} className={cn('inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300', className)}>
      <Moon className="h-3 w-3" aria-hidden />Idle
    </span>
  );
}

export function RecyclePill({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-500/[0.08] px-2 py-0.5 text-[10px] font-semibold text-emerald-300', className)}>
      <Recycle className="h-3 w-3" aria-hidden />Recycles
    </span>
  );
}

/** Signed distance from the market mid, with an arrow (not colour alone). */
export function VsMid({ bps, className }: { bps: number | null | undefined; className?: string }) {
  if (bps === null || bps === undefined) return <span className={cn('font-mono text-[10px] text-zinc-500', className)}>no market</span>;
  const pct = bps / 100;
  const Icon = Math.abs(pct) < 0.05 ? Minus : pct > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn('inline-flex items-center gap-0.5 font-mono text-[10px] tabular-nums', Math.abs(pct) < 0.05 ? 'text-sky-300' : pct > 0 ? 'text-emerald-300' : 'text-rose-300', className)}>
      <Icon className="h-3 w-3" aria-hidden />{pct > 0 ? '+' : ''}{pct.toFixed(2)}% vs market
    </span>
  );
}

// ── Inventory ────────────────────────────────────────────────────────────────

export interface InventorySegment { label: string; valueSats: number; tone: 'bch' | 'token' | 'other' }

/** What a position holds, by value, with labels and percentages. */
export function InventoryBar({ segments, className }: { segments: InventorySegment[]; className?: string }) {
  const total = segments.reduce((a, s) => a + Math.max(0, s.valueSats), 0);
  if (total <= 0) return null;
  const tone = { bch: 'bg-emerald-400/80', token: 'bg-sky-400/80', other: 'bg-violet-400/70' } as const;
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]" role="img"
        aria-label={segments.map(s => `${s.label} ${Math.round((100 * s.valueSats) / total)}%`).join(', ')}>
        {segments.filter(s => s.valueSats > 0).map(s => <div key={s.label} className={tone[s.tone]} style={{ width: `${(100 * s.valueSats) / total}%` }} />)}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-zinc-400">
        {segments.filter(s => s.valueSats > 0).map(s => (
          <span key={s.label} className="inline-flex items-center gap-1">
            <span className={cn('h-1.5 w-1.5 rounded-full', tone[s.tone])} aria-hidden />{s.label} <span className="font-mono">{Math.round((100 * s.valueSats) / total)}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Market ───────────────────────────────────────────────────────────────────

/** sats per token base unit → "1 BCH = P tokens" (whole tokens). */
export const tokensPerBch = (satsPerUnit: number, decimals: number) => (satsPerUnit > 0 ? 1e8 / (satsPerUnit * 10 ** decimals) : 0);

const SOURCE: Record<string, string> = { cauldron: 'Cauldron', 'mesh-mid': 'Mesh mid', 'mesh-bid': 'Mesh bid', 'mesh-ask': 'Mesh ask' };

/** Market strip: mid (both ways), its source, Mesh best bid / ask, USD. */
export function MarketStrip({ ctx, symbol, decimals, loading, className }: {
  ctx?: MarketContext | null; symbol: string; decimals: number; loading?: boolean; className?: string;
}) {
  if (loading) return <div className={cn('h-[58px] animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.02]', className)} />;
  if (!ctx || ctx.midSatsPerToken === null) {
    return (
      <div className={cn('rounded-xl border border-amber-400/25 bg-amber-500/[0.06] px-3 py-2.5 text-[11px] text-amber-200', className)}>
        No market price for {symbol}: no Cauldron pool and no Mesh quote. Set prices by hand.
      </div>
    );
  }
  const mid = ctx.midSatsPerToken;
  const per = tokensPerBch(mid, decimals);
  const bid = ctx.mesh.bestBid ? tokensPerBch(Number(ctx.mesh.bestBid.satsPerToken), decimals) : null;
  const ask = ctx.mesh.bestAsk ? tokensPerBch(Number(ctx.mesh.bestAsk.satsPerToken), decimals) : null;
  return (
    <div className={cn('grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-xl border border-sky-400/15 bg-sky-500/[0.04] px-3 py-2.5', className)}>
      <MetricCell label={`Mid · ${SOURCE[ctx.midSource ?? ''] ?? '—'}`} value={<>1 BCH = {formatNumber(per, per >= 100 ? 2 : 4)} <span className="text-zinc-400">{symbol}</span></>}
        sub={`1 ${symbol} = ${formatNumber((mid * 10 ** decimals) / 1e8, 8)} BCH`} accent="text-sky-200" />
      <MetricCell label="Mesh best bid" value={bid ? formatNumber(bid, bid >= 100 ? 2 : 4) : '—'} sub={bid ? `${symbol} per BCH` : 'no bid'} accent="text-emerald-300" />
      <MetricCell label="Mesh best ask" value={ask ? formatNumber(ask, ask >= 100 ? 2 : 4) : '—'} sub={ask ? `${symbol} per BCH` : 'no ask'} accent="text-rose-300" />
      <MetricCell label="USD" value={ctx.tokenUsd !== null ? `$${formatNumber(ctx.tokenUsd, 4)}` : '—'} sub={ctx.bchUsd ? `BCH $${formatNumber(ctx.bchUsd, 2)}` : undefined} />
    </div>
  );
}

/**
 * A V3 pool's first-slot price against the market mid, in bps:
 * BCH reserve buying a token (num/den sats per unit) or a token reserve selling for BCH (den/num).
 */
export function poolVsMidBps(v3: { reserve: string; slots: Array<{ cat: string; num: string; den: string }> }, midSatsPerToken: number): number | null {
  const s = v3.slots[0];
  if (!s || !(midSatsPerToken > 0)) return null;
  const num = Number(s.num); const den = Number(s.den);
  if (!(num > 0 && den > 0)) return null;
  const price = v3.reserve === '0x' ? num / den : s.cat === '0x' ? den / num : null;
  return price === null ? null : Math.round((price / midSatsPerToken - 1) * 10_000);
}
