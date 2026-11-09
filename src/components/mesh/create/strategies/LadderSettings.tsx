/**
 * Step ② for the one-way ladders (MeshDocs/meshv3v4flow/08 §3.4–3.5, canvas
 * B2 / S5):
 * - Sell as the price rises (take-profit): token sells that get dearer, left
 *   of the market (fewer tokens per BCH).
 * - Buy as the price falls (accumulate): BCH buys that get cheaper, right of
 *   the market (more tokens per BCH).
 * First and last price, steps, shape, and where proceeds go.
 */
import type { CreateFlow } from '../useCreateFlow';
import { StepCard } from '../CreateShell';
import type { RangeHandles } from '@/components/mesh/charts/BinChart';
import { ChoiceCards, CountStepper, PriceInput, ShapePicker, type Shape, type Strength } from '@/components/mesh/kit';
import { formatPrice, formatPriceInput, parsePrice, priceAtPct, signedPct, vsMarketPct } from '@/lib/mesh/create/price';
import { EngineCard, FeeCard, PreviewChart, ProceedsCard, marketSub } from './parts';

/** the last step's distance from the market (token price %); the first is always 2% */
const REACH = [
  { id: 'near', title: 'Near', pct: 5 },
  { id: 'balanced', title: 'Balanced', pct: 15 },
  { id: 'far', title: 'Far', pct: 40 },
] as const;

export function LadderSettings({ flow }: { flow: CreateFlow }) {
  const { values, set, patch, main, mainMid } = flow;
  const sym = main.symbol;
  const sells = flow.strategy === 'take-profit';
  const sign = sells ? 1 : -1;
  const first = parsePrice(values.from);
  const last = parsePrice(values.to);
  const steps = /^\d+$/.test(values.steps ?? '') ? Number(values.steps) : 4;

  const reach = (() => {
    if (!mainMid || !(first > 0 && last > 0)) return null;
    const f = vsMarketPct(values.from, main.decimals, mainMid), l = vsMarketPct(values.to, main.decimals, mainMid);
    if (f === null || l === null || Math.abs(f - 2 * sign) > 0.3) return null;
    return REACH.find(r => Math.abs(l - r.pct * sign) <= 0.5)?.id ?? null;
  })();
  const applyReach = (id: string) => {
    const r = REACH.find(x => x.id === id);
    if (!r || !mainMid) return;
    patch({ from: formatPriceInput(priceAtPct(mainMid, main.decimals, 2 * sign)), to: formatPriceInput(priceAtPct(mainMid, main.decimals, r.pct * sign)) });
  };

  // take-profit runs left (first = the right end), accumulate runs right (first = the left end)
  const handles: RangeHandles | undefined = first > 0 && last > 0 ? {
    min: sells ? last : first,
    max: sells ? first : last,
    onChange: (lo, hi) => patch(sells ? { to: formatPriceInput(lo), from: formatPriceInput(hi) } : { from: formatPriceInput(lo), to: formatPriceInput(hi) }),
    format: formatPrice,
  } : undefined;

  const noun = sells ? 'sell' : 'buy';
  return (
    <>
      <StepCard id="ladder" title={sells ? 'Sell ladder' : 'Buy ladder'} sub={marketSub(flow)}>
        {mainMid && (
          <ChoiceCards
            label="How far it reaches" value={reach} columns={3} size="sm" onChange={applyReach}
            options={REACH.map(r => ({ value: r.id, title: r.title, line: `${sells ? 'Sells' : 'Buys'} from ${sells ? '+' : '−'}2% to ${sells ? '+' : '−'}${r.pct}%` }))}
          />
        )}
        <div className="mt-4"><PreviewChart flow={flow} handles={handles} unit="step" /></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <PriceInput id="ladder-first" label={`First ${noun}`} value={values.from ?? ''} onChange={v => set('from', v)} symbol={sym} decimals={main.decimals} midSatsPerUnit={mainMid}
            accent={sells ? 'token' : 'bch'} hint={sells ? 'The nearest step: the first to sell as the price rises.' : 'The nearest step: the first to buy as the price falls.'} />
          <PriceInput id="ladder-last" label={`Last ${noun}`} value={values.to ?? ''} onChange={v => set('to', v)} symbol={sym} decimals={main.decimals} midSatsPerUnit={mainMid}
            accent={sells ? 'token' : 'bch'} hint={sells ? `The dearest step: fewer ${sym} per BCH than the first.` : `The cheapest step: more ${sym} per BCH than the first.`} />
        </div>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <CountStepper label="Steps" value={steps} min={2} max={10} onChange={n => set('steps', String(n))} />
          {mainMid && first > 0 && last > 0 && (
            <p className="text-xs text-zinc-300">
              {steps} {noun}s from <span className="font-mono">{signedPct(vsMarketPct(values.from, main.decimals, mainMid) ?? 0)}</span> to{' '}
              <span className="font-mono">{signedPct(vsMarketPct(values.to, main.decimals, mainMid) ?? 0)}</span> ({sym} price vs market)
            </p>
          )}
        </div>
      </StepCard>

      <StepCard id="shape" title="Shape" sub="How the deposit spreads across the steps">
        <ShapePicker shape={(values.shape || 'spot') as Shape} strength={(values.strength || 'standard') as Strength}
          onShape={s => set('shape', s)} onStrength={s => set('strength', s)} />
      </StepCard>
      <ProceedsCard
        flow={flow}
        wallet={sells
          ? { title: 'Send BCH to my wallet', line: 'Each step that sells pays its BCH straight to this wallet. Sold tokens are not bought back.' }
          : { title: `Send ${sym} to my wallet`, line: `Each step that buys sends its ${sym} straight to this wallet. Bought tokens are not sold back.` }}
        recycle={sells
          ? { title: 'Keep in Mesh', line: 'Each step that sells opens a buy one step lower, so it can sell again if the price comes back.' }
          : { title: 'Keep in Mesh', line: 'Each step that buys opens a sell one step higher, so it can buy again if the price comes back.' }}
      />
      <FeeCard flow={flow} />
      <EngineCard flow={flow} />
    </>
  );
}

export function ladderSummary(flow: CreateFlow): string {
  const f = parsePrice(flow.values.from), l = parsePrice(flow.values.to);
  const noun = flow.strategy === 'take-profit' ? 'sells' : 'buys';
  return f > 0 && l > 0 ? `${flow.values.steps || 4} ${noun} · ${formatPrice(f)} → ${formatPrice(l)}` : flow.def.settingsHint;
}
