/**
 * The market for a pair, both ways: 1 BCH = P tokens and 1 token = x BCH, where
 * the price comes from, Mesh's best prices, and a plain warning when the price
 * is thin (Mesh pools only) or moved away from its recent median.
 */
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { MarketContext } from '@/lib/mesh/meshApi';
import { formatNumber } from '@/lib/mesh/format';
import { bchPerToken, formatPrice, tokensPerBchFromSats } from '@/lib/mesh/create/price';
import { NoteBox } from '@/components/mesh/kit';

const SOURCE: Record<string, string> = {
  cauldron: 'Cauldron', 'mesh-mid': 'Mesh pools', 'mesh-bid': 'Mesh buy price', 'mesh-ask': 'Mesh sell price',
};

function Cell({ label, value, sub, className }: { label: ReactNode; value: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0 space-y-0.5', className)}>
      <div className="text-[11px] font-medium text-zinc-400">{label}</div>
      <div className="truncate font-mono text-sm font-semibold tabular-nums text-white">{value}</div>
      {sub && <div className="truncate font-mono text-[11px] tabular-nums text-zinc-500">{sub}</div>}
    </div>
  );
}

export function MarketStrip({ ctx, symbol, decimals, loading, className, compact }: {
  ctx: MarketContext | null | undefined;
  symbol: string;
  decimals: number;
  loading?: boolean;
  className?: string;
  /** two columns at every width (for narrow cards such as Simple mode) */
  compact?: boolean;
}) {
  if (loading && !ctx) {
    return <div className={cn('h-[92px] animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.02] motion-reduce:animate-none', className)} aria-label="Loading the market price" />;
  }
  if (!ctx || !ctx.midSatsPerToken) {
    return (
      <NoteBox tone="warn" className={className} title={`No market price for ${symbol}`}>
        There is no Cauldron pool and no Mesh price for this token yet. You can still set your prices by hand.
      </NoteBox>
    );
  }
  const p = tokensPerBchFromSats(ctx.midSatsPerToken, decimals);
  const bid = ctx.mesh.bestBid ? tokensPerBchFromSats(Number(ctx.mesh.bestBid.satsPerToken), decimals) : null;
  const ask = ctx.mesh.bestAsk ? tokensPerBchFromSats(Number(ctx.mesh.bestAsk.satsPerToken), decimals) : null;
  const moved = ctx.midCheck && !ctx.midCheck.ok && ctx.midCheck.divergenceBps !== null;
  return (
    <div className={cn('space-y-2', className)}>
      <div className={cn('grid grid-cols-2 gap-x-4 gap-y-3 rounded-2xl border border-sky-400/15 bg-sky-500/[0.04] px-4 py-3', !compact && 'sm:grid-cols-4')}>
        <Cell
          className={cn('col-span-2', !compact && 'sm:col-span-1')}
          label={<>Market price · {SOURCE[ctx.midSource ?? ''] ?? 'Mesh'}</>}
          value={<span className="text-sky-200">1 BCH = {formatPrice(p)} <span className="text-zinc-400">{symbol}</span></span>}
          sub={`1 ${symbol} = ${formatNumber(bchPerToken(p), 8)} BCH`}
        />
        <Cell label={`Mesh buys ${symbol} at`} value={bid ? formatPrice(bid) : '—'} sub={bid ? `${symbol} per BCH` : 'No buy price yet'} />
        <Cell label={`Mesh sells ${symbol} at`} value={ask ? formatPrice(ask) : '—'} sub={ask ? `${symbol} per BCH` : 'No sell price yet'} />
        <Cell label="In dollars" value={ctx.bchUsd ? `BCH $${formatNumber(ctx.bchUsd, 2)}` : '—'} sub={ctx.tokenUsd !== null ? `${symbol} $${formatNumber(ctx.tokenUsd, 4)}` : undefined} />
      </div>
      {ctx.midConfidence === 'mesh-only' && (
        <NoteBox tone="warn">This price comes only from Mesh pools, not from an independent market. Check it before you centre a position on it.</NoteBox>
      )}
      {moved && (
        <NoteBox tone="warn">The price is {(Math.abs(ctx.midCheck!.divergenceBps!) / 100).toFixed(1)}% away from its recent median. It may be moving fast, or a pool is mispriced.</NoteBox>
      )}
    </div>
  );
}
