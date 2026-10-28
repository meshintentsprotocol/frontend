/**
 * Wallet drawer tab: the connected wallet's standalone Mesh pools, its
 * strategies, or every active pool, from the server's pool API. Owner = hash
 * of the wallet's P2PKH address. Lists are paged.
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Layers, PlusCircle, RefreshCw } from 'lucide-react';
import { useMeshPools, useMeshSigner, useMeshStats, useStrategies } from '@/hooks/useMesh';
import type { StrategySummary } from '@/lib/mesh/meshApi';
import { formatSatsCompact, formatUsd, satsToUsd } from '@/lib/mesh/format';
import { PoolPairLabel, PoolStatusBadge, poolUrl, useTokenInfo, type TokenInfo } from '@/components/mesh/pools/shared';
import { IdlePill, TemplateIcon, templateName } from '@/components/mesh/ui/defi';
import { strategyTokens, strategyUrl } from '@/components/mesh/strategies/StrategyCard';
import { Pager, usePagination } from '@/components/common/Pager';

interface WalletPoolsTabProps {
  onClose?: () => void;
}

type Mode = 'mine' | 'strategies' | 'all';

const MODES: { id: Mode; label: string; needsWallet: boolean }[] = [
  { id: 'mine', label: 'My pools', needsWallet: true },
  { id: 'strategies', label: 'Strategies', needsWallet: true },
  { id: 'all', label: 'All pools', needsWallet: false },
];

/** Where "Open in Mesh" lands for each list. */
const MESH_URL: Record<Mode, string> = {
  mine: '/mesh/positions?view=pools',
  strategies: '/mesh/positions',
  all: '/mesh/pools',
};

const PAGE_SIZE = 5;
const ROW_CLASS = 'flex items-center justify-between gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/15 transition-colors';

function StrategyRow({ s, infoOf, onClose }: { s: StrategySummary; infoOf: (cat: string) => TokenInfo; onClose?: () => void }) {
  const symbols = strategyTokens(s).map(c => infoOf(c).symbol);
  return (
    <Link to={strategyUrl(s.id)} onClick={onClose} className={ROW_CLASS}>
      <div className="flex items-center gap-2.5 min-w-0">
        <TemplateIcon id={s.template} className="w-7 h-7 rounded-lg" />
        <div className="min-w-0">
          <div className="text-xs font-semibold text-white truncate">{templateName(s.template)}</div>
          <div className="text-[10px] text-zinc-500 truncate">
            {s.template === 'stable-pair' ? symbols.join(' / ') : `BCH / ${symbols.join(', ') || '—'}`} · {s.activePools} of {s.poolCount} pools
          </div>
        </div>
      </div>
      <div className="text-right space-y-1 shrink-0">
        <div className="text-xs font-mono text-zinc-200">{formatSatsCompact(s.valueSats)}</div>
        {s.idle ? <IdlePill title={s.idle.reasons.join(' · ')} /> : <PoolStatusBadge status={s.status} />}
      </div>
    </Link>
  );
}

export function WalletPoolsTab({ onClose }: WalletPoolsTabProps) {
  const wallet = useMeshSigner();
  const stats = useMeshStats();
  const [mode, setMode] = useState<Mode>(wallet.pkh ? 'mine' : 'all');
  const owner = wallet.pkh ?? undefined;

  const poolQuery = mode === 'all' ? { status: 'active' } : { owner, status: 'active,exhausted' };
  const pools = useMeshPools(poolQuery, { enabled: mode === 'all' || (mode === 'mine' && !!owner) });
  const strategies = useStrategies(mode === 'strategies' && owner ? owner : null);
  const active = mode === 'strategies' ? strategies : pools;

  // "My pools" lists standalone pools only; a strategy's pools sit under Strategies
  const poolList = (pools.data?.pools ?? []).filter(p => mode === 'all' || p.contractName !== 'StrategyCovenantV2');
  const strategyList = (strategies.data?.strategies ?? [])
    .filter(s => s.status !== 'closed')
    .sort((a, b) => Number(!!b.idle) - Number(!!a.idle) || Number(BigInt(b.valueSats) - BigInt(a.valueSats)));

  const poolPages = usePagination(poolList, PAGE_SIZE, mode);
  const strategyPages = usePagination(strategyList, PAGE_SIZE, mode);
  const pages = mode === 'strategies' ? strategyPages : poolPages;

  const { get } = useTokenInfo(mode === 'strategies' ? strategyList.flatMap(strategyTokens) : poolList.map(p => p.tokenCategory));

  const count = mode === 'strategies' ? strategyList.length : poolList.length;
  const noun = mode === 'strategies' ? (count === 1 ? 'strategy' : 'strategies') : `pool${count === 1 ? '' : 's'}`;
  const totalSats = mode === 'strategies'
    ? strategyList.reduce((a, s) => a + BigInt(s.valueSats), 0n)
    : poolList.reduce((a, p) => a + BigInt(p.valueSats), 0n);
  const emptyText = active.isLoading ? 'Loading…'
    : mode === 'mine' ? 'No pools for this wallet yet.'
    : mode === 'strategies' ? 'No open strategies for this wallet yet.'
    : 'No active pools.';

  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex p-1 rounded-lg bg-black/40 border border-white/[0.06]" role="tablist" aria-label="Pools view">
          {MODES.map(m => (
            <button key={m.id} type="button" role="tab" aria-selected={mode === m.id} onClick={() => setMode(m.id)} disabled={m.needsWallet && !owner}
              className={`px-3 py-1 rounded-md text-[11px] font-semibold disabled:opacity-40 ${mode === m.id ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
              {m.label}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => void active.refetch()} className="p-1.5 text-zinc-500 hover:text-white" title="Refresh">
          <RefreshCw className={`w-3.5 h-3.5 ${active.isFetching ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex justify-between text-[11px] text-zinc-500 px-1">
        <span>{count} {noun}</span>
        <span className="font-mono">{formatSatsCompact(totalSats)}{stats.data?.bchUsd ? ` · ${formatUsd(satsToUsd(totalSats, stats.data.bchUsd))}` : ''}</span>
      </div>

      {count === 0 ? (
        <div className="py-8 text-center space-y-3">
          <Layers className="w-7 h-7 mx-auto text-zinc-600" />
          <div className="text-xs text-zinc-400">{emptyText}</div>
          <Link to="/mesh/new" onClick={onClose} className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300">
            <PlusCircle className="w-3.5 h-3.5" />{mode === 'strategies' ? 'Create a strategy' : 'Create a pool'}
          </Link>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {mode === 'strategies'
              ? strategyPages.pageItems.map(s => <StrategyRow key={s.id} s={s} infoOf={get} onClose={onClose} />)
              : poolPages.pageItems.map(p => (
                <Link key={p.address} to={poolUrl(p)} onClick={onClose} className={ROW_CLASS}>
                  <PoolPairLabel token={get(p.tokenCategory)} side={p.side} size={22} />
                  <div className="text-right space-y-1 shrink-0">
                    <div className="text-xs font-mono text-zinc-200">{formatSatsCompact(p.valueSats)}</div>
                    <PoolStatusBadge status={p.status} />
                  </div>
                </Link>
              ))}
          </div>
          <Pager page={pages.page} pageCount={pages.pageCount} onPage={pages.setPage} />
          <Link to={MESH_URL[mode]} onClick={onClose} className="flex items-center justify-center gap-1 text-[11px] font-semibold text-zinc-400 hover:text-white">
            Open in Mesh<ArrowUpRight className="w-3 h-3" />
          </Link>
        </>
      )}
    </div>
  );
}

export default WalletPoolsTab;
