/**
 * Simple mode (MeshDocs/meshv3v4flow/09 §3.1, canvas F): one narrow card stack
 * like /borrow — pair, goal, width, one amount, sign. It builds the same params
 * as the full flow (Spot shape, the suggested bin step, server defaults) and
 * signs through the same deploy hooks.
 */
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BarChart3, TrendingDown, TrendingUp } from 'lucide-react';
import { AmountCard, BigButton, ChoiceCards, EngineLine, NoteBox, PageHeader, SummaryRows, type SummaryRow } from '@/components/mesh/kit';
import { formatUnits, formatUsd } from '@/lib/mesh/format';
import { toBaseUnits } from '@/lib/mesh/v3/strategyForms';
import { formatPrice, formatPriceEdge, formatPriceInput, parsePrice, priceAtPct, satsFromTokensPerBch } from '@/lib/mesh/create/price';
import { snapToGrid, v3RangeLayout, V3_MAX_RANGE_BINS } from '@/lib/mesh/create/layout';
import { meshPaths } from '@/lib/mesh/routes';
import type { StrategyId } from '@/lib/mesh/create/registry';
import { useCreateFlow } from './useCreateFlow';
import { PairPicker } from './PairPicker';
import { MarketStrip } from './MarketStrip';
import { SignFlow } from './SignFlow';
import { SuccessView } from './SuccessView';
import { depositTotals } from './CreateSummary';
import { ModeSwitch } from './PairGoalStep';
import type { CreateMode } from './mode';

type SimpleGoal = 'range' | 'up' | 'down';
type Width = 'tight' | 'balanced' | 'wide';

const GOALS: Array<{ id: SimpleGoal; strategy: StrategyId; name: string; line: string; Icon: typeof BarChart3 }> = [
  { id: 'range', strategy: 'range', name: 'Earn fees in a range', line: 'Buys below the price and sells above it, again and again.', Icon: BarChart3 },
  { id: 'up', strategy: 'take-profit', name: 'Sell as the price rises', line: 'Sells your tokens in steps on the way up.', Icon: TrendingUp },
  { id: 'down', strategy: 'accumulate', name: 'Buy as the price falls', line: 'Buys the token in steps on the way down.', Icon: TrendingDown },
];

/** range: ± around the market; ladders: the last step's distance (the first is 2% from the market) */
const WIDTHS: Record<SimpleGoal, Array<{ id: Width; label: string; pct: number; line: string }>> = {
  range: [
    { id: 'tight', label: 'Tight', pct: 1.5, line: '±1.5% · earns most while the price is calm' },
    { id: 'balanced', label: 'Balanced', pct: 5, line: '±5% · a good default' },
    { id: 'wide', label: 'Wide', pct: 15, line: '±15% · rarely leaves the range' },
  ],
  up: [
    { id: 'tight', label: 'Soon', pct: 5, line: 'Sells from +2% to +5%' },
    { id: 'balanced', label: 'In steps', pct: 15, line: 'Sells from +2% to +15%' },
    { id: 'wide', label: 'High', pct: 40, line: 'Sells from +2% to +40%' },
  ],
  down: [
    { id: 'tight', label: 'Soon', pct: 5, line: 'Buys from −2% to −5%' },
    { id: 'balanced', label: 'In steps', pct: 15, line: 'Buys from −2% to −15%' },
    { id: 'wide', label: 'Deep', pct: 40, line: 'Buys from −2% to −40%' },
  ],
};

export function SimpleCreate({ token, mode, onMode }: { token: string; mode: CreateMode; onMode: (m: CreateMode) => void }) {
  const [goal, setGoal] = useState<SimpleGoal>('range');
  const [width, setWidth] = useState<Width>('balanced');
  const strategy = GOALS.find(g => g.id === goal)!.strategy;
  return (
    <SimpleFlow key={`${strategy}:${token}`} strategy={strategy} token={token} goal={goal} onGoal={setGoal}
      width={width} onWidth={setWidth} mode={mode} onMode={onMode} />
  );
}

function SimpleFlow({ strategy, token, goal, onGoal, width, onWidth, mode, onMode }: {
  strategy: StrategyId; token: string; goal: SimpleGoal; onGoal: (g: SimpleGoal) => void;
  width: Width; onWidth: (w: Width) => void; mode: CreateMode; onMode: (m: CreateMode) => void;
}) {
  const [, setParams] = useSearchParams();
  const flow = useCreateFlow({ strategy, token, simple: true });
  const [signOpen, setSignOpen] = useState(false);
  const { main, marketP, mainMid, values, patch, engine } = flow;
  const dec = main.decimals;
  const step = Number(values.binStepBps || 100);

  // V3 holds at most 20 pools: a width that needs more is only on V4
  const tooWide = (pct: number) => {
    if (goal !== 'range' || engine === 'v4' || !marketP || !mainMid) return false;
    const s = (p: number) => satsFromTokensPerBch(snapToGrid(p, step, dec), dec);
    const l = v3RangeLayout({ lowSats: s(marketP * (1 + pct / 100)) * (1 - 1e-9), highSats: s(marketP * (1 - pct / 100)) * (1 + 1e-9), centerSats: mainMid, stepBps: step, decimals: dec, maxBins: 10_000 });
    return !l.error && l.bins.length > V3_MAX_RANGE_BINS;
  };

  const apply = (w: Width) => {
    const spec = WIDTHS[goal].find(x => x.id === w)!;
    if (!marketP || !mainMid) return;
    const fmt = formatPriceInput;
    if (goal === 'range') {
      const snap = (p: number) => snapToGrid(p, step, dec);
      // edges rounded outward so the outermost grid level stays in the range
      patch({ low: formatPriceEdge(snap(marketP * (1 + spec.pct / 100)), 'up'), high: formatPriceEdge(snap(marketP * (1 - spec.pct / 100)), 'down'), center: fmt(marketP), shape: 'spot' });
    } else {
      const sign = goal === 'up' ? 1 : -1;
      patch({ from: fmt(priceAtPct(mainMid, dec, 2 * sign)), to: fmt(priceAtPct(mainMid, dec, spec.pct * sign)), steps: '4', shape: 'spot', proceeds: 'wallet' });
    }
  };
  // apply the chosen width once the market is known and whenever the choice changes (not on every price tick)
  const applied = useRef<string>('');
  useEffect(() => {
    const k = `${goal}:${width}:${step}`;
    if (!marketP || applied.current === k) return;
    applied.current = k;
    apply(width);
  }, [goal, width, marketP, step]); // eslint-disable-line react-hooks/exhaustive-deps

  const pickToken = (cat: string) => setParams(prev => { const n = new URLSearchParams(prev); n.set('token', cat); return n; }, { replace: true });

  // one amount: BCH for a range (the token side follows) or a ladder that buys; the token for one that sells
  const card = flow.cards.find(c => (goal === 'up' ? c.asset !== 'bch' : c.asset === 'bch')) ?? flow.cards[0];
  const other = flow.twoSided ? flow.cards.find(c => c.key !== card?.key) : undefined;
  const bal = card && flow.balances ? (card.asset === 'bch' ? flow.balances.sats : flow.balances.tokens[values[card.asset] ?? ''] ?? 0n) : null;
  let otherUnits = 0n;
  try { otherUnits = other ? toBaseUnits(values[other.key] ?? '', flow.decOfCard(other)) : 0n; } catch { /* shown as 0 */ }
  const otherBal = other && flow.balances ? flow.balances.tokens[values[other.asset] ?? ''] ?? 0n : null;
  const amountErr = (() => {
    if (!card) return null;
    try {
      const u = toBaseUnits(values[card.key] ?? '', flow.decOfCard(card));
      if (bal !== null && u > bal) return 'More than your balance';
    } catch { return `At most ${flow.decOfCard(card)} decimals`; }
    return null;
  })();

  const totals = depositTotals(flow);
  const l = flow.rangeLayout && !flow.rangeLayout.error ? flow.rangeLayout : null;
  const from = parsePrice(values.from), to = parsePrice(values.to);
  const rows: Array<SummaryRow | null> = goal === 'range'
    ? [
      l ? { label: 'Range', value: `${formatPrice(l.minP)} – ${formatPrice(l.maxP)} ${main.symbol}` } : null,
      l ? { label: engine === 'v4' ? 'Bins' : 'Pools', value: `${l.bins.length} (${l.bidCount} BCH · ${l.askCount} ${main.symbol})` } : null,
      { label: 'Earns', value: engine === 'v4' ? `${step / 100}% per round trip` : `${step / 100}% + ${(Number(values.feeBps || 30) / 100).toFixed(2)}% fee` },
    ]
    : [
      from > 0 && to > 0 ? { label: goal === 'up' ? 'Sells' : 'Buys', value: `4 steps, 1 BCH = ${formatPrice(from)} → ${formatPrice(to)} ${main.symbol}` } : null,
      { label: 'Proceeds', value: goal === 'up' ? 'BCH to your wallet' : `${main.symbol} to your wallet` },
    ];
  rows.push({ label: 'You deposit', value: totals.text || '—', strong: !!totals.text });
  if (totals.usd !== null) rows.push({ label: 'Value', value: formatUsd(totals.usd), tone: 'muted' });

  const d = flow.deploy;
  const label = !flow.wallet.signer ? 'Connect a wallet'
    : !(values[card?.key ?? ''] ?? '').trim() ? 'Enter an amount'
    : amountErr ?? (d.validation ? (/^Not enough/.test(d.validation) ? d.validation.replace(/ \(.*\)$/, '') : "Can't create yet") : !d.verified?.ok ? 'Checking…' : 'Review and sign');

  if (flow.created) {
    return <div className="mx-auto w-full max-w-[1200px] px-4 py-6 md:px-8"><SuccessView flow={flow} /></div>;
  }

  return (
    <div className="mx-auto w-full max-w-[520px] space-y-4 px-4 py-4 sm:py-6">
      <PageHeader back={{ to: meshPaths.positions(), label: 'My positions' }} title="New position" actions={<ModeSwitch mode={mode} onMode={onMode} />}
        sub="Three choices and an amount. Switch to Advanced for every setting." />

      <section className="space-y-3 rounded-3xl border border-white/[0.07] bg-white/[0.035] p-4 sm:p-5" aria-label="Pair">
        <PairPicker token={token} info={main} onPick={pickToken} />
        <MarketStrip compact ctx={flow.marketCtx} symbol={main.symbol} decimals={dec} loading={flow.suggest.isLoading} />
      </section>

      <section className="space-y-3 rounded-3xl border border-white/[0.07] bg-white/[0.035] p-4 sm:p-5" aria-label="Goal">
        <ChoiceCards label="Goal" value={goal} onChange={onGoal} columns={1} size="sm"
          options={GOALS.map(g => ({ value: g.id, title: g.name, line: g.line, art: <g.Icon className="h-4 w-4 text-emerald-300" aria-hidden /> }))} />
        <ChoiceCards label="Width" value={width} onChange={onWidth} columns={3} size="sm"
          options={WIDTHS[goal].map(w => ({ value: w.id, title: w.label, line: w.line, disabled: tooWide(w.pct), note: tooWide(w.pct) ? 'Needs V4 bins' : undefined }))} />
      </section>

      {card && (
        <AmountCard
          id="simple-amount"
          label={goal === 'range' ? 'How much BCH to put in' : card.label}
          asset={card.asset === 'bch' ? 'BCH' : main}
          value={values[card.key] ?? ''}
          onChange={v => flow.setDeposit(card.key, v)}
          balance={bal !== null ? formatUnits(bal, flow.decOfCard(card)) : null}
          onFraction={bal !== null ? f => flow.setFraction(card.key, f) : undefined}
          error={amountErr}
          linkedNote={other && otherUnits > 0n ? `+ ${formatUnits(otherUnits, dec)} ${main.symbol} for the bins below the price` : null}
          hint={other && otherBal !== null && otherUnits > otherBal ? `You have ${formatUnits(otherBal, dec)} ${main.symbol}: lower the amount or use Advanced to set the sides separately.` : undefined}
        />
      )}

      <section className="space-y-2 rounded-3xl border border-white/[0.07] bg-[#0c0c10] p-4 sm:p-5" aria-label="Summary">
        <SummaryRows rows={rows} />
        <EngineLine engine={engine} className="pt-2" />
      </section>

      {d.warnings.length > 0 && (
        <NoteBox tone="warn" title="Priced through the market">
          {d.warnings.map(w => <p key={w}>{w}</p>)}
          {engine === 'v3' && (
            <label className="mt-2 flex cursor-pointer items-start gap-2 text-amber-50">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-amber-400" checked={flow.v3.acceptCross} onChange={e => flow.v3.setAcceptCross(e.target.checked)} />
              Deploy anyway: I want these pools filled at these prices
            </label>
          )}
        </NoteBox>
      )}
      {d.validation && flow.wallet.signer && (values[card?.key ?? ''] ?? '').trim() && !/^Not enough|Deploy anyway/.test(d.validation) && (
        <NoteBox tone="error">{d.validation}</NoteBox>
      )}

      <BigButton onClick={() => { setSignOpen(true); void d.openReview(); }} disabled={!flow.canReview || !!amountErr} testId="simple-review">{label}</BigButton>
      <SignFlow flow={flow} open={signOpen} onOpenChange={setSignOpen} />
    </div>
  );
}
