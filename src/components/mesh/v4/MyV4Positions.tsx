/**
 * "V4 positions" on My positions: every position whose NFT this wallet holds
 * (bought or received ones too: ownership follows the NFT), plus geneses this
 * browser broadcast that are still waiting for registration.
 */
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Gem, Loader2 } from 'lucide-react';
import { useV4HeldMulti } from '@/hooks/useMeshV4';
import { formatSatsCompact, formatUnits, shortHex } from '@/lib/mesh/format';
import { gridPriceNum } from '@/lib/mesh/v4/position';
import { pendingV4, positionUrl, tokenPerBch } from '@/lib/mesh/v4/display';
import type { V4PositionView } from '@/lib/mesh/v4/types';
import { TokenAvatar, useTokenInfo, type TokenInfo } from '@/components/mesh/pools/shared';
import { DefiCard, MetricCell } from '@/components/mesh/ui/defi';
import { EngineBadge } from './V4DeployPanel';

export function MyV4Positions({ holder }: { holder: string | string[] | null }) {
  const holders = useMemo(() => {
    if (!holder) return [];
    return Array.isArray(holder) ? holder.filter(Boolean) : [holder];
  }, [holder]);
  const held = useV4HeldMulti(holders);
  const positions = held.data?.positions ?? [];
  const known = new Set(positions.map(p => p.category));
  const pending = pendingV4().filter(p => !known.has(p.category));
  const { get } = useTokenInfo(positions.map(p => p.commitment.tokenCat));
  if (!holders.length || (!positions.length && !pending.length && !held.isLoading)) return null;

  return (
    <section className="space-y-3" aria-labelledby="my-v4">
      <div>
        <h2 id="my-v4" className="font-heading text-lg font-semibold text-white flex items-center gap-2"><Gem className="h-4 w-4 text-violet-300" />V4 positions</h2>
        <p className="text-[11px] text-zinc-500">Bins owned by an NFT in this wallet. Whoever holds the NFT controls the position.</p>
      </div>
      {held.isLoading && !positions.length ? (
        <div className="h-[150px] animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.02]" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {positions.map(p => <V4Card key={p.category} p={p} info={get(p.commitment.tokenCat)} />)}
          {pending.map(p => (
            <Link key={p.category} to={positionUrl(p.category)}>
              <DefiCard interactive tone="muted" className="space-y-2">
                <div className="flex items-center gap-2"><EngineBadge engine="v4" /><Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400" /><span className="text-xs text-zinc-300">Registration pending</span></div>
                <div className="font-mono text-[11px] text-zinc-500">NFT {shortHex(p.category, 8, 6)} · genesis {shortHex(p.genesisTxid)}</div>
              </DefiCard>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function V4Card({ p, info }: { p: V4PositionView; info: TokenInfo }) {
  const c = p.commitment;
  const low = tokenPerBch(gridPriceNum(c.binStepBps, c.highIndex + 1), info.decimals);
  const high = tokenPerBch(gridPriceNum(c.binStepBps, c.lowIndex), info.decimals);
  const funded = p.bins.filter(b => b.utxos.length > 0).length;
  return (
    <Link to={positionUrl(p.category)} aria-label={`V4 position ${p.pairName ?? ''} ${shortHex(p.category)}`}>
      <DefiCard interactive className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <TokenAvatar info={info} size={28} />
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white truncate">{p.pairName ?? `BCH/${info.symbol}`}</div>
              <div className="font-mono text-[10px] text-violet-300 inline-flex items-center gap-1"><Gem className="w-3 h-3" />NFT {shortHex(p.category, 6, 4)}</div>
            </div>
          </div>
          <EngineBadge engine="v4" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <MetricCell label="Value" value={formatSatsCompact(p.totals.valueAtBidSats)} sub="at the bids" />
          <MetricCell label="Holds" value={formatSatsCompact(p.totals.sats)} sub={`+ ${formatUnits(p.totals.tokens, info.decimals)} ${info.symbol}`} />
          <MetricCell label="Bins" value={`${funded}/${p.bins.length}`} sub={`${p.totals.binsWithTokens} with ${info.symbol}`} />
        </div>
        <div className="text-[11px] text-zinc-500 font-mono">{low.toFixed(2)}–{high.toFixed(2)} {info.symbol}/BCH · {(c.binStepBps / 100).toFixed(2)}% step</div>
      </DefiCard>
    </Link>
  );
}
