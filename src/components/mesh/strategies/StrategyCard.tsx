/**
 * A strategy as a DeFi card: template, pair, status / idle, value (BCH + USD),
 * 7-day fees, fee APR (only after 24 h of history), P&L, what it holds now,
 * and activity. The whole card links to the position page.
 */
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import type { StrategySummary } from '@/lib/mesh/meshApi';
import { formatPct, formatSatsCompact, formatUsd, satsToUsd, timeAgo } from '@/lib/mesh/format';
import { TokenAvatar, type TokenInfo } from '@/components/mesh/pools/shared';
import { DefiCard, IdlePill, InventoryBar, MetricCell, RecyclePill, StatusPill, TemplateIcon, templateName, type InventorySegment } from '@/components/mesh/ui/defi';

export const strategyUrl = (id: string) => `/mesh/strategy/${encodeURIComponent(id)}`;

/** Token categories a strategy trades, from its params. */
export function strategyTokens(s: Pick<StrategySummary, 'params'>): string[] {
  const p = s.params as Record<string, any>;
  const list = [p.token, p.tokenA, p.tokenB, ...(Array.isArray(p.tokens) ? p.tokens.map((t: any) => t?.token) : [])];
  return [...new Set(list.filter((c): c is string => typeof c === 'string' && /^[0-9a-f]{64}$/i.test(c)))];
}

/** Proceeds stay in Mesh: a recycling template, or a template run with proceeds = recycle. */
export const strategyRecycles = (s: Pick<StrategySummary, 'template' | 'params'>) =>
  s.template === 'recycling-pair' || s.template === 'grid' || s.template === 'range' || (s.params as any)?.proceeds === 'recycle';

export function StrategyCard({ s, infoOf, bchUsd, className }: {
  s: StrategySummary; infoOf: (cat: string) => TokenInfo; bchUsd?: number | null; className?: string;
}) {
  const tokens = strategyTokens(s).map(infoOf);
  const pnl = BigInt(s.pnlSats);
  const value = BigInt(s.valueSats);
  const usd = satsToUsd(s.valueSats, bchUsd);
  const idle = s.idle ?? null;
  // inventory by value: the BCH part is exact; the rest of the value is the tokens it holds
  const bchPart = s.inventory ? Number(s.inventory.sats) : null;
  const segments: InventorySegment[] = bchPart === null ? [] : [
    { label: 'BCH', valueSats: Math.min(bchPart, Number(value)), tone: 'bch' },
    { label: tokens.length === 1 ? tokens[0]!.symbol : 'Tokens', valueSats: Math.max(0, Number(value) - bchPart), tone: 'token' },
  ];
  const ageH = (Date.now() / 1000 - s.createdAt) / 3600;

  return (
    <Link to={strategyUrl(s.id)} className={cn('block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60', className)}
      aria-label={`${templateName(s.template)} strategy, ${s.status}${idle ? ', idle' : ''}`}>
      <DefiCard interactive tone={idle ? 'idle' : s.status === 'closed' ? 'muted' : 'default'} className="h-full space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <TemplateIcon id={s.template} />
            <div className="min-w-0">
              <div className="font-heading text-[15px] font-semibold text-white truncate">{templateName(s.template)}</div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-zinc-400">
                <span className="flex -space-x-1.5">
                  <TokenAvatar info="BCH" size={16} />
                  {tokens.slice(0, 3).map(t => <TokenAvatar key={t.category} info={t} size={16} />)}
                </span>
                <span className="truncate">{s.template === 'stable-pair' ? tokens.map(t => t.symbol).join(' / ') : `BCH / ${tokens.map(t => t.symbol).join(', ') || '—'}`}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <StatusPill status={s.status} />
            {idle && <IdlePill title={idle.reasons.join(' · ')} />}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <MetricCell label="Value" value={formatSatsCompact(value)} sub={usd !== null ? formatUsd(usd) : undefined} />
          <MetricCell label="Fees 7d" value={formatSatsCompact(s.fees7dSats)} sub={`all ${formatSatsCompact(s.feesAllSats)}`} accent="text-emerald-300" />
          <MetricCell label="Fee APR" value={s.feeApr7dPct !== null && s.feeApr7dPct !== undefined ? formatPct(s.feeApr7dPct) : '—'}
            sub={s.feeApr7dPct === null || s.feeApr7dPct === undefined ? (ageH < 24 ? 'after 24 h of history' : 'no value') : 'estimate · 7d'} />
          <MetricCell label="P&L" value={`${pnl >= 0n ? '+' : ''}${formatSatsCompact(pnl)}`} accent={pnl < 0n ? 'text-rose-300' : 'text-emerald-300'}
            sub={satsToUsd(pnl, bchUsd) !== null ? formatUsd(satsToUsd(pnl, bchUsd)) : undefined} />
        </div>

        {segments.length > 0 && <InventoryBar segments={segments} />}

        {idle && (
          <p className="rounded-lg border border-amber-400/20 bg-amber-500/[0.06] px-2.5 py-1.5 text-[11px] text-amber-200 line-clamp-2">{idle.reasons[0]}</p>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-white/[0.06] pt-3 text-[10px] text-zinc-500">
          <span className="font-mono">{s.poolCount} pool{s.poolCount === 1 ? '' : 's'} · {s.fillCount} fill{s.fillCount === 1 ? '' : 's'}{s.lastFillAt ? ` · last ${timeAgo(s.lastFillAt)}` : ''}</span>
          <span className="flex items-center gap-1.5">
            {strategyRecycles(s) && <RecyclePill />}
            {s.replacedBy && <span className="rounded-full border border-white/10 px-2 py-0.5">rebalanced</span>}
          </span>
        </div>
      </DefiCard>
    </Link>
  );
}
