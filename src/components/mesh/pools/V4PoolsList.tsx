import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { meshApi } from '@/hooks/useMesh';
import { meshPaths } from '@/lib/mesh/routes';
import { formatSatsCompact, formatUnits, shortHex } from '@/lib/mesh/format';
import { Pager, usePagination } from '@/components/common/Pager';
import { PoolPairLabel, useTokenInfo } from './shared';

/** Public NFT-owned ranges are indexed separately from V3 covenant pools. */
export function V4PoolsList({ status }: { status: 'active' | 'all' }) {
  const positions = useQuery({
    queryKey: ['mesh', 'v4', 'public-positions'],
    queryFn: () => meshApi.v4Positions({ limit: 200 }),
    refetchInterval: 20_000,
  });
  const rows = (positions.data?.positions ?? []).filter(position => status === 'all' || position.bins.some(bin => bin.utxos.length > 0));
  const pages = usePagination(rows, 9, status);
  const { get } = useTokenInfo(rows.map(position => position.commitment.tokenCat));
  return (
    <section aria-label="V4 range positions" className="space-y-3">
      <h2 className="text-sm font-semibold text-white">V4 range positions <span className="text-zinc-500 font-mono">{positions.isLoading ? '…' : rows.length}</span></h2>
      {positions.isError ? <div role="alert" className="text-xs text-amber-300">Could not load V4 positions. <button type="button" className="underline" onClick={() => { void positions.refetch(); }}>Retry</button></div>
        : positions.isLoading ? <p role="status" className="text-xs text-zinc-400">Loading V4 positions…</p>
        : rows.length === 0 ? <p className="text-xs text-zinc-500">No {status === 'active' ? 'active ' : ''}V4 positions.</p>
        : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {pages.pageItems.map(position => {
            const token = get(position.commitment.tokenCat);
            const funded = position.bins.filter(bin => bin.utxos.length > 0).length;
            return <Link key={position.category} to={meshPaths.position(position.category)} className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-3 hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-emerald-400">
              <div className="flex items-center justify-between gap-2"><PoolPairLabel token={token} showSide={false} size={22} /><span className="text-[10px] font-mono text-cyan-300">V4</span></div>
              <p className="text-[11px] font-mono text-zinc-500">{shortHex(position.category)} · {funded ? 'Active' : 'Closed'}</p>
              <dl className="grid grid-cols-2 gap-2 text-xs"><div><dt className="text-zinc-500">Value at bid</dt><dd className="font-mono text-white">{formatSatsCompact(position.totals.valueAtBidSats)}</dd></div><div><dt className="text-zinc-500">Funded bins</dt><dd className="font-mono text-white">{funded} / {position.bins.length}</dd></div><div><dt className="text-zinc-500">BCH in bins</dt><dd className="font-mono text-zinc-300">{formatSatsCompact(position.totals.sats)}</dd></div><div><dt className="text-zinc-500">{token.symbol} in bins</dt><dd className="font-mono text-zinc-300 break-all">{formatUnits(position.totals.tokens, token.decimals)}</dd></div></dl>
            </Link>;
          })}
        </div>}
      {(positions.data?.total ?? 0) > (positions.data?.positions.length ?? 0) && <p className="text-xs text-amber-300">Showing the latest {positions.data?.positions.length} of {positions.data?.total} V4 positions.</p>}
      <Pager page={pages.page} pageCount={pages.pageCount} onPage={pages.setPage} />
    </section>
  );
}
