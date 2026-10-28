/**
 * One MeshPoolV3 pool: what it gives, every asset it accepts (price, volume,
 * fees, proceeds and where they go), recycling links, activity, and owner
 * actions (top up, withdraw).
 */
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRightLeft, ExternalLink, Loader2, Lock, MinusCircle, PlusCircle, Repeat, RefreshCw, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { meshApi, useInvalidateMesh, useMeshPoolActivity, useMeshSigner, useMeshStats, useSignerBalances } from '@/hooks/useMesh';
import type { Pool, PoolEvent } from '@/lib/mesh/meshApi';
import { v3ContractFor } from '@/lib/mesh/v3/v3Pool';
import { poolLevels, tokenRate } from '@/lib/mesh/v3/v3Display';
import { buildDeployV3, buildWithdrawV3 } from '@/lib/mesh/v3/v3Tx';
import { toBaseUnits } from '@/lib/mesh/v3/strategyForms';
import { sendPoolTxWithRetry, type BuiltTx } from '@/lib/mesh/poolTx';
import { explorerAddress, explorerTx, formatNumber, formatPct, formatSatsCompact, formatUnits, formatUsd, satsToUsd, shortHex, timeAgo } from '@/lib/mesh/format';
import { EmptyState, Panel, PanelTabs, PoolStatusBadge, StatTile, ThroughMarketNote, TokenAvatar, lpUrl, poolUrl, useTokenInfo, type TokenInfo } from '@/components/mesh/pools/shared';
import { ManageDock, useSmallScreen } from '@/components/mesh/ui/ManageDock';
import { PoolValueChart } from '@/components/mesh/pools/PoolActivity';
import { strategyUrl } from '@/components/mesh/strategies/StrategyBuilder';

export const MODE_LABEL: Record<string, string> = { owner: 'Proceeds to wallet', fixed: 'Proceeds to a fixed pool', mirror: 'Recycling' };

/** Symbol / decimals for BCH or a token category. */
export function useAssetInfo(cats: string[]) {
  const { get } = useTokenInfo(cats);
  return (c: string): TokenInfo => (c === '0x'
    ? { category: '0x', symbol: 'BCH', name: 'Bitcoin Cash', decimals: 8, icon: null, known: true }
    : get(c));
}

export function amountOf(v: string | bigint, info: TokenInfo): string {
  return info.category === '0x' ? formatSatsCompact(v) : `${formatUnits(v, info.decimals)} ${info.symbol}`;
}

/** "Gives BCH · accepts pUSD, mUSD" with icons. */
export function V3PoolLabel({ pool, size = 26 }: { pool: Pool; size?: number }) {
  const v3 = pool.v3!;
  const asset = useAssetInfo([v3.reserve, ...v3.slots.map(s => s.cat)]);
  const r = asset(v3.reserve);
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <div className="flex -space-x-2 shrink-0">
        {v3.reserve === '0x' ? <TokenAvatar info="BCH" size={size} /> : <TokenAvatar info={r} size={size} />}
        {v3.slots.map(s => (s.cat === '0x' ? <TokenAvatar key={s.cat} info="BCH" size={size - 6} className="mt-2" /> : <TokenAvatar key={s.cat} info={asset(s.cat)} size={size - 6} className="mt-2" />))}
      </div>
      <div className="min-w-0">
        <div className="font-bold text-white text-sm truncate">Gives {r.symbol} · accepts {v3.slots.map(s => asset(s.cat).symbol).join(', ')}</div>
        <div className="text-[10px] font-semibold uppercase tracking-wide text-amber-300/80">{MODE_LABEL[v3.modeName] ?? v3.modeName}</div>
      </div>
    </div>
  );
}

function describe(e: PoolEvent, pool: Pool, asset: (c: string) => TokenInfo): React.ReactNode {
  const reserve = asset(pool.v3!.reserve);
  if (e.type === 'FILL') {
    const legs = e.legs?.length ? e.legs : [{ asset: e.asset ?? '0x', amountIn: e.amountIn ?? '0', amountOut: e.amountOut ?? '0' }];
    return (
      <>
        {legs.map((l, i) => <span key={i}>{i > 0 && ' · '}Gave <b>{amountOf(l.amountOut, reserve)}</b> for <b>{amountOf(l.amountIn, asset(l.asset))}</b></span>)}
        {e.recycledTo && <> → <Link className="underline" to={poolUrl(e.recycledTo)}>recycled</Link></>}
      </>
    );
  }
  const parts = [BigInt(e.deltaSats) !== 0n ? formatSatsCompact(e.deltaSats.replace('-', '')) : null,
    BigInt(e.deltaTokens) !== 0n && reserve.category !== '0x' ? amountOf(e.deltaTokens.replace('-', ''), reserve) : null].filter(Boolean).join(' + ');
  if (e.type === 'DEPOSIT') {
    if (e.from) return <>Received {parts} recycled from <Link className="underline" to={poolUrl(e.from)}>{shortHex(e.from, 6, 4)}</Link></>;
    return <>Deposited {parts}{e.predecessor && <> from <Link className="underline" to={poolUrl(e.predecessor)}>previous pool</Link></>}</>;
  }
  if (e.type === 'REPRICE' || e.type === 'RECYCLE') return <>{e.type === 'RECYCLE' ? 'Recycled into' : 'Moved to'} <Link className="underline" to={poolUrl(e.successor!)}>new pool</Link> ({parts})</>;
  return <>Withdrew {parts}</>;
}

const TYPE_STYLE: Record<string, string> = {
  DEPOSIT: 'bg-sky-500/10 text-sky-300 border-sky-500/20', FILL: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  WITHDRAW: 'bg-rose-500/10 text-rose-300 border-rose-500/20', REPRICE: 'bg-violet-500/10 text-violet-300 border-violet-500/20',
  RECYCLE: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
};

export function V3ActivityTable({ pool, events, loading, network }: { pool: Pool; events: PoolEvent[]; loading?: boolean; network: 'chipnet' | 'mainnet' }) {
  const asset = useAssetInfo([pool.v3!.reserve, ...pool.v3!.slots.map(s => s.cat)]);
  if (!loading && events.length === 0) return <EmptyState title="No activity yet" />;
  return (
    <div className="overflow-x-auto -mx-2">
      <table className="w-full text-xs min-w-[600px]">
        <thead><tr className="text-left text-[10px] uppercase tracking-wide text-zinc-500 border-b border-white/5">
          <th className="px-2 py-2 font-medium">When</th><th className="px-2 py-2 font-medium">Type</th><th className="px-2 py-2 font-medium">Details</th><th className="px-2 py-2 font-medium">Tx</th>
        </tr></thead>
        <tbody>
          {events.map(e => (
            <tr key={`${e.txid}-${e.type}`} className="border-b border-white/[0.04]">
              <td className="px-2 py-2.5 text-zinc-400 whitespace-nowrap">{timeAgo(e.time)}{!e.confirmed && <span className="ml-1 text-amber-400">· pending</span>}</td>
              <td className="px-2 py-2.5"><span className={cn('px-2 py-0.5 rounded-full border text-[10px] font-semibold', TYPE_STYLE[e.type])}>{e.type}</span></td>
              <td className="px-2 py-2.5 text-zinc-300">{describe(e, pool, asset)}
                {e.type === 'FILL' && <div className="text-[10px] text-zinc-500 mt-0.5">{e.external ? 'external filler' : e.fillMethod === 'BALANCER' ? 'Mesh Balancer' : e.intentId ? `intent ${e.intentId.slice(0, 18)}` : 'Mesh solver'}</div>}
              </td>
              <td className="px-2 py-2.5"><a href={explorerTx(network, e.txid)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-zinc-400 hover:text-white">{shortHex(e.txid, 6, 4)}<ExternalLink className="w-3 h-3" /></a></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function V3PoolDetail({ pool: p, bundle, onSync, syncing }: { pool: Pool; bundle: string[]; onSync: () => void; syncing: boolean }) {
  const v3 = p.v3!;
  const stats = useMeshStats();
  const wallet = useMeshSigner();
  const activity = useMeshPoolActivity(p.address);
  const asset = useAssetInfo([v3.reserve, ...v3.slots.map(s => s.cat)]);
  const reserve = asset(v3.reserve);
  const bchUsd = stats.data?.bchUsd ?? null;
  const pnl = BigInt(p.stats.pnlSats);
  const strategyId = p.bundleId?.startsWith('stg-') ? p.bundleId : null;
  const small = useSmallScreen();
  const [info, setInfo] = useState<'activity' | 'position' | 'covenant'>(small ? 'activity' : 'position');
  // Activity is its own panel on large screens, a third view next to Position / Covenant on small ones.
  const tab = info === 'activity' && !small ? 'position' : info;
  const activityTable = <V3ActivityTable pool={p} events={activity.data?.events ?? []} loading={activity.isLoading} network={wallet.network} />;
  const byAsset = new Map((p.stats.byAsset ?? []).map(a => [a.asset, a]));

  return (
    <div className="container mx-auto pt-4 sm:pt-6 pb-28 lg:pb-6 px-4 md:px-8 max-w-[1200px] space-y-6">
      <ThroughMarketNote pools={[p]} owner={!!wallet.pkh && wallet.pkh === p.ownerPkh} />
      <Link to={strategyId ? strategyUrl(strategyId) : '/mesh/pools'} className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300"><ArrowLeft className="w-3.5 h-3.5" />{strategyId ? 'Strategy' : 'Pools'}</Link>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 min-w-0">
          <V3PoolLabel pool={p} size={34} />
          <PoolStatusBadge status={p.status} />
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full border border-white/10 text-zinc-400">V3</span>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-full border border-white/10 text-zinc-400">{(p.feeBps / 100).toFixed(2)}% fee</span>
          {p.pairRole === 'REVERSE' && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full border border-amber-500/30 text-amber-300">mirror pool</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="rounded-xl" onClick={onSync} disabled={syncing}><RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${syncing ? 'animate-spin' : ''}`} />Sync with chain</Button>
          <Link to="/trade"><Button size="sm" className="rounded-xl"><ArrowRightLeft className="w-3.5 h-3.5 mr-1.5" />Trade</Button></Link>
        </div>
      </div>

      {p.status === 'closed' && p.pairRole === 'REVERSE' && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-200">This mirror pool is empty. It fills up automatically when its forward pool trades, then sells back at your price.</div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label="Pool value" value={formatSatsCompact(p.valueSats)} sub={bchUsd ? formatUsd(satsToUsd(p.valueSats, bchUsd)) : undefined} />
        <StatTile label="Available to trade" value={amountOf(p.availableOut, reserve)} sub={`reserve ${amountOf(v3.reserve === '0x' ? p.reserves.sats : p.reserves.tokens, reserve)}`} />
        <StatTile label="Volume 7d" value={formatSatsCompact(p.stats.volume7dSats)} sub={`${p.stats.fillCount} fills all time`} />
        <StatTile label="LP fees 7d" value={formatSatsCompact(p.stats.fees7dSats)} accent="text-emerald-400" sub={`APR est. ${formatPct(p.stats.feeApr7dPct)}`} />
      </div>

      <Panel title="Accepted assets">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {v3.slots.map(s => {
            const a = asset(s.cat);
            const st = byAsset.get(s.cat);
            const lv = poolLevels(p.address, v3, c => asset(c).decimals).filter(l => l.token === (v3.reserve === '0x' ? s.cat : v3.reserve) && !l.fromMirror)[0];
            const price = lv ? `1 BCH = ${formatNumber(lv.traderTokenPerBch, 4)} ${v3.reserve === '0x' ? a.symbol : reserve.symbol}`
              : `1 ${a.symbol} = ${formatNumber(tokenRate(s, v3.feeBps, reserve.decimals, a.decimals), 6)} ${reserve.symbol}`;
            return (
              <div key={s.cat} className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-2 text-xs">
                <div className="flex items-center gap-2">{s.cat === '0x' ? <TokenAvatar info="BCH" size={22} /> : <TokenAvatar info={a} size={22} />}<span className="font-bold text-white text-sm">{a.symbol}</span></div>
                <div className="font-mono text-zinc-200">{price}</div>
                <div className="text-zinc-500">trader price after the fee</div>
                {st && (
                  <div className="grid grid-cols-2 gap-1 text-[11px] pt-1">
                    <span className="text-zinc-500">Fills</span><span className="text-right font-mono text-zinc-300">{st.fills}</span>
                    <span className="text-zinc-500">Volume 7d</span><span className="text-right font-mono text-zinc-300">{formatSatsCompact(st.volume7dSats)}</span>
                    <span className="text-zinc-500">Fees all</span><span className="text-right font-mono text-emerald-400">{formatSatsCompact(st.feesAllSats)}</span>
                    <span className="text-zinc-500">Received</span><span className="text-right font-mono text-zinc-300">{amountOf(st.proceeds, a)}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 pt-1">
                  {s.proceeds.kind === 'mirror' ? <><Repeat className="w-3.5 h-3.5 text-amber-300" />Recycles into <Link className="underline font-mono" to={poolUrl(s.proceeds.address)}>{shortHex(s.proceeds.address, 6, 4)}</Link></>
                    : s.proceeds.kind === 'owner' ? <><Wallet className="w-3.5 h-3.5" />Proceeds to the owner's wallet</> : <>Proceeds to a fixed pool</>}
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 space-y-6">
          <Panel title="Reserve value" action={<span className="text-[11px] text-zinc-500">after each event</span>}>
            <PoolValueChart pool={p} events={activity.data?.events ?? []} token={reserve.category === '0x' ? { ...reserve, decimals: 0 } : reserve} />
          </Panel>
          {!small && (
            <Panel title="Activity" action={<span className="text-[11px] text-zinc-500">{activity.data?.total ?? 0} events</span>}>{activityTable}</Panel>
          )}
        </div>
        <div className="lg:col-span-5 space-y-6">
          <V3ManagePanel pool={p} reserve={reserve} />
          <Panel title={<PanelTabs tabs={small ? POOL_INFO_TABS : POOL_INFO_TABS.slice(1)} value={tab} onChange={setInfo} />}>
            {tab === 'activity' && activityTable}
            {tab === 'position' && <div className="space-y-2.5 text-xs">
              <Row label="Deposited">{formatSatsCompact(p.stats.deposited.sats)}{BigInt(p.stats.deposited.tokens) > 0n && v3.reserve !== '0x' && ` + ${amountOf(p.stats.deposited.tokens, reserve)}`}</Row>
              <Row label="Withdrawn">{formatSatsCompact(p.stats.withdrawn.sats)}{BigInt(p.stats.withdrawn.tokens) > 0n && v3.reserve !== '0x' && ` + ${amountOf(p.stats.withdrawn.tokens, reserve)}`}</Row>
              <Row label="Proceeds paid out">{formatSatsCompact(p.stats.proceedsValueSats ?? '0')}</Row>
              <Row label="P&L"><span className={pnl >= 0n ? 'text-emerald-400' : 'text-rose-400'}>{pnl >= 0n ? '+' : ''}{formatSatsCompact(p.stats.pnlSats)}</span></Row>
              <Row label="Created">{timeAgo(p.createdAt)}</Row>
            </div>}
            {tab === 'covenant' && <div className="space-y-2.5 text-xs">
              <Row label="Pool address"><a className="inline-flex items-center gap-1 hover:text-white" href={explorerAddress(wallet.network, p.address)} target="_blank" rel="noreferrer">{shortHex(p.address, 8, 6)}<ExternalLink className="w-3 h-3" /></a></Row>
              <Row label="LP"><Link to={lpUrl(p.ownerPkh)} className="underline-offset-2 hover:underline">{shortHex(p.ownerAddress, 8, 6)}</Link></Row>
              {strategyId && <Row label="Strategy"><Link to={strategyUrl(strategyId)} className="underline">{strategyId.slice(0, 16)}…</Link></Row>}
              {bundle.length > 0 && <Row label="Same bundle">{bundle.map(b => <Link key={b} to={poolUrl(b)} className="underline block">{shortHex(b, 8, 6)}</Link>)}</Row>}
            </div>}
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex justify-between gap-4"><span className="text-zinc-500 shrink-0">{label}</span><span className="text-zinc-200 text-right font-mono min-w-0">{children}</span></div>;
}

export const POOL_INFO_TABS = [['activity', 'Activity'], ['position', 'Position'], ['covenant', 'Covenant']] as const;

const POOL_OPTIONS = [
  { key: 'topup', label: 'Top up', icon: PlusCircle },
  { key: 'withdraw', label: 'Withdraw', icon: MinusCircle, tone: 'danger' },
] as const;

/** Owner actions on a V3 pool: top up the reserve, withdraw (partial / full). */
function V3ManagePanel({ pool, reserve }: { pool: Pool; reserve: TokenInfo }) {
  const wallet = useMeshSigner();
  const invalidate = useInvalidateMesh();
  const balances = useSignerBalances(wallet.signer);
  const [tab, setTab] = useState<'topup' | 'withdraw'>(pool.status === 'active' ? 'topup' : 'withdraw');
  const [amount, setAmount] = useState('');
  const [percent, setPercent] = useState(100);
  const [pending, setPending] = useState<{ label: string; built: BuiltTx; rebuild: () => Promise<BuiltTx> } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isOwner = !!wallet.pkh && wallet.pkh === pool.ownerPkh;
  const reserveBch = pool.v3!.reserve === '0x';

  const totals = useMemo(() => pool.utxos.reduce((a, u) => ({ sats: a.sats + BigInt(u.sats), tokens: a.tokens + BigInt(u.tokens) }), { sats: 0n, tokens: 0n }), [pool.utxos]);

  if (!wallet.signer || !isOwner) {
    return (
      <Panel title="Manage">
        <div className="flex gap-3 text-xs text-zinc-400"><Lock className="w-4 h-4 shrink-0 text-zinc-500 mt-0.5" />
          {!wallet.signer ? 'Connect the wallet that owns this pool to top it up or withdraw.' : `Only the owner (${shortHex(pool.ownerAddress, 8, 6)}) can move these funds.`}</div>
      </Panel>
    );
  }
  const signer = wallet.signer;
  const contract = () => v3ContractFor(pool.v3!, pool.address, signer.provider);

  async function prepare(label: string, build: () => Promise<BuiltTx>) {
    setError(null); setBusy('Building transaction…');
    try { setPending({ label, built: await build(), rebuild: build }); } catch (e: any) { setError(e?.message ?? String(e)); } finally { setBusy(null); }
  }
  async function confirm() {
    if (!pending) return;
    setBusy(wallet.kind === 'external' ? 'Approve in your wallet…' : 'Signing and broadcasting…');
    try {
      const approve = wallet.kind === 'external' ? 'Approve again in your wallet…' : 'Signing and broadcasting again…';
      const txid = await sendPoolTxWithRetry(signer, pending.built, pending.label, pending.rebuild,
        () => setBusy(`A trade just filled this pool. Building again on what it holds now. ${approve}`));
      setBusy('Waiting for the server to index it…');
      for (let i = 0; i < 8; i++) {
        await meshApi.sync(pool.address).catch(() => undefined);
        const act = await meshApi.activity(pool.address, { limit: 10 }).catch(() => null);
        if (act?.events.some(e => e.txid === txid)) break;
        await new Promise(r => setTimeout(r, 3_000));
      }
      toast.success(pending.label, { description: `tx ${shortHex(txid)}` });
      setPending(null); setAmount(''); invalidate();
    } catch (e: any) { setError(e?.message ?? String(e)); } finally { setBusy(null); }
  }

  const topUp = () => prepare('Top up pool', async () => {
    const units = toBaseUnits(amount || '0', reserveBch ? 8 : reserve.decimals);
    const { params } = contract();
    return buildDeployV3(signer, [{ params, sats: reserveBch ? units : 1_000n, tokens: reserveBch ? 0n : units }]);
  });
  const withdraw = () => prepare(percent === 100 ? 'Withdraw all' : `Withdraw ${percent}%`, async () => {
    const utxos = await signer.provider.getUtxos(pool.address);
    if (!utxos.length) throw new Error('The pool has no funds on-chain right now');
    return buildWithdrawV3(signer, [{ contract: contract().contract, utxos }], { percent, reserve: pool.v3!.reserve });
  });

  const walletAsset = reserveBch ? balances.data?.sats : balances.data?.tokens[pool.v3!.reserve];
  const outShare = (v: bigint) => (percent === 100 ? v : (v * BigInt(percent * 100)) / 10_000n);

  return (
    <ManageDock title="Manage your pool" options={POOL_OPTIONS} value={tab} onChange={k => { setTab(k); setError(null); }}>
      {tab === 'topup' && (
        <div className="space-y-3">
          <div className="flex justify-between text-xs text-zinc-400"><span>Add {reserve.symbol}</span><span className="font-mono">Wallet: {walletAsset === undefined ? '—' : amountOf(walletAsset, reserve)}</span></div>
          <div className="flex gap-2 items-center"><Input value={amount} onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" placeholder="0.0" className="font-mono bg-black/40 border-white/10" /><span className="text-sm text-zinc-300">{reserve.symbol}</span></div>
          <Button className="w-full rounded-xl" disabled={!amount || !!busy} onClick={topUp}>{busy && !pending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Review top-up'}</Button>
        </div>
      )}
      {tab === 'withdraw' && (
        <div className="space-y-3">
          <div className="flex justify-between text-xs text-zinc-400"><span>Share to withdraw</span><span className="font-mono text-white">{percent}%</span></div>
          <Slider value={[percent]} min={1} max={100} step={1} onValueChange={v => setPercent(v[0] ?? 100)} />
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] text-xs font-mono text-zinc-200">
            {reserveBch ? formatSatsCompact(outShare(totals.sats)) : amountOf(outShare(totals.tokens), reserve)}
            {!reserveBch && <div className="text-[11px] text-zinc-500 font-sans mt-1">A token pool holds only its carrier sats, so your wallet pays the network fee.</div>}
          </div>
          <Button className="w-full rounded-xl" variant={percent === 100 ? 'destructive' : 'default'} disabled={!!busy || pool.utxos.length === 0} onClick={withdraw}>
            {busy && !pending ? <Loader2 className="w-4 h-4 animate-spin" /> : percent === 100 ? 'Review full withdraw' : `Review ${percent}% withdraw`}
          </Button>
        </div>
      )}
      {pending && (
        <div className="p-3 rounded-xl border border-white/15 bg-white/[0.03] space-y-2 text-xs">
          <div className="flex justify-between"><span className="font-semibold text-white">{pending.label}</span><span className="font-mono text-zinc-400">fee {pending.built.fee.toString()} sats</span></div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="flex-1 rounded-lg" disabled={!!busy} onClick={() => setPending(null)}>Cancel</Button>
            <Button size="sm" className="flex-1 rounded-lg" disabled={!!busy} onClick={confirm}>{busy ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />{busy}</> : 'Sign and send'}</Button>
          </div>
        </div>
      )}
      {error && <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-200">{error}</div>}
    </ManageDock>
  );
}
