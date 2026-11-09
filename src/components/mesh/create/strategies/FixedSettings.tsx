/**
 * Step ② for a fixed price (MeshDocs/meshv3v4flow/08 §3.6, canvas S1): buy or
 * sell, one price against the market, where proceeds go (with the trade-back
 * price when they stay in Mesh), and the fee.
 */
import type { CreateFlow } from '../useCreateFlow';
import { StepCard } from '../CreateShell';
import { PriceLine, type PriceMarker } from '@/components/mesh/charts/PriceLine';
import { ChoiceCards, PriceInput } from '@/components/mesh/kit';
import { formatPrice, parsePrice } from '@/lib/mesh/create/price';
import { EngineCard, FeeCard, ProceedsCard, marketSub } from './parts';

export function FixedSettings({ flow }: { flow: CreateFlow }) {
  const { values, set, main, mainMid } = flow;
  const sym = main.symbol;
  const buy = values.side !== 'ask';
  const price = parsePrice(values.price);
  const back = parsePrice(values.recyclePrice);
  const recycle = values.proceeds === 'recycle';

  const markers: PriceMarker[] = [];
  if (price > 0) markers.push({ key: 'price', p: price, label: buy ? 'Buy' : 'Sell', tone: buy ? 'bch' : 'token' });
  if (recycle && back > 0) markers.push({ key: 'back', p: back, label: 'Trade back', tone: 'muted', dashed: true });

  return (
    <>
      <StepCard id="side" title="Buy or sell" sub={marketSub(flow)}>
        <ChoiceCards
          label="Side"
          value={buy ? 'bid' : 'ask'}
          onChange={v => set('side', v)}
          options={[
            { value: 'bid', title: `Buy ${sym} with BCH`, line: `Holds BCH. Fills when someone sells ${sym} at your price.` },
            { value: 'ask', title: `Sell ${sym} for BCH`, line: `Holds ${sym}. Fills when someone buys it at your price.` },
          ]}
        />
      </StepCard>

      <StepCard id="price" title="Your price">
        <PriceInput
          id="fixed-price" label={buy ? `Buy ${sym} at` : `Sell ${sym} at`} value={values.price ?? ''} onChange={v => set('price', v)}
          symbol={sym} decimals={main.decimals} midSatsPerUnit={mainMid} accent={buy ? 'bch' : 'token'}
          hint={buy ? `More ${sym} per BCH than the market means you buy cheaper.` : `Fewer ${sym} per BCH than the market means you sell dearer.`}
        />
        <PriceLine className="mt-3" markers={markers} marketP={flow.marketP} format={formatPrice}
          ariaLabel={price > 0 ? `${buy ? 'Buy' : 'Sell'} at 1 BCH = ${formatPrice(price)} ${sym}` : 'Your price against the market'} />
      </StepCard>

      <ProceedsCard
        flow={flow}
        wallet={{ title: 'Send to my wallet', line: buy ? `The ${sym} you buy goes straight to this wallet. The order ends when its BCH is used up.` : `The BCH you receive goes straight to this wallet. The order ends when its ${sym} is sold.` }}
        recycle={{ title: 'Keep in Mesh', line: buy ? `What you buy opens a sell order at the trade-back price, so the liquidity keeps trading.` : `What you receive opens a buy order at the trade-back price, so the liquidity keeps trading.` }}
      />
      {recycle && (
        <StepCard id="back" title="Trade-back price" sub={buy ? `Where it sells the ${sym} back: dearer than your buy, so fewer ${sym} per BCH.` : `Where it buys ${sym} back: cheaper than your sell, so more ${sym} per BCH.`}>
          <PriceInput
            id="fixed-back" label="Trade back at" value={values.recyclePrice ?? ''} onChange={v => set('recyclePrice', v)}
            symbol={sym} decimals={main.decimals} midSatsPerUnit={mainMid} accent={buy ? 'token' : 'bch'}
          />
        </StepCard>
      )}
      <FeeCard flow={flow} />
      <EngineCard flow={flow} />
    </>
  );
}

export function fixedSummary(flow: CreateFlow): string {
  const p = parsePrice(flow.values.price);
  return p > 0 ? `${flow.values.side === 'ask' ? 'Sell' : 'Buy'} at ${formatPrice(p)}` : flow.def.settingsHint;
}
