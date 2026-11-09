/**
 * Step ② for the two-price strategies (MeshDocs/meshv3v4flow/08 §3.3, §3.7;
 * canvas S2, S3):
 * - Spread: a buy below the market and a sell above it; with "Keep in Mesh"
 *   each side's proceeds fund the other.
 * - Recycling pair: one pool that buys at one price, sells at the other, and
 *   flips back after every fill; it starts with BCH or with the token.
 */
import type { CreateFlow } from '../useCreateFlow';
import { StepCard } from '../CreateShell';
import { PriceLine, type PriceMarker } from '@/components/mesh/charts/PriceLine';
import { ChoiceCards, PriceInput, TierChips } from '@/components/mesh/kit';
import { formatPrice, formatPriceInput, parsePrice, priceAtPct } from '@/lib/mesh/create/price';
import { gapPct } from '@/lib/mesh/create/checks';
import { EngineCard, FeeCard, ProceedsCard, marketSub } from './parts';

/** half-gaps around the market (token price ±%) */
const GAPS = [
  { value: '0.5', label: '±0.5%', hint: 'Tight' },
  { value: '1', label: '±1%', hint: 'Balanced' },
  { value: '2.5', label: '±2.5%', hint: 'Wide' },
];

function keysOf(flow: CreateFlow) {
  return flow.strategy === 'spread' ? { buy: 'bid', sell: 'ask' } : { buy: 'buy', sell: 'sell' };
}

export function TwoPriceSettings({ flow }: { flow: CreateFlow }) {
  const { values, set, patch, main, mainMid } = flow;
  const sym = main.symbol;
  const k = keysOf(flow);
  const buyP = parsePrice(values[k.buy]);
  const sellP = parsePrice(values[k.sell]);
  const gap = gapPct(buyP, sellP);
  const spread = flow.strategy === 'spread';

  // which gap preset the prices match, if any
  const activeGap = (() => {
    if (!mainMid || !(buyP > 0 && sellP > 0)) return null;
    return GAPS.find(g => {
      const pct = Number(g.value);
      const bp = priceAtPct(mainMid, main.decimals, -pct), sp = priceAtPct(mainMid, main.decimals, pct);
      return Math.abs(bp / buyP - 1) < 0.0015 && Math.abs(sp / sellP - 1) < 0.0015;
    })?.value ?? null;
  })();
  const applyGap = (v: string) => {
    if (!mainMid) return;
    const pct = Number(v);
    patch({ [k.buy]: formatPriceInput(priceAtPct(mainMid, main.decimals, -pct)), [k.sell]: formatPriceInput(priceAtPct(mainMid, main.decimals, pct)) });
  };

  const markers: PriceMarker[] = [];
  if (buyP > 0) markers.push({ key: 'buy', p: buyP, label: 'Buy', tone: 'bch' });
  if (sellP > 0) markers.push({ key: 'sell', p: sellP, label: 'Sell', tone: 'token' });

  return (
    <>
      <StepCard id="prices" title={spread ? 'Buy and sell price' : 'The two prices'} sub={marketSub(flow)}>
        {mainMid ? (
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <span className="text-xs font-medium text-zinc-400">Around the market</span>
            <TierChips label="Gap around the market" className="min-w-[240px] flex-1" value={activeGap} onChange={applyGap} options={GAPS} />
          </div>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <PriceInput id="two-buy" label={`Buy ${sym} at`} value={values[k.buy] ?? ''} onChange={v => set(k.buy, v)}
            symbol={sym} decimals={main.decimals} midSatsPerUnit={mainMid} accent="bch"
            hint={`More ${sym} per BCH than the sell price.`} />
          <PriceInput id="two-sell" label={`Sell ${sym} at`} value={values[k.sell] ?? ''} onChange={v => set(k.sell, v)}
            symbol={sym} decimals={main.decimals} midSatsPerUnit={mainMid} accent="token"
            hint={`Fewer ${sym} per BCH than the buy price.`} />
        </div>
        <PriceLine className="mt-3" markers={markers} marketP={flow.marketP} format={formatPrice}
          band={buyP > 0 && sellP > 0 && buyP > sellP ? { from: sellP, to: buyP, label: gap !== null ? `${gap.toFixed(2)}% per round trip` : undefined } : null}
          ariaLabel={buyP > 0 && sellP > 0 ? `Buys at 1 BCH = ${formatPrice(buyP)} and sells at ${formatPrice(sellP)} ${sym}` : 'Buy and sell price against the market'} />
        {gap !== null && gap > 0 && (
          <p className="mt-2 text-xs text-zinc-300">Earns <span className="font-mono text-emerald-300">{gap.toFixed(2)}%</span> on every buy-then-sell, plus the pool fee on both trades.</p>
        )}
      </StepCard>

      {spread ? (
        <ProceedsCard
          flow={flow}
          wallet={{ title: 'Send to my wallet', line: `Each side pays its proceeds to this wallet and stops when its own deposit is used.` }}
          recycle={{ title: 'Keep in Mesh', line: `What the buy side gets funds the sell side and back, so the spread keeps trading.` }}
        />
      ) : (
        <StepCard id="start" title="Start with" sub="The pool holds one asset at a time and flips after every fill.">
          <ChoiceCards
            label="Start with"
            value={values.start === 'token' ? 'token' : 'bch'}
            onChange={v => set('start', v)}
            options={[
              { value: 'bch', title: 'BCH: buy first', line: `It waits to buy ${sym} at your buy price.` },
              { value: 'token', title: `${sym}: sell first`, line: `It waits to sell ${sym} at your sell price.` },
            ]}
          />
        </StepCard>
      )}
      <FeeCard flow={flow} />
      <EngineCard flow={flow} />
    </>
  );
}

export function twoPriceSummary(flow: CreateFlow): string {
  const k = keysOf(flow);
  const b = parsePrice(flow.values[k.buy]), s = parsePrice(flow.values[k.sell]);
  const g = gapPct(b, s);
  return b > 0 && s > 0 ? `${formatPrice(b)} / ${formatPrice(s)}${g !== null && g > 0 ? ` · ${g.toFixed(1)}% gap` : ''}` : flow.def.settingsHint;
}
