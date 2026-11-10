/**
 * Step ② for multi-pair (MeshDocs/meshv3v4flow/08 §3.8, canvas B3): one shared
 * BCH reserve backing 2–3 tokens, each with its own price against BCH.
 */
import { useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { CreateFlow } from '../useCreateFlow';
import { StepCard } from '../CreateShell';
import { ReserveDiagram, type ReserveRow } from '@/components/mesh/charts/ReserveDiagram';
import { TokenButton } from '../PairPicker';
import { PriceInput } from '@/components/mesh/kit';
import { formatPrice, parsePrice, signedPct, vsMarketPct } from '@/lib/mesh/create/price';
import { EngineCard, FeeCard } from './parts';

export function MultiPairSettings({ flow }: { flow: CreateFlow }) {
  const { values, set, setToken, infoOf, midOf } = flow;

  const t1 = values.token1 || '';
  const t2 = values.token2 || '';
  const t3 = values.token3 || '';
  const has3 = Boolean(values.token3 !== undefined && values.token3 !== '');

  const info1 = infoOf(t1);
  const info2 = infoOf(t2);
  const info3 = infoOf(t3);

  const mid1 = midOf(t1);
  const mid2 = midOf(t2);
  const mid3 = midOf(t3);

  const p1 = parsePrice(values.price1);
  const p2 = parsePrice(values.price2);
  const p3 = parsePrice(values.price3);

  const vs1 = vsMarketPct(values.price1, info1.decimals, mid1);
  const vs2 = vsMarketPct(values.price2, info2.decimals, mid2);
  const vs3 = vsMarketPct(values.price3, info3.decimals, mid3);

  const rows: ReserveRow[] = useMemo(() => {
    const list: ReserveRow[] = [];
    if (t1) {
      list.push({
        key: 't1',
        info: info1,
        priceText: p1 > 0 ? `1 BCH = ${formatPrice(p1)} ${info1.symbol}` : 'Set price',
        vsText: vs1 !== null ? `${signedPct(vs1)} vs market` : null,
      });
    }
    if (t2) {
      list.push({
        key: 't2',
        info: info2,
        priceText: p2 > 0 ? `1 BCH = ${formatPrice(p2)} ${info2.symbol}` : 'Set price',
        vsText: vs2 !== null ? `${signedPct(vs2)} vs market` : null,
      });
    }
    if (has3 && t3) {
      list.push({
        key: 't3',
        info: info3,
        priceText: p3 > 0 ? `1 BCH = ${formatPrice(p3)} ${info3.symbol}` : 'Set price',
        vsText: vs3 !== null ? `${signedPct(vs3)} vs market` : null,
      });
    }
    return list;
  }, [t1, t2, t3, has3, info1, info2, info3, p1, p2, p3, vs1, vs2, vs3]);

  const addToken3 = () => {
    set('token3', '');
  };

  const removeToken3 = () => {
    set('token3', '');
    set('price3', '');
  };

  return (
    <>
      <StepCard id="reserve" title="One BCH reserve, multiple tokens" sub="The same BCH backs all markets; when one fills, the reserve shrinks for all of them.">
        <ReserveDiagram
          reserveText={values.depositBch ? `${values.depositBch} BCH` : null}
          rows={rows}
          className="mb-4"
        />

        <div className="space-y-4">
          {/* Token 1 */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-400">Token 1</span>
              <TokenButton value={t1} info={info1} onPick={c => setToken('token1', c)} label="Choose token 1" size="sm" />
            </div>
            <PriceInput
              id="multi-price-1"
              label={`Price for ${info1.symbol}`}
              value={values.price1 ?? ''}
              onChange={v => set('price1', v)}
              symbol={info1.symbol}
              decimals={info1.decimals}
              midSatsPerUnit={mid1}
              accent="token"
              hint={mid1 ? `1 BCH = market ${formatPrice(mid1 ? 1e8 / Number(mid1) : 0)} ${info1.symbol}` : `Enter ${info1.symbol} per 1 BCH`}
            />
          </div>

          {/* Token 2 */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-400">Token 2</span>
              <TokenButton value={t2} info={info2} onPick={c => setToken('token2', c)} label="Choose token 2" size="sm" />
            </div>
            <PriceInput
              id="multi-price-2"
              label={`Price for ${info2.symbol}`}
              value={values.price2 ?? ''}
              onChange={v => set('price2', v)}
              symbol={info2.symbol}
              decimals={info2.decimals}
              midSatsPerUnit={mid2}
              accent="token"
              hint={mid2 ? `1 BCH = market ${formatPrice(mid2 ? 1e8 / Number(mid2) : 0)} ${info2.symbol}` : `Enter ${info2.symbol} per 1 BCH`}
            />
          </div>

          {/* Token 3 (optional) */}
          {has3 ? (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-400">Token 3 (optional)</span>
                <div className="flex items-center gap-2">
                  <TokenButton value={t3} info={info3} onPick={c => setToken('token3', c)} label="Choose token 3" size="sm" />
                  <button
                    type="button"
                    onClick={removeToken3}
                    aria-label="Remove token 3"
                    className="p-2 text-zinc-500 hover:text-rose-400 transition"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <PriceInput
                id="multi-price-3"
                label={`Price for ${info3.symbol}`}
                value={values.price3 ?? ''}
                onChange={v => set('price3', v)}
                symbol={info3.symbol}
                decimals={info3.decimals}
                midSatsPerUnit={mid3}
                accent="token"
                hint={mid3 ? `1 BCH = market ${formatPrice(mid3 ? 1e8 / Number(mid3) : 0)} ${info3.symbol}` : `Enter ${info3.symbol} per 1 BCH`}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={addToken3}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 p-3 text-xs font-semibold text-zinc-300 hover:border-white/30 hover:text-white transition"
            >
              <Plus className="h-4 w-4" /> Add a 3rd token
            </button>
          )}
        </div>
      </StepCard>

      <FeeCard flow={flow} />
      <EngineCard flow={flow} />
    </>
  );
}

export function multiPairSummary(flow: CreateFlow): string {
  const count = [flow.values.token1, flow.values.token2, flow.values.token3].filter(Boolean).length;
  return count >= 2 ? `${count} tokens on 1 BCH reserve` : flow.def.settingsHint;
}
