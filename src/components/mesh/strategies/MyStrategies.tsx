/**
 * "My strategies" on the pools page: an idle-liquidity banner with the Recycle
 * action, filter tabs, and a grid of DeFi strategy cards.
 */
import { useMemo, useState } from 'react';
import { AlertTriangle, Layers, Moon, PlusCircle, Recycle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useIdle } from '@/hooks/useMesh';
import type { IdleKind, StrategySummary } from '@/lib/mesh/meshApi';
import { formatSatsCompact, formatUsd, satsToUsd } from '@/lib/mesh/format';
import { useTokenInfo } from '@/components/mesh/pools/shared';
import { DefiCard, templateName } from '@/components/mesh/ui/defi';
import { StrategyCard, strategyTokens, strategyUrl } from './StrategyCard';
import { RecycleDialog } from './RecycleDialog';
import { Pager, usePagination } from '@/components/common/Pager';

type Filter = 'open' | 'idle' | 'all';
const STRATEGIES_PER_PAGE = 6;
const KIND_LABEL: Record<IdleKind, string> = { wallet: 'in your wallet', stale: 'not filling', 'one-sided': 'out of range', dust: 'dust' };

export function MyStrategies({ owner, strategies, bchUsd, loading, onCreateNew }: {
  owner: string; strategies: StrategySummary[]; bchUsd?: number | null; loading?: boolean; onCreateNew: () => void;
}) {
  const idle = useIdle(owner);
  const [filter, setFilter] = useState<Filter>('open');
  const [recycleOpen, setRecycleOpen] = useState(false);
  const cats = useMemo(() => [...strategies.flatMap(strategyTokens), ...(idle.data?.items.map(i => i.token).filter((t): t is string => !!t) ?? [])],
    [strategies, idle.data]);
  const { get: infoOf } = useTokenInfo(cats);

  // strategies with pools priced through the market (arbitrage takes them first)
  const crossed = strategies.filter(s => s.status !== 'closed' && (s.throughMarketPools ?? 0) > 0);
  const counts = {
    open: strategies.filter(s => s.status !== 'closed').length,
    idle: strategies.filter(s => !!s.idle).length,
    all: strategies.length,
  };
  const shown = strategies
    .filter(s => (filter === 'all' ? true : filter === 'idle' ? !!s.idle : s.status !== 'closed'))
    .sort((a, b) => Number(!!b.idle) - Number(!!a.idle) || Number(BigInt(b.valueSats) - BigInt(a.valueSats)));

  const pages = usePagination(shown, STRATEGIES_PER_PAGE, filter);

  const report = idle.data;
  const idleKinds = report ? [...new Set(report.items.map(i => i.kind))] : [];

  return (
    <section className="space-y-4" aria-labelledby="my-strategies">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h2 id="my-strategies" className="font-heading text-lg font-semibold text-white flex items-center gap-2"><Layers className="h-4 w-4 text-emerald-300" />Strategies</h2>
          <p className="text-[11px] text-zinc-500">Each strategy is a set of pools you funded in one transaction.</p>
        </div>
        <div className="flex gap-1 rounded-xl border border-white/[0.06] bg-black/40 p-1" role="tablist" aria-label="Filter strategies">
          {(['open', 'idle', 'all'] as const).map(f => (
            <button key={f} type="button" role="tab" aria-selected={filter === f} onClick={() => setFilter(f)}
              className={cn('rounded-lg px-3 py-1 text-[11px] font-semibold capitalize transition-colors', filter === f ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300')}>
              {f} <span className="font-mono text-zinc-500">{counts[f]}</span>
            </button>
          ))}
        </div>
      </div>

      {report && report.count > 0 && (
        <DefiCard tone="idle" className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-400/25 bg-amber-500/10 text-amber-300"><Moon className="h-4 w-4" aria-hidden /></div>
            <div>
              <div className="font-heading text-sm font-semibold text-white">
                {report.count} item{report.count === 1 ? '' : 's'} idle · <span className="font-mono">{formatSatsCompact(report.totalValueSats)}</span>
                {satsToUsd(report.totalValueSats, bchUsd) !== null && <span className="text-zinc-400"> ({formatUsd(satsToUsd(report.totalValueSats, bchUsd))})</span>} not earning
              </div>
              <p className="text-[11px] text-zinc-400">{idleKinds.map(k => `${report.items.filter(i => i.kind === k).length} ${KIND_LABEL[k]}`).join(' · ')}. Recycle puts it back to work around today&apos;s price.</p>
            </div>
          </div>
          <Button onClick={() => setRecycleOpen(true)} className="rounded-xl font-bold shrink-0"><Recycle className="mr-1.5 h-4 w-4" />Recycle</Button>
        </DefiCard>
      )}

      {crossed.length > 0 && (
        <DefiCard className="flex items-start gap-3 border-rose-400/25 bg-rose-500/[0.06]">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-rose-400/25 bg-rose-500/10 text-rose-300"><AlertTriangle className="h-4 w-4" aria-hidden /></div>
          <div className="text-[11px] text-rose-100">
            <div className="font-heading text-sm font-semibold text-white">
              {crossed.reduce((a, s) => a + (s.throughMarketPools ?? 0), 0)} of your pools are priced through the market
            </div>
            They give traders more than the market price, so arbitrage takes them first. Open {crossed.length === 1 ? 'the strategy' : 'each strategy'} and rebalance or withdraw:{' '}
            {crossed.map((s, i) => <span key={s.id}>{i ? ', ' : ''}<a className="underline" href={strategyUrl(s.id)}>{templateName(s.template)}</a></span>)}
          </div>
        </DefiCard>
      )}

      {loading && !strategies.length ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[0, 1, 2].map(i => <div key={i} className="h-[260px] animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.02]" />)}
        </div>
      ) : shown.length ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {pages.pageItems.map(s => <StrategyCard key={s.id} s={s} infoOf={infoOf} bchUsd={bchUsd} />)}
        </div>
      ) : (
        <DefiCard className="flex flex-col items-center gap-3 py-10 text-center">
          <Layers className="h-7 w-7 text-zinc-600" aria-hidden />
          <div className="text-sm font-semibold text-zinc-300">{filter === 'idle' ? 'Nothing idle — all your liquidity is working' : 'No strategies yet'}</div>
          {filter !== 'idle' && <Button variant="outline" onClick={onCreateNew} className="rounded-xl"><PlusCircle className="mr-1.5 h-4 w-4" />Create a strategy</Button>}
        </DefiCard>
      )}

      <Pager page={pages.page} pageCount={pages.pageCount} onPage={pages.setPage} />

      {report && report.count > 0 && (
        <RecycleDialog open={recycleOpen} onOpenChange={setRecycleOpen} report={report} infoOf={infoOf} bchUsd={bchUsd} />
      )}
    </section>
  );
}
