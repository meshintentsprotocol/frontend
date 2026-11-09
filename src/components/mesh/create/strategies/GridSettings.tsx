/**
 * Step ② for a grid (MeshDocs/meshv3v4flow/08 §3.2, canvas S4): rungs on a
 * geometric ladder between a min and a max price; each buys at its level and
 * sells one level up. Rungs below the market start in BCH, above it in the
 * token. Drawn from the server's preview (V3 today; V4 bins after phase I7).
 */
import { useMemo } from 'react';
import type { CreateFlow } from '../useCreateFlow';
import { StepCard } from '../CreateShell';
import type { RangeHandles } from '@/components/mesh/charts/BinChart';
import { ChoiceCards, CountStepper, NoteBox, PriceInput, ShapePicker, type Shape, type Strength } from '@/components/mesh/kit';
import { RANGE_PRESETS } from '@/lib/mesh/presets';
import { formatPrice, formatPriceInput, parsePrice, signedPct } from '@/lib/mesh/create/price';
import { EngineCard, FeeCard, PreviewChart, SideCounts, marketSub } from './parts';

const pctFrom = (p: number, m: number) => (p / m - 1) * 100;

export function GridSettings({ flow }: { flow: CreateFlow }) {
  const { values, set, patch, main, marketP } = flow;
  const sym = main.symbol;
  const minP = parsePrice(values.high);
  const maxP = parsePrice(values.low);
  const has = minP > 0 && maxP > 0;
  const rungs = /^\d+$/.test(values.rungs ?? '') ? Number(values.rungs) : 4;

  const preset = useMemo(() => {
    if (!marketP || !has) return 'custom';
    const lo = pctFrom(minP, marketP), hi = pctFrom(maxP, marketP);
    return RANGE_PRESETS.find(r => r.pct !== null && Math.abs(lo + r.pct) <= 0.6 && Math.abs(hi - r.pct) <= 0.6)?.id ?? 'custom';
  }, [marketP, minP, maxP, has]);
  const applyPreset = (id: string) => {
    const r = RANGE_PRESETS.find(x => x.id === id);
    if (!r || r.pct === null || !marketP) return;
    patch({ high: formatPriceInput(marketP * (1 - r.pct / 100)), low: formatPriceInput(marketP * (1 + r.pct / 100)), center: formatPriceInput(marketP) });
  };

  const handles: RangeHandles | undefined = has ? {
    min: minP, max: maxP,
    onChange: (lo, hi) => patch({ high: formatPriceInput(lo), low: formatPriceInput(hi) }),
    format: formatPrice,
  } : undefined;

  return (
    <>
      <StepCard id="rungs" title="Price range and rungs" sub={marketSub(flow)}>
        <ChoiceCards
          label="Range width" value={preset} columns={4} size="sm"
          onChange={id => (id === 'custom' ? document.getElementById('grid-min')?.focus() : applyPreset(id))}
          options={RANGE_PRESETS.map(r => ({ value: r.id, title: r.label, line: r.pct !== null ? `±${r.pct}%` : 'Drag or type', disabled: r.pct !== null && !marketP }))}
        />
        <div className="mt-4"><PreviewChart flow={flow} handles={handles} unit="rung" /></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <PriceInput id="grid-min" label="Min price" value={values.high ?? ''} onChange={v => set('high', v)} symbol={sym} decimals={main.decimals} chips={[]} accent="token"
            hint={marketP && minP > 0 ? `${signedPct(pctFrom(minP, marketP))} from the market` : `Fewest ${sym} per BCH`} />
          <PriceInput id="grid-max" label="Max price" value={values.low ?? ''} onChange={v => set('low', v)} symbol={sym} decimals={main.decimals} chips={[]} accent="bch"
            hint={marketP && maxP > 0 ? `${signedPct(pctFrom(maxP, marketP))} from the market` : `Most ${sym} per BCH`} />
        </div>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <CountStepper label="Rungs" value={rungs} min={2} max={10} onChange={n => set('rungs', String(n))} />
          <SideCounts flow={flow} unit="rung" />
        </div>
        {!marketP && (
          <div className="mt-4 space-y-2">
            <PriceInput id="grid-center" label="Price to split the rungs at" value={values.center ?? ''} onChange={v => set('center', v)} symbol={sym} decimals={main.decimals} chips={[]}
              hint={`Rungs above it start in BCH, rungs below it start in ${sym}.`} />
            {!values.center && <NoteBox tone="warn">Without a market price every rung starts in BCH, so keep the whole range above the price you expect.</NoteBox>}
          </div>
        )}
      </StepCard>

      <StepCard id="shape" title="Shape" sub="How the deposit spreads across the rungs">
        <ShapePicker shape={(values.shape || 'spot') as Shape} strength={(values.strength || 'standard') as Strength}
          onShape={s => set('shape', s)} onStrength={s => set('strength', s)} />
      </StepCard>
      <FeeCard flow={flow} />
      <EngineCard flow={flow} />
    </>
  );
}

export function gridSummary(flow: CreateFlow): string {
  const lo = parsePrice(flow.values.high), hi = parsePrice(flow.values.low);
  return lo > 0 && hi > 0 ? `${flow.values.rungs || 4} rungs · ${formatPrice(lo)} – ${formatPrice(hi)}` : flow.def.settingsHint;
}
