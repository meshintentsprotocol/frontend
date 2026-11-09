/**
 * Prices on one line (MeshDocs/meshv3v4flow/09 §2.5): the market and the
 * strategy's own prices (buy, sell, trade-back), with the gap between two of
 * them shaded. Same axis as every chart: 1 BCH = P tokens, P to the right.
 * Labels that would overlap move to a second row.
 */
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { linearScale, niceTicks } from './scale';

export interface PriceMarker {
  key: string;
  p: number;
  label: string;
  /** bch: holds BCH (buys the token); token: holds the token (sells it); muted: a trade-back price */
  tone: 'bch' | 'token' | 'muted';
  dashed?: boolean;
}

const COLOR = { bch: '#34d399', token: '#22d3ee', muted: '#a1a1aa' } as const;
const MARKET = '#7dd3fc';

export function PriceLine({ markers, marketP, band, ariaLabel, height = 136, format, className }: {
  markers: PriceMarker[];
  marketP?: number | null;
  band?: { from: number; to: number; label?: string } | null;
  ariaLabel: string;
  height?: number;
  format?: (p: number) => string;
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const set = () => setWidth(el.getBoundingClientRect().width);
    set();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fmt = format ?? ((p: number) => (p >= 1000 ? p.toFixed(0) : p >= 1 ? p.toFixed(2) : p.toPrecision(3)));
  const good = markers.filter(m => m.p > 0 && Number.isFinite(m.p));
  const pts = [...good.map(m => m.p), ...(marketP && marketP > 0 ? [marketP] : [])];
  const w = Math.max(width, 240);
  const PAD = 16, AXIS = 22, TOP = 8;
  const y0 = height - AXIS;

  if (pts.length === 0) {
    return (
      <div ref={box} className={cn('flex items-center justify-center rounded-2xl border border-white/[0.06] bg-black/35 text-xs text-zinc-500', className)} style={{ height }}>
        Set a price to see it against the market
      </div>
    );
  }

  const lo = Math.min(...pts), hi = Math.max(...pts);
  const mid = (lo + hi) / 2;
  const span = Math.max(hi - lo, mid * 0.02);
  const domain: [number, number] = [mid - span * 0.8, mid + span * 0.8];
  const x = linearScale(domain, [PAD, w - PAD]);
  const ticks = niceTicks(domain[0], domain[1], w < 420 ? 3 : 5).filter(t => t > domain[0] && t < domain[1]);

  // label rows: a label that would overlap the previous one in its row drops a row
  const sorted = [...good].sort((a, b) => a.p - b.p);
  const rowEnd: number[] = [];
  const rowOf = new Map<string, number>();
  for (const m of sorted) {
    const cx = x(m.p);
    const half = Math.min(70, 8 + (m.label.length + fmt(m.p).length) * 3.1);
    let r = 0;
    while (r < rowEnd.length && rowEnd[r]! > cx - half) r++;
    rowEnd[r] = cx + half;
    rowOf.set(m.key, Math.min(r, 2));
  }
  const ROW_H = 26;

  return (
    <div ref={box} className={cn('relative w-full overflow-hidden rounded-2xl border border-white/[0.06] bg-black/35', className)} style={{ height }}>
      <svg width={w} height={height} role="img" aria-label={ariaLabel} className="block">
        {band && band.from > 0 && band.to > 0 && (
          <g>
            <rect x={Math.min(x(band.from), x(band.to))} y={TOP} width={Math.abs(x(band.to) - x(band.from))} height={y0 - TOP} fill="rgba(52,211,153,0.07)" />
            {band.label && (
              <text x={(x(band.from) + x(band.to)) / 2} y={y0 - 8} textAnchor="middle" fontSize={10} fill="#6ee7b7" fontFamily="JetBrains Mono, ui-monospace, monospace">{band.label}</text>
            )}
          </g>
        )}
        <line x1={PAD} x2={w - PAD} y1={y0 + 0.5} y2={y0 + 0.5} stroke="rgba(255,255,255,0.12)" />
        {ticks.map(t => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={y0} y2={y0 + 4} stroke="rgba(255,255,255,0.2)" />
            <text x={x(t)} y={y0 + 16} textAnchor="middle" fontSize={10} fill="#a1a1aa" fontFamily="JetBrains Mono, ui-monospace, monospace">{fmt(t)}</text>
          </g>
        ))}
        {marketP && marketP > domain[0] && marketP < domain[1] && (
          <line x1={x(marketP)} x2={x(marketP)} y1={TOP} y2={y0} stroke={MARKET} strokeWidth={2} strokeDasharray="5 5" />
        )}
        {good.map(m => {
          const r = rowOf.get(m.key) ?? 0;
          const cx = x(m.p);
          const ly = TOP + 14 + r * ROW_H;
          const anchor = cx < 70 ? 'start' : cx > w - 70 ? 'end' : 'middle';
          return (
            <g key={m.key}>
              <line x1={cx} x2={cx} y1={ly + 6} y2={y0} stroke={COLOR[m.tone]} strokeWidth={2} strokeDasharray={m.dashed ? '3 4' : undefined} />
              <circle cx={cx} cy={y0} r={3.5} fill={COLOR[m.tone]} />
              <text x={cx} y={ly} textAnchor={anchor} fontSize={11} fill={COLOR[m.tone]} fontFamily="JetBrains Mono, ui-monospace, monospace">
                {m.label} {fmt(m.p)}
              </text>
            </g>
          );
        })}
        {marketP && marketP > domain[0] && marketP < domain[1] && (
          <text x={x(marketP)} y={y0 - 26} textAnchor="middle" fontSize={10} fill={MARKET} fontFamily="JetBrains Mono, ui-monospace, monospace">market</text>
        )}
      </svg>
    </div>
  );
}
