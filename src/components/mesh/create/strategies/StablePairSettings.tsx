/**
 * Step ② for a pegged pair (MeshDocs/meshv3v4flow/08 §3.9, canvas S6): two tokens
 * trading near a fixed peg (1 A = x B) with a spread each side and a low fee.
 */
import { useMemo } from 'react';
import type { CreateFlow } from '../useCreateFlow';
import { StepCard } from '../CreateShell';
import { TokenButton } from '../PairPicker';
import { PriceLine, type PriceMarker } from '@/components/mesh/charts/PriceLine';
import { TierChips } from '@/components/mesh/kit';
import { EngineCard, FeeCard } from './parts';
import { parsePrice } from '@/lib/mesh/create/price';

const SPREAD_PRESETS = [
  { value: '5', label: '0.05%', hint: 'Tight' },
  { value: '10', label: '0.10%', hint: 'Balanced' },
  { value: '20', label: '0.20%', hint: 'Standard' },
  { value: '50', label: '0.50%', hint: 'Wide' },
];

export function StablePairSettings({ flow }: { flow: CreateFlow }) {
  const { values, set, patch, setToken, infoOf, midOf } = flow;

  const tA = values.tokenA || '';
  const tB = values.tokenB || '';
  const infoA = infoOf(tA);
  const infoB = infoOf(tB);

  const rateNum = parsePrice(values.rate);
  const spreadBps = /^\d+$/.test(values.spreadBps ?? '') ? Number(values.spreadBps) : 20;
  const spreadPct = spreadBps / 100;

  // Derive market rate from BCH mid prices if both exist
  const midA = midOf(tA);
  const midB = midOf(tB);
  const marketRate = useMemo(() => {
    if (!midA || !midB || midA <= 0 || midB <= 0) return null;
    // mid is sats per token base unit
    // (sats / tokenA_unit) / (sats / tokenB_unit) = tokenB_units / tokenA_unit
    const satsPerA = midA * 10 ** infoA.decimals;
    const satsPerB = midB * 10 ** infoB.decimals;
    return satsPerA / satsPerB;
  }, [midA, midB, infoA.decimals, infoB.decimals]);

  const useMarket = () => {
    if (marketRate && marketRate > 0) {
      set('rate', marketRate >= 1 ? marketRate.toFixed(4).replace(/\.?0+$/, '') : marketRate.toPrecision(4));
    }
  };

  // Price markers around the peg
  const markers: PriceMarker[] = [];
  let band: { from: number; to: number; label?: string } | null = null;
  if (rateNum > 0) {
    const buyPrice = rateNum * (1 - spreadBps / 10000);
    const sellPrice = rateNum * (1 + spreadBps / 10000);
    markers.push({ key: 'peg', p: rateNum, label: 'Peg', tone: 'muted', dashed: true });
    markers.push({ key: 'buy', p: buyPrice, label: `Get ${infoA.symbol}`, tone: 'token' });
    markers.push({ key: 'sell', p: sellPrice, label: `Give ${infoA.symbol}`, tone: 'bch' });
    band = {
      from: buyPrice,
      to: sellPrice,
      label: `${(spreadPct * 2).toFixed(2)}% total spread`,
    };
  }

  return (
    <>
      <StepCard id="tokens" title="The two pegged tokens" sub="Tokens that should trade near a fixed rate (e.g. stablecoins or wrapped assets).">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-2">
            <span className="text-xs font-semibold text-zinc-400">Token A (Base)</span>
            <div>
              <TokenButton value={tA} info={infoA} onPick={c => setToken('tokenA', c)} label="Choose token A" />
            </div>
          </div>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-2">
            <span className="text-xs font-semibold text-zinc-400">Token B (Quote)</span>
            <div>
              <TokenButton value={tB} info={infoB} onPick={c => setToken('tokenB', c)} label="Choose token B" />
            </div>
          </div>
        </div>
      </StepCard>

      <StepCard id="rate" title="Peg rate and spread">
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="stable-rate" className="text-xs font-medium text-zinc-300">
                1 {infoA.symbol} =
              </label>
              {marketRate && (
                <button
                  type="button"
                  onClick={useMarket}
                  className="text-xs text-emerald-400 hover:text-emerald-300 transition"
                >
                  Use market ({marketRate >= 1 ? marketRate.toFixed(4) : marketRate.toPrecision(4)} {infoB.symbol})
                </button>
              )}
            </div>
            <div className="relative flex items-center">
              <input
                id="stable-rate"
                type="text"
                inputMode="decimal"
                value={values.rate ?? ''}
                onChange={e => set('rate', e.target.value)}
                placeholder="1.00"
                className="h-12 w-full rounded-2xl border border-white/10 bg-zinc-900/80 px-4 font-mono text-base text-white outline-none placeholder:text-zinc-600 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
              />
              <span className="absolute right-4 font-mono text-sm text-zinc-400">
                {infoB.symbol}
              </span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-zinc-300">Spread each side</span>
              <span className="font-mono text-xs text-emerald-400">±{spreadPct.toFixed(2)}%</span>
            </div>
            <TierChips
              label="Spread"
              value={String(spreadBps)}
              onChange={v => set('spreadBps', v)}
              options={SPREAD_PRESETS}
            />
          </div>

          {rateNum > 0 && (
            <PriceLine
              markers={markers}
              band={band}
              ariaLabel={`Peg at 1 ${infoA.symbol} = ${rateNum} ${infoB.symbol} with ±${spreadPct.toFixed(2)}% spread`}
              format={p => (p >= 1000 ? p.toFixed(0) : p >= 1 ? p.toFixed(4) : p.toPrecision(4))}
            />
          )}
        </div>
      </StepCard>

      <FeeCard flow={flow} sub="Charged to the trader on every swap (suggested: 0.10% for pegged pairs)." />
      <EngineCard flow={flow} />
    </>
  );
}

export function stablePairSummary(flow: CreateFlow): string {
  const r = parsePrice(flow.values.rate);
  const a = flow.symbolOfKey('tokenA');
  const b = flow.symbolOfKey('tokenB');
  return r > 0 ? `1 ${a} = ${r} ${b} (±${((Number(flow.values.spreadBps || 20)) / 100).toFixed(2)}%)` : flow.def.settingsHint;
}
