/**
 * The price chart for bins, rungs, steps and pools (MeshDocs/meshv3v4flow/09
 * §2.5). Axis: 1 BCH = P tokens, P growing to the right. Bars holding BCH are
 * emerald (right of the market), bars holding the token cyan (left of it);
 * other LPs' liquidity sits faintly behind; the market is a dashed line.
 *
 * With `handles`, two handles set the range: drag them (mouse or touch) or
 * focus one and use the arrow keys (one bin per press, Shift = 10).
 */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from 'react';
import { cn } from '@/lib/utils';
import type { ChartBin } from '@/lib/mesh/create/layout';
import { clamp, linearScale, niceTicks } from './scale';

export interface RangeHandles {
  min: number;
  max: number;
  /** a new range while dragging (`done` false) and when let go (`done` true) */
  onChange: (min: number, max: number, done: boolean) => void;
  /** snap a dragged price (e.g. to the bin grid) */
  snap?: (p: number) => number;
  /** move a price by n bins for the arrow keys; defaults to ±0.5% per step */
  step?: (p: number, n: number) => number;
  /** "325.40" */
  format: (p: number) => string;
}

const BCH = '#34d399';
const TOKEN = '#22d3ee';
const MARKET = '#7dd3fc';

function useWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const set = () => setW(el.getBoundingClientRect().width);
    set();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

/** A stable axis: the market ± enough room for the range and some space to drag outwards. */
function autoDomain(bins: ChartBin[], marketP: number | null | undefined, handles?: RangeHandles): [number, number] {
  const pts: number[] = [];
  for (const b of bins) pts.push(b.minP, b.maxP);
  if (handles) pts.push(handles.min, handles.max);
  if (marketP && marketP > 0) pts.push(marketP);
  const good = pts.filter(p => p > 0 && Number.isFinite(p));
  if (good.length === 0) return [0, 1];
  const center = marketP && marketP > 0 ? marketP : (Math.min(...good) + Math.max(...good)) / 2;
  const reach = Math.max(...good.map(p => Math.abs(p / center - 1)), 0.02);
  const w = reach * (handles ? 1.45 : 1.15);
  return [center * (1 - w), center * (1 + w)];
}

export function BinChart({
  bins, depth, marketP, handles, symbol, ariaLabel, height = 220, formatTick, emptyText, className, domain: fixedDomain,
}: {
  bins: ChartBin[];
  depth?: ChartBin[];
  marketP?: number | null;
  handles?: RangeHandles;
  symbol: string;
  ariaLabel: string;
  height?: number;
  formatTick?: (p: number) => string;
  emptyText?: string;
  className?: string;
  domain?: [number, number];
}) {
  const [box, width] = useWidth<HTMLDivElement>();
  const dragging = useRef<'min' | 'max' | null>(null);
  const frozen = useRef<[number, number] | null>(null);
  const [, force] = useState(0);

  const live = useMemo(() => fixedDomain ?? autoDomain(bins, marketP, handles), [fixedDomain, bins, marketP, handles?.min, handles?.max]); // eslint-disable-line react-hooks/exhaustive-deps
  const domain = frozen.current ?? live;

  const PAD_X = 14, TOP = 22, AXIS = 24;
  const w = Math.max(width, 240);
  const plotH = height - TOP - AXIS;
  const x = linearScale(domain, [PAD_X, w - PAD_X]);
  const y0 = TOP + plotH;
  const fmt = formatTick ?? ((p: number) => (p >= 1000 ? p.toFixed(0) : p >= 1 ? p.toFixed(2) : p.toPrecision(3)));
  const ticks = niceTicks(domain[0], domain[1], w < 420 ? 3 : 5).filter(t => t > domain[0] && t < domain[1]);

  const rect = (b: ChartBin) => {
    const x0 = x(b.minP), x1 = x(b.maxP);
    const gap = Math.min(1, (x1 - x0) * 0.12);
    const left = Math.max(PAD_X, Math.min(x0, x1) + gap);
    const right = Math.min(w - PAD_X, Math.max(x0, x1) - gap);
    return { left, width: Math.max(1.5, right - left) };
  };

  // ── handles ──────────────────────────────────────────────────────────────
  const stepFn = handles?.step ?? ((p: number, n: number) => p * (1 + 0.005 * n));
  const commit = (which: 'min' | 'max', p: number, done: boolean) => {
    if (!handles) return;
    const snap = handles.snap ?? ((v: number) => v);
    let v = snap(p);
    if (which === 'min') {
      v = Math.min(v, stepFn(handles.max, -1));
      handles.onChange(v, handles.max, done);
    } else {
      v = Math.max(v, stepFn(handles.min, 1));
      handles.onChange(handles.min, v, done);
    }
  };
  const pxToP = (clientX: number) => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return 0;
    return x.invert(clamp(clientX - r.left, PAD_X, w - PAD_X));
  };
  const onDown = (which: 'min' | 'max') => (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragging.current = which;
    frozen.current = domain;
    force(n => n + 1);
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    commit(dragging.current, pxToP(e.clientX), false);
  };
  const onUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const which = dragging.current;
    dragging.current = null;
    frozen.current = null;
    commit(which, pxToP(e.clientX), true);
    force(n => n + 1);
  };
  const onKey = (which: 'min' | 'max') => (e: KeyboardEvent<HTMLDivElement>) => {
    if (!handles) return;
    const n = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
    if (!n) return;
    e.preventDefault();
    const cur = which === 'min' ? handles.min : handles.max;
    commit(which, stepFn(cur, n * (e.shiftKey ? 10 : 1)), true);
  };

  const hasData = bins.length > 0 || (depth?.length ?? 0) > 0;

  return (
    <div ref={box} className={cn('relative w-full select-none overflow-hidden rounded-2xl border border-white/[0.06] bg-black/35', className)} style={{ height }}
      onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
      <svg width={w} height={height} role="img" aria-label={ariaLabel} className="block" style={{ touchAction: 'pan-y' }}>
        {/* range shading */}
        {handles && (
          <rect x={Math.min(x(handles.min), x(handles.max))} y={TOP - 8} width={Math.abs(x(handles.max) - x(handles.min))} height={plotH + 8} fill="rgba(52,211,153,0.06)" />
        )}
        {/* other LPs' liquidity */}
        {depth?.map(b => {
          const r = rect(b);
          const h = Math.max(2, b.weight * plotH * 0.55);
          return <rect key={b.key} x={r.left} y={y0 - h} width={r.width} height={h} rx={1.5} fill="#3f3f46" opacity={0.55} />;
        })}
        {/* this strategy */}
        {bins.map(b => {
          const r = rect(b);
          const h = Math.max(3, b.weight * plotH * 0.92);
          return <rect key={b.key} x={r.left} y={y0 - h} width={r.width} height={h} rx={2} fill={b.side === 'bch' ? BCH : TOKEN} />;
        })}
        {/* axis */}
        <line x1={PAD_X} x2={w - PAD_X} y1={y0 + 0.5} y2={y0 + 0.5} stroke="rgba(255,255,255,0.12)" />
        {ticks.map(t => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={y0} y2={y0 + 4} stroke="rgba(255,255,255,0.2)" />
            <text x={x(t)} y={y0 + 16} textAnchor="middle" fontSize={10} fill="#a1a1aa" fontFamily="JetBrains Mono, ui-monospace, monospace">{fmt(t)}</text>
          </g>
        ))}
        {/* market */}
        {marketP && marketP > domain[0] && marketP < domain[1] && (
          <g>
            <line x1={x(marketP)} x2={x(marketP)} y1={TOP - 6} y2={y0} stroke={MARKET} strokeWidth={2} strokeDasharray="5 5" />
            <text x={clamp(x(marketP), 40, w - 40)} y={12} textAnchor="middle" fontSize={10} fill={MARKET} fontFamily="JetBrains Mono, ui-monospace, monospace">market {fmt(marketP)}</text>
          </g>
        )}
        {!hasData && emptyText && (
          <text x={w / 2} y={TOP + plotH / 2} textAnchor="middle" fontSize={12} fill="#71717a">{emptyText}</text>
        )}
      </svg>

      {handles && (['min', 'max'] as const).map(which => {
        const p = which === 'min' ? handles.min : handles.max;
        if (!(p > 0)) return null;
        const left = clamp(x(p), PAD_X, w - PAD_X);
        return (
          <div
            key={which}
            role="slider"
            tabIndex={0}
            aria-label={which === 'min' ? `Min price, ${symbol} per BCH` : `Max price, ${symbol} per BCH`}
            aria-valuemin={domain[0]}
            aria-valuemax={domain[1]}
            aria-valuenow={p}
            aria-valuetext={`1 BCH = ${handles.format(p)} ${symbol}`}
            onPointerDown={onDown(which)}
            onKeyDown={onKey(which)}
            className="group absolute top-0 flex h-full w-8 -translate-x-1/2 cursor-ew-resize justify-center outline-none"
            style={{ left, touchAction: 'none' }}
          >
            <span className="absolute bottom-6 top-3 w-0.5 bg-white/90" aria-hidden />
            <span className="absolute top-[38%] h-9 w-3.5 rounded-md border border-zinc-900 bg-white shadow group-focus-visible:ring-2 group-focus-visible:ring-emerald-400" aria-hidden />
          </div>
        );
      })}
    </div>
  );
}

/** The chart's legend: what the colours mean, in words. */
export function BinLegend({ symbol, depth, className }: { symbol: string; depth?: boolean; className?: string }) {
  return (
    <div className={cn('flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-400', className)}>
      <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: TOKEN }} aria-hidden />Holds {symbol}, buys BCH below the price</span>
      <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: BCH }} aria-hidden />Holds BCH, sells it above the price</span>
      {depth && <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-zinc-600" aria-hidden />Other LPs on Mesh</span>}
    </div>
  );
}
