/**
 * Wallet drawer tab: the connected wallet's Mesh pools (or every pool), from
 * the server's pool API. Owner = hash of the wallet's P2PKH address.
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Layers, PlusCircle, RefreshCw } from 'lucide-react';
import { useMeshPools, useMeshSigner, useMeshStats } from '@/hooks/useMesh';
import { formatSatsCompact, formatUsd, satsToUsd } from '@/lib/mesh/format';
import { PoolPairLabel, PoolStatusBadge, poolUrl, useTokenInfo } from '@/components/mesh/pools/shared';

interface WalletPoolsTabProps {
  onClose?: () => void;
}

export function WalletPoolsTab({ onClose }: WalletPoolsTabProps) {
  const wallet = useMeshSigner();
  const stats = useMeshStats();
  const [filterMode, setFilterMode] = useState<'all' | 'mine'>(wallet.pkh ? 'mine' : 'all');
  const query = filterMode === 'mine' ? { owner: wallet.pkh ?? undefined, status: 'active,exhausted' } : { status: 'active' };
  const pools = useMeshPools(query, { enabled: filterMode === 'all' || !!wallet.pkh });
  const list = pools.data?.pools ?? [];
  const { get } = useTokenInfo(list.map(p => p.tokenCategory));
  const totalSats = list.reduce((a, p) => a + BigInt(p.valueSats), 0n);

  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex p-1 rounded-lg bg-black/40 border border-white/[0.06]">
          {(['mine', 'all'] as const).map(m => (
            <button key={m} type="button" onClick={() => setFilterMode(m)} disabled={m === 'mine' && !wallet.pkh}
              className={`px-3 py-1 rounded-md text-[11px] font-semibold disabled:opacity-40 ${filterMode === m ? 'bg-white/10 text-white' : 'text-zinc-500'}`}>
              {m === 'mine' ? 'My pools' : 'All pools'}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => void pools.refetch()} className="p-1.5 text-zinc-500 hover:text-white" title="Refresh">
          <RefreshCw className={`w-3.5 h-3.5 ${pools.isFetching ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex justify-between text-[11px] text-zinc-500 px-1">
        <span>{list.length} pool{list.length === 1 ? '' : 's'}</span>
        <span className="font-mono">{formatSatsCompact(totalSats)}{stats.data?.bchUsd ? ` · ${formatUsd(satsToUsd(totalSats, stats.data.bchUsd))}` : ''}</span>
      </div>

      {list.length === 0 ? (
        <div className="py-8 text-center space-y-3">
          <Layers className="w-7 h-7 mx-auto text-zinc-600" />
          <div className="text-xs text-zinc-400">{pools.isLoading ? 'Loading pools…' : filterMode === 'mine' ? 'No pools for this wallet yet.' : 'No active pools.'}</div>
          <Link to="/mesh?tab=create" onClick={onClose} className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300">
            <PlusCircle className="w-3.5 h-3.5" />Create a pool
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map(p => (
            <Link key={p.address} to={poolUrl(p)} onClick={onClose}
              className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/15 transition-colors">
              <PoolPairLabel token={get(p.tokenCategory)} side={p.side} size={22} />
              <div className="text-right space-y-1 shrink-0">
                <div className="text-xs font-mono text-zinc-200">{formatSatsCompact(p.valueSats)}</div>
                <PoolStatusBadge status={p.status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default WalletPoolsTab;
