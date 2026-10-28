/**
 * Step ② for a range (MeshDocs/meshv3v4flow/08 §3.1, canvas A2 / A6):
 * presets, the bin chart with two handles, min and max price both ways, shape,
 * bin step (V4 earns the step; V3 adds a pool fee) and the engine line.
 *
 * Form values keep the server's naming: `low` is the most tokens per BCH (the
 * right edge of the chart), `high` the fewest (the left edge).
 */
import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { CreateFlow } from '../useCreateFlow';
import { StepCard } from '../CreateShell';
import { BinChart, BinLegend, type RangeHandles } from '@/components/mesh/charts/BinChart';
import { ChoiceCards, EngineLine, LinkButton, NoteBox, PriceInput, ShapePicker, TierChips, type Shape, type Strength } from '@/components/mesh/kit';
import { BIN_STEP_CHOICES } from '@/lib/mesh/v3/strategyForms';
import { FEE_TIERS, RANGE_PRESETS } from '@/lib/mesh/presets';
import { formatPrice, formatPriceEdge, formatPriceInput, parsePrice, satsFromTokensPerBch, signedPct } from '@/lib/mesh/create/price';
import { snapToGrid, stepOnGrid, v3RangeLayout, v4RangeLayout, V3_MAX_RANGE_BINS, V4_MAX_BINS } from '@/lib/mesh/create/layout';

const sats = (p: number, dec: number) => satsFromTokensPerBch(p, dec);

/** % of a "1 BCH = P" price from the market P (P-axis, the frame the range is drawn in) */
const pctFrom = (p: number, market: number) => (p / market - 1) * 100;

export function RangeSettings({ flow }: { flow: CreateFlow }) {
  const { values, patch, set, main, marketP, rangeLayout, depthChart, engine, engines, setEngine } = flow;
  const dec = main.decimals;
  const sym = main.symbol;
  const step = Number(values.binStepBps || 100);
  const minP = parsePrice(values.high);
  const maxP = parsePrice(values.low);
  const centerP = parsePrice(values.center);
  const hasRange = minP > 0 && maxP > 0;
  const maxBins = engine === 'v4' ? V4_MAX_BINS : V3_MAX_RANGE_BINS;
  const unit = engine === 'v4' ? 'bin' : 'pool';

  const snap = (p: number, s = step) => snapToGrid(p, s, dec);
  const fmt = (p: number) => formatPriceInput(p);
  // edges are rounded outward so the outermost grid level stays inside the range
  const lowEdge = (p: number) => formatPriceEdge(p, 'down');
  const highEdge = (p: number) => formatPriceEdge(p, 'up');

  const setRange = (lo: number, hi: number) => patch({ high: lowEdge(lo), low: highEdge(hi) });

  // which preset the range matches (half a bin of slack for snapping), else Custom
  const preset = useMemo(() => {
    if (!marketP || !hasRange) return 'custom';
    const tol = Math.max(0.6, step / 200 + 0.1);
    const lo = pctFrom(minP, marketP), hi = pctFrom(maxP, marketP);
    return RANGE_PRESETS.find(r => r.pct !== null && Math.abs(lo + r.pct) <= tol && Math.abs(hi - r.pct) <= tol)?.id ?? 'custom';
  }, [marketP, minP, maxP, hasRange, step]);

  const applyPreset = (id: string) => {
    const r = RANGE_PRESETS.find(x => x.id === id);
    if (!r || r.pct === null || !marketP) return;
    patch({ high: lowEdge(snap(marketP * (1 - r.pct / 100))), low: highEdge(snap(marketP * (1 + r.pct / 100))), center: fmt(marketP) });
  };

  const setStep = (s: string) => {
    const n = Number(s);
    // keep the range on the new grid so the inputs match the chart
    patch(hasRange ? { binStepBps: s, high: lowEdge(snap(minP, n)), low: highEdge(snap(maxP, n)) } : { binStepBps: s });
  };

  // how many bins a range would make, so a step or a preset that doesn't fit says so
  const countFor = (lo: number, hi: number, s: number): number | null => {
    const c = centerP > 0 ? centerP : marketP;
    if (!(lo > 0 && hi > lo) || !c) return null;
    // nudged outward like the inputs, so an edge on a level counts that level
    const args = { lowSats: sats(hi, dec) * (1 - 1e-9), highSats: sats(lo, dec) * (1 + 1e-9), centerSats: sats(c, dec), stepBps: s, decimals: dec, maxBins: 10_000 };
    const l = engine === 'v4' ? v4RangeLayout(args) : v3RangeLayout({ ...args, feeBps: Number(values.feeBps || 30) });
    return l.error ? null : l.bins.length;
  };
  const countAt = (s: number) => (hasRange ? countFor(minP, maxP, s) : null);
  const presetTooWide = (pct: number | null) => {
    if (pct === null || !marketP) return false;
    const n = countFor(snap(marketP * (1 - pct / 100)), snap(marketP * (1 + pct / 100)), step);
    return n !== null && n > maxBins;
  };

  const handles: RangeHandles | undefined = hasRange ? {
    min: minP, max: maxP,
    onChange: (lo, hi) => setRange(lo, hi),
    snap: p => snap(p),
    step: (p, n) => stepOnGrid(p, n, step, dec),
    format: formatPrice,
  } : undefined;

  const moved = marketP && centerP > 0 ? Math.abs(centerP / marketP - 1) > 0.01 : false;
  const recentre = () => {
    if (!marketP || !(centerP > 0) || !hasRange) return;
    const k = marketP / centerP;
    patch({ high: lowEdge(snap(minP * k)), low: highEdge(snap(maxP * k)), center: fmt(marketP) });
  };

  const bins = rangeLayout && !rangeLayout.error ? rangeLayout : null;
  const shape = (values.shape || 'spot') as Shape;
  const strength = (values.strength || 'standard') as Strength;

  return (
    <>
      <StepCard
        id="range"
        title="Price range"
        sub={marketP ? <>Market price 1 BCH = <span className="font-mono text-sky-300">{formatPrice(marketP)}</span> {sym}</> : 'Set the prices by hand: there is no market price for this token'}
      >
        <ChoiceCards
          label="Range width"
          value={preset}
          onChange={id => (id === 'custom' ? document.getElementById('range-min')?.focus() : applyPreset(id))}
          columns={4}
          size="sm"
          options={RANGE_PRESETS.map(r => {
            const tooWide = presetTooWide(r.pct);
            return {
              value: r.id,
              title: r.label,
              line: r.pct !== null ? `±${r.pct}%` : 'Drag or type',
              note: tooWide ? (engine === 'v3' ? `Over ${maxBins} pools on V3${engines.includes('v4') ? ': use V4 bins' : ''}` : `Over ${maxBins} bins: pick a larger step`) : undefined,
              disabled: (r.pct !== null && !marketP) || tooWide,
            };
          })}
        />

        <div className="mt-4 space-y-2">
          <BinChart
            bins={bins?.bins ?? []}
            depth={depthChart}
            marketP={marketP}
            handles={handles}
            symbol={sym}
            height={232}
            ariaLabel={bins ? `${bins.bins.length} ${unit}s from 1 BCH = ${formatPrice(bins.minP)} to ${formatPrice(bins.maxP)} ${sym}` : 'Price range chart'}
            emptyText={rangeLayout?.error ?? 'Set a min and max price'}
          />
          <BinLegend symbol={sym} depth={depthChart.length > 0} />
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <PriceInput
            id="range-min" label="Min price" value={values.high ?? ''} onChange={v => set('high', v)} symbol={sym} decimals={dec} chips={[]}
            accent="token"
            hint={marketP && minP > 0 ? `${signedPct(pctFrom(minP, marketP))} from the market · below it the range holds only ${sym}` : `Fewest ${sym} per BCH`}
            error={hasRange && minP >= maxP ? 'Must be below the max price' : null}
          />
          <PriceInput
            id="range-max" label="Max price" value={values.low ?? ''} onChange={v => set('low', v)} symbol={sym} decimals={dec} chips={[]}
            accent="bch"
            hint={marketP && maxP > 0 ? `${signedPct(pctFrom(maxP, marketP))} from the market · above it the range holds only BCH` : `Most ${sym} per BCH`}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs" aria-live="polite">
          {bins ? (
            <span className="text-zinc-300">
              <span className="font-mono font-semibold text-white">{bins.bins.length}</span> {unit}s ·{' '}
              <span className="text-emerald-300">{bins.bidCount} hold BCH</span> ·{' '}
              <span className="text-cyan-300">{bins.askCount} hold {sym}</span>
              {marketP && <> · range {signedPct(pctFrom(bins.minP, marketP))} to {signedPct(pctFrom(bins.maxP, marketP))}</>}
            </span>
          ) : <span className="text-rose-300">{rangeLayout?.error}</span>}
          <span className="text-zinc-500">Up to {maxBins} {unit}s on {engine === 'v4' ? 'V4' : 'V3'}</span>
        </div>

        {!marketP && (
          <div className="mt-3">
            <PriceInput id="range-center" label="Price to split the range at" value={values.center ?? ''} onChange={v => set('center', v)} symbol={sym} decimals={dec} chips={[]}
              hint={`${unit[0]!.toUpperCase() + unit.slice(1)}s above it start in BCH, ${unit}s below it start in ${sym}.`} />
          </div>
        )}
        {moved && (
          <NoteBox tone="warn" className="mt-3" title="The market moved since this range was set">
            <p>The range is split at 1 BCH = {formatPrice(centerP)} {sym}; the market is now {formatPrice(marketP!)}.</p>
            <LinkButton onClick={recentre} className="mt-1">Re-centre on today's price</LinkButton>
          </NoteBox>
        )}
      </StepCard>

      <StepCard id="shape" title="Shape" sub="How the deposit spreads across the range">
        <ShapePicker
          shape={shape} strength={strength}
          onShape={s => set('shape', s)} onStrength={s => set('strength', s)}
        />
      </StepCard>

      <StepCard
        id="step"
        title={engine === 'v4' ? 'Bin step' : 'Bin step and fee'}
        sub={engine === 'v4'
          ? `Each bin buys at its price and sells one step up: it earns the ${(step / 100).toFixed(step < 100 ? 2 : 0)}% step on every round trip, with no separate fee.`
          : 'Each pool buys at its price, sells one step up, and charges the pool fee on every trade.'}
      >
        <TierChips
          label="Bin step"
          value={String(step)}
          onChange={setStep}
          options={BIN_STEP_CHOICES.map(c => {
            const n = countAt(Number(c.value));
            return {
              value: c.value,
              label: c.label.split(' · ')[0]!,
              hint: n === null ? c.label.split(' · ')[1] : n > maxBins ? `${n} · too many` : `${n} ${unit}${n === 1 ? '' : 's'}`,
            };
          })}
        />
        {engine === 'v3' && (
          <div className="mt-4 space-y-2">
            <div className="text-[11px] font-medium text-zinc-400">Pool fee</div>
            <TierChips
              label="Pool fee"
              value={values.feeBps ?? '30'}
              onChange={v => set('feeBps', v)}
              options={FEE_TIERS.map(t => ({ value: String(t.bps), label: t.label, hint: t.name }))}
            />
          </div>
        )}
      </StepCard>

      <StepCard id="engine" title="Where it lives">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <EngineLine engine={engine} />
          {engines.length > 1 && (
            <LinkButton onClick={() => setEngine(engine === 'v4' ? 'v3' : 'v4')}>
              {engine === 'v4' ? 'Use V3 pools instead' : 'Use V4 bins instead'}
            </LinkButton>
          )}
        </div>
        <p className={cn('mt-2 text-xs text-zinc-400')}>
          {engine === 'v4'
            ? 'The bins trade in place, both ways. Whoever holds the position NFT controls them: sending the NFT sends the position.'
            : 'Each bin is its own pool that only this wallet can withdraw from.'}
        </p>
        {flow.v4Off && (
          <NoteBox tone="info" className="mt-3">V4 bins are not set up on this Mesh server, so this range uses V3 pools.</NoteBox>
        )}
        {flow.replaces && (
          <NoteBox tone="info" className="mt-3">A rebalance stays on V3 pools: one transaction closes the old pools and funds the new ones.</NoteBox>
        )}
      </StepCard>
    </>
  );
}
