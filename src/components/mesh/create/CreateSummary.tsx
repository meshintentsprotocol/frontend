/**
 * The create flow's summary card (sticky beside the step on wide screens,
 * under it on narrow ones): pair, strategy and engine, market, the plan, and
 * the deposits once they are typed.
 */
import { TokenAvatar } from '@/components/mesh/pools/shared';
import { EngineBadge, SummaryRows, type SummaryRow } from '@/components/mesh/kit';
import { formatUnits, formatUsd } from '@/lib/mesh/format';
import { formatPrice, signedPct } from '@/lib/mesh/create/price';
import { toBaseUnits } from '@/lib/mesh/v3/strategyForms';
import type { CreateFlow } from './useCreateFlow';
import { settingsSummary } from './SettingsStep';

const SHAPE_NAME: Record<string, string> = { spot: 'Spot', curve: 'Curve', bidask: 'Bid-Ask' };

export function depositTotals(flow: CreateFlow): { text: string; usd: number | null } {
  const parts: string[] = [];
  let usd = 0;
  let priced = true;
  for (const c of flow.cards) {
    const raw = (flow.values[c.key] ?? '').trim();
    if (!raw) continue;
    let units: bigint;
    try { units = toBaseUnits(raw, flow.decOfCard(c)); } catch { continue; }
    if (units <= 0n) continue;
    if (c.asset === 'bch') {
      parts.push(`${formatUnits(units, 8, 8)} BCH`);
      if (flow.marketCtx?.bchUsd) usd += (Number(units) / 1e8) * flow.marketCtx.bchUsd; else priced = false;
    } else {
      const info = flow.infoOf(flow.values[c.asset] ?? '');
      parts.push(`${formatUnits(units, info.decimals)} ${info.symbol}`);
      const tu = c.asset === 'token' ? flow.marketCtx?.tokenUsd : null;
      if (tu !== null && tu !== undefined) usd += (Number(units) / 10 ** info.decimals) * tu; else priced = false;
    }
  }
  return { text: parts.join(' + '), usd: parts.length && priced ? usd : null };
}

export function CreateSummary({ flow }: { flow: CreateFlow }) {
  const { main, marketP, rangeLayout: l, engine, def } = flow;
  const sym = main.symbol;
  const dep = depositTotals(flow);
  const unit = engine === 'v4' ? 'Bins' : 'Pools';
  const rows: Array<SummaryRow | null> = [
    { key: 'strategy', label: 'Strategy', value: <span className="inline-flex items-center gap-2 font-sans">{flow.def.name}<EngineBadge engine={engine} /></span> },
  ];

  if (def.pair !== 'token-token') {
    rows.push(marketP ? { key: 'market', label: 'Market', value: `1 BCH = ${formatPrice(marketP)} ${sym}` } : { key: 'market', label: 'Market', value: 'No market price', tone: 'warn' });
  }

  if (flow.strategy === 'range') {
    if (l && !l.error) {
      rows.push(
        { key: 'range', label: 'Range', value: `${formatPrice(l.minP)} – ${formatPrice(l.maxP)}` },
        marketP ? { key: 'width', label: 'Width', value: `${signedPct((l.minP / marketP - 1) * 100)} / ${signedPct((l.maxP / marketP - 1) * 100)}`, tone: 'muted' } : null,
        { key: 'bins', label: unit, value: `${l.bins.length} (${l.bidCount} BCH · ${l.askCount} ${sym})` },
      );
    } else {
      rows.push({ key: 'range', label: 'Range', value: 'Not set yet', tone: 'muted' });
    }
    const shape = flow.values.shape || 'spot';
    rows.push({ key: 'shape', label: 'Shape', value: `${SHAPE_NAME[shape] ?? shape}${shape !== 'spot' ? ` · ${flow.values.strength || 'standard'}` : ''}`, tone: 'muted' });
    const step = Number(flow.values.binStepBps || 100) / 100;
    rows.push({
      key: 'earns', label: 'Earns',
      value: engine === 'v4' ? `${step}% step per round trip` : `${step}% step + ${(Number(flow.values.feeBps || 30) / 100).toFixed(2)}% fee`,
    });
  } else {
    rows.push({ key: 'settings', label: def.settingsLabel, value: settingsSummary(flow) });
  }

  rows.push({ key: 'deposit', label: 'Deposit', value: dep.text || '—', strong: !!dep.text });
  if (dep.usd !== null) rows.push({ key: 'usd', label: 'Value', value: formatUsd(dep.usd), tone: 'muted' });
  rows.push({ key: 'owner', label: 'Owned by', value: engine === 'v4' ? 'Position NFT' : 'This wallet', tone: 'muted' });

  const avatarA = def.pair === 'token-token' ? flow.infoOf(flow.values.tokenA ?? '') : 'BCH';
  const avatarB = def.pair === 'token-token' ? flow.infoOf(flow.values.tokenB ?? '') : def.pair === 'bch-multi' ? flow.infoOf(flow.values.token1 ?? '') : main;

  return (
    <div className="rounded-3xl border border-white/[0.07] bg-[#0c0c10] p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-3">
        <span className="flex -space-x-2" aria-hidden>
          <TokenAvatar info={avatarA} size={30} />
          <TokenAvatar info={avatarB} size={30} />
        </span>
        <div className="min-w-0">
          <div className="font-heading text-[15px] font-semibold text-white">{flow.pairLabel}</div>
          <div className="text-xs text-zinc-400">{flow.replaces ? 'Rebalance' : 'New position'}</div>
        </div>
      </div>
      <SummaryRows rows={rows} />
    </div>
  );
}
