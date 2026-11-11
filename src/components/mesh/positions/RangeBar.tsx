/**
 * Compact Range Bar for position rows (MeshDocs/meshv3v4flow/04 §4).
 * Shows the position's min and max price, and a marker where the current market price sits.
 */
import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { formatPrice } from '@/lib/mesh/create/price';

export interface RangeBarProps {
  minPrice?: number | null;
  maxPrice?: number | null;
  marketPrice?: number | null;
  symbol?: string;
  className?: string;
}

export function RangeBar({ minPrice, maxPrice, marketPrice, symbol, className }: {
  minPrice?: number | null;
  maxPrice?: number | null;
  marketPrice?: number | null;
  symbol?: string;
  className?: string;
}) {
  const hasRange = minPrice && maxPrice && minPrice > 0 && maxPrice > 0;

  const { pos, inRange } = useMemo(() => {
    if (!hasRange || !marketPrice || marketPrice <= 0) return { pos: null, inRange: false };
    const lo = Math.min(minPrice, maxPrice);
    const hi = Math.max(minPrice, maxPrice);
    const span = hi - lo;
    if (span <= 0) return { pos: 50, inRange: true };
    const raw = ((marketPrice - lo) / span) * 100;
    const clamped = Math.max(0, Math.min(100, raw));
    return { pos: clamped, inRange: raw >= 0 && raw <= 100 };
  }, [hasRange, minPrice, maxPrice, marketPrice]);

  if (!hasRange) {
    return <span className="text-xs text-zinc-500 font-mono">—</span>;
  }

  const lo = Math.min(minPrice!, maxPrice!);
  const hi = Math.max(minPrice!, maxPrice!);

  return (
    <div className={cn('min-w-[140px] max-w-[200px] flex flex-col gap-1', className)}>
      <div className="relative h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
        {/* Active range band */}
        <div className="absolute inset-y-0 left-0 right-0 bg-emerald-500/20 rounded-full" />
        {/* Market marker */}
        {pos !== null && (
          <div
            className={cn(
              'absolute top-0 bottom-0 w-1.5 -translate-x-1/2 rounded-full shadow-sm',
              inRange ? 'bg-emerald-400 shadow-emerald-400/50' : 'bg-amber-400 shadow-amber-400/50',
            )}
            style={{ left: `${pos}%` }}
            title={`Market: ${formatPrice(marketPrice!)}${symbol ? ` ${symbol}` : ''}`}
          />
        )}
      </div>
      <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500">
        <span>{formatPrice(lo)}</span>
        <span>{formatPrice(hi)}</span>
      </div>
    </div>
  );
}
