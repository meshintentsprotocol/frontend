/**
 * /mesh/pool/:address — one pool (MeshPoolV3 pools render V3PoolDetail). Pools are identified by
 * their covenant address, which stays the same across fills (outpoints move).
 * Legacy /mesh/pool/:txid/:vout links are resolved and redirected.
 */
import React, { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, ArrowRightLeft, Copy, ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { meshApi, useMeshPool, useMeshPoolActivity, useMeshPoolStream, useMeshSigner, useMeshStats, useInvalidateMesh } from '@/hooks/useMesh';
import { traderTokenPerBch, tokenPerBchFromSatsPerUnit } from '@/lib/mesh/pool';
import { explorerAddress, formatNumber, formatPct, formatSatsCompact, formatUsd, satsToUsd, shortHex, timeAgo } from '@/lib/mesh/format';
import {
  Panel, PanelTabs, PoolPairLabel, PoolStatusBadge, StatTile, lpUrl, poolUrl, tokenAmount, useTokenInfo,
} from '@/components/mesh/pools/shared';
import { PoolReserves } from '@/components/mesh/pools/PoolsTable';
import { V2MigrationPanel } from '@/components/mesh/v3/V2MigrationPanel';
import { PoolActivityTable, PoolValueChart } from '@/components/mesh/pools/PoolActivity';
import { useSmallScreen } from '@/components/mesh/ui/ManageDock';
import { POOL_INFO_TABS, V3PoolDetail } from '@/components/mesh/v3/V3PoolDetail';

export function MeshPoolDetailPage() {
  const { address: raw } = useParams();
  const address = raw ? decodeURIComponent(raw) : undefined;
  const pool = useMeshPool(address);
  const activity = useMeshPoolActivity(address);
  const stats = useMeshStats();
  const wallet = useMeshSigner();
  const invalidate = useInvalidateMesh();
  const [syncing, setSyncing] = useState(false);
  const small = useSmallScreen();
  const [info, setInfo] = useState<'activity' | 'position' | 'covenant'>(small ? 'activity' : 'position');
  useMeshPoolStream(pool.data?.pool.address);

  const p = pool.data?.pool;
  const { get } = useTokenInfo([p?.tokenCategory]);
  const token = get(p?.tokenCategory);
  const bchUsd = stats.data?.bchUsd ?? null;
  const network = wallet.network;

  if (pool.isLoading) {
    return <div className="py-28 text-center text-zinc-400 text-sm"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-emerald-400" />Loading pool…</div>;
  }
  if (!p) {
    const notFound = (pool.error as any)?.status === 404;
    return (
      <div className="container mx-auto max-w-lg py-16">
        <Panel>
          <div className="text-center space-y-3 py-6">
            <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
            <h2 className="text-xl font-bold text-white">{notFound ? 'Pool not found' : 'Could not load the pool'}</h2>
            <p className="text-xs text-zinc-400">{notFound ? 'No registered Mesh pool has this address.' : String((pool.error as Error)?.message ?? '')}</p>
            <Link to="/mesh?tab=pools" className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-300 hover:text-white"><ArrowLeft className="w-4 h-4" />Back to pools</Link>
          </div>
        </Panel>
      </div>
    );
  }

  if (p.v3) {
    const syncV3 = async () => {
      setSyncing(true);
      try { await meshApi.sync(p.address); invalidate(); } catch (e: any) { toast.error('Sync failed', { description: e?.message }); } finally { setSyncing(false); }
    };
    return <V3PoolDetail pool={p} bundle={pool.data?.bundle ?? []} onSync={syncV3} syncing={syncing} />;
  }

  const trader = token.known ? traderTokenPerBch(p, token.decimals) : null;
  const market = token.known && p.priceSource === 'cauldron' ? tokenPerBchFromSatsPerUnit(p.marketSatsPerToken, token.decimals) : null;
  const vsMarket = trader && market ? (trader / market - 1) * 100 : null;
  const pnl = BigInt(p.stats.pnlSats);
  const tab = info === 'activity' && !small ? 'position' : info;
  const activityTable = <PoolActivityTable pool={p} events={activity.data?.events ?? []} token={token} network={network} loading={activity.isLoading} />;

  async function sync() {
    setSyncing(true);
    try { await meshApi.sync(p!.address); invalidate(); } catch (e: any) { toast.error('Sync failed', { description: e?.message }); } finally { setSyncing(false); }
  }

  return (
    <div className="container mx-auto py-4 sm:py-6 px-4 md:px-8 max-w-[1200px] space-y-6">
      <Link to="/mesh?tab=pools" className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300"><ArrowLeft className="w-3.5 h-3.5" />Pools</Link>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <PoolPairLabel token={token} side={p.side} size={36} />
          <PoolStatusBadge status={p.status} />
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full border border-amber-500/30 text-amber-300">V2 · migrate to V3</span>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-full border border-white/10 text-zinc-400">{(p.feeBps / 100).toFixed(2)}% fee</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="rounded-xl" onClick={sync} disabled={syncing}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${syncing ? 'animate-spin' : ''}`} />Sync with chain
          </Button>
          <Link to="/trade"><Button size="sm" className="rounded-xl"><ArrowRightLeft className="w-3.5 h-3.5 mr-1.5" />Trade</Button></Link>
        </div>
      </div>

      {p.successor && (
        <div className="p-4 rounded-2xl bg-violet-500/10 border border-violet-500/25 text-xs text-violet-200 flex items-center justify-between gap-3">
          <span>This pool was repriced. Its reserve moved to a new pool.</span>
          <Link to={poolUrl(p.successor)} className="font-semibold underline shrink-0">Open the new pool</Link>
        </div>
      )}
      {p.status === 'exhausted' && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-200">
          The pool's reserve is below the covenant minimum, so it no longer fills. Its funds are still in the covenant — the owner can withdraw them below.
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label="Pool value" value={formatSatsCompact(p.valueSats)} sub={bchUsd ? formatUsd(satsToUsd(p.valueSats, bchUsd)) : `tokens at ${p.priceSource} price`} />
        <StatTile label={`Trader price (1 BCH =)`} value={trader ? `${formatNumber(trader, 4)} ${token.symbol}` : '—'}
          sub={vsMarket === null ? 'no market reference' : `${vsMarket >= 0 ? '+' : ''}${vsMarket.toFixed(2)}% vs Cauldron`} />
        <StatTile label="Volume 7d" value={formatSatsCompact(p.stats.volume7dSats)} sub={`all time ${formatSatsCompact(p.stats.volumeAllSats)} · ${p.stats.fillCount} fills`} />
        <StatTile label="LP fees 7d" value={formatSatsCompact(p.stats.fees7dSats)} accent="text-emerald-400"
          sub={`all time ${formatSatsCompact(p.stats.feesAllSats)} · APR est. ${formatPct(p.stats.feeApr7dPct)}`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 space-y-6">
          <Panel title="Pool value" action={<span className="text-[11px] text-zinc-500">after each event</span>}>
            <PoolValueChart pool={p} events={activity.data?.events ?? []} token={token} />
          </Panel>
          {!small && (
            <Panel title="Activity" action={<span className="text-[11px] text-zinc-500">{activity.data?.total ?? 0} events</span>}>{activityTable}</Panel>
          )}
        </div>

        <div className="lg:col-span-5 space-y-6">
          <V2MigrationPanel pools={[p]} />
          <p className="text-[11px] text-zinc-500 px-1">Top-up and reprice for V2 pools are in the V2 app. Here you can withdraw, or migrate the pool to V3.</p>

          <Panel title={<PanelTabs tabs={small ? POOL_INFO_TABS : POOL_INFO_TABS.slice(1)} value={tab} onChange={setInfo} />}>
            {tab === 'activity' && activityTable}
            {tab === 'position' && <div className="space-y-2.5 text-xs">
              <Row label="Reserves"><PoolReserves pool={p} token={token} /></Row>
              <Row label="Available to trade">{p.side === 'SELL_BCH' ? formatSatsCompact(p.availableOut) : tokenAmount(p.availableOut, token)}</Row>
              <Row label="Deposited">{formatSatsCompact(p.stats.deposited.sats)}{BigInt(p.stats.deposited.tokens) > 0n && ` + ${tokenAmount(p.stats.deposited.tokens, token)}`}</Row>
              <Row label="Withdrawn">{formatSatsCompact(p.stats.withdrawn.sats)}{BigInt(p.stats.withdrawn.tokens) > 0n && ` + ${tokenAmount(p.stats.withdrawn.tokens, token)}`}</Row>
              <Row label="P&L vs holding" title="Current value plus withdrawals minus deposits, all at today's price">
                <span className={pnl >= 0n ? 'text-emerald-400' : 'text-rose-400'}>{pnl >= 0n ? '+' : ''}{formatSatsCompact(p.stats.pnlSats)}</span>
              </Row>
              <Row label="UTXOs">{p.utxos.length}{p.utxos.some(u => !u.valid) && <span className="text-amber-400"> · {p.utxos.filter(u => !u.valid).length} below minimum</span>}</Row>
              <Row label="Created">{timeAgo(p.createdAt)}</Row>
              <Row label="Last fill">{timeAgo(p.lastFillAt)}</Row>
            </div>}
            {tab === 'covenant' && <div className="space-y-2.5 text-xs">
              <CopyRow label="Pool address" value={p.address} href={explorerAddress(network, p.address)} />
              <CopyRow label="Token category" value={p.tokenCategory} />
              <Row label="LP"><Link to={lpUrl(p.ownerPkh)} className="font-mono text-zinc-300 hover:text-white underline-offset-2 hover:underline">{shortHex(p.ownerAddress, 8, 6)}</Link></Row>
              <Row label="Price (covenant)"><span className="font-mono">{p.priceNum} / {p.priceDen}</span></Row>
              {p.predecessor && <Row label="Repriced from"><Link to={poolUrl(p.predecessor)} className="font-mono underline">{shortHex(p.predecessor, 8, 6)}</Link></Row>}
              {(pool.data?.bundle.length ?? 0) > 0 && (
                <Row label="Other side">{pool.data!.bundle.map(b => <Link key={b} to={poolUrl(b)} className="font-mono underline block">{shortHex(b, 8, 6)}</Link>)}</Row>
              )}
            </div>}
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Row({ label, title, children }: { label: string; title?: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4" title={title}>
      <span className="text-zinc-500 shrink-0">{label}</span>
      <span className="text-zinc-200 text-right font-mono min-w-0">{children}</span>
    </div>
  );
}

function CopyRow({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <Row label={label}>
      <span className="inline-flex items-center gap-1.5">
        {shortHex(value, 8, 6)}
        <button type="button" onClick={() => { void navigator.clipboard.writeText(value); toast.success('Copied'); }} className="text-zinc-500 hover:text-white"><Copy className="w-3 h-3" /></button>
        {href && <a href={href} target="_blank" rel="noreferrer" className="text-zinc-500 hover:text-white"><ExternalLink className="w-3 h-3" /></a>}
      </span>
    </Row>
  );
}

/** /mesh/pool/:txid/:vout (legacy outpoint links) → the pool's address page. */
export function MeshPoolOutpointRedirect() {
  const { txid, vout } = useParams();
  const navigate = useNavigate();
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    if (!txid) return;
    meshApi.byOutpoint(txid, Number(vout ?? 0))
      .then(r => navigate(poolUrl(r.address), { replace: true }))
      .catch(() => setMissing(true));
  }, [txid, vout, navigate]);
  if (missing) return <Navigate to="/mesh?tab=pools" replace />;
  return <div className="py-28 text-center text-zinc-400 text-sm"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" />Finding pool…</div>;
}

export default MeshPoolDetailPage;
