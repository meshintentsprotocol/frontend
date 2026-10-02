/**
 * /mesh/strategy/:id — one strategy: totals, member pools (including mirror
 * pools created by recycling), the price ladder, merged activity, and owner
 * actions: rebalance into a new template / parameters (one transaction) and
 * withdraw everything.
 */
import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, ArrowLeft, Loader2, Lock, MinusCircle, Recycle, Repeat, Shuffle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { meshApi, useIdle, useInvalidateMesh, useMeshSigner, useMeshStats, useSignerBalances, useStrategy, useStrategySuggest, useStrategyTemplates } from '@/hooks/useMesh';
import type { Pool, PoolEvent } from '@/lib/mesh/meshApi';
import { formatPct, formatSatsCompact, formatUsd, satsToUsd, shortHex, timeAgo } from '@/lib/mesh/format';
import { poolLevels } from '@/lib/mesh/v3/v3Display';
import { v3ContractFor } from '@/lib/mesh/v3/v3Pool';
import { buildWithdrawV3, type ClosePool } from '@/lib/mesh/v3/v3Tx';
import { sendPoolTx, type BuiltTx } from '@/lib/mesh/poolTx';
import { Panel, poolUrl } from '@/components/mesh/pools/shared';
import { DefiCard, IdlePill, InventoryBar, MarketStrip, MetricCell, RecyclePill, StatusPill, TemplateIcon, VsMid, poolVsMidBps, templateName, tokensPerBch } from '@/components/mesh/ui/defi';
import { RecycleDialog } from '@/components/mesh/strategies/RecycleDialog';
import { strategyRecycles } from '@/components/mesh/strategies/StrategyCard';
import { PriceLadder } from '@/components/mesh/strategies/PriceLadder';
import { strategyUrl } from '@/components/mesh/strategies/StrategyBuilder';
import { V3PoolLabel, amountOf, useAssetInfo } from '@/components/mesh/v3/V3PoolDetail';

export function MeshStrategyPage() {
  const { id: raw } = useParams();
  const id = raw ? decodeURIComponent(raw) : undefined;
  const q = useStrategy(id);
  const stats = useMeshStats();
  const wallet = useMeshSigner();
  const s = q.data?.strategy;
  const pools = q.data?.pools ?? [];
  const cats = useMemo(() => [...new Set(pools.flatMap(p => (p.v3 ? [p.v3.reserve, ...p.v3.slots.map(x => x.cat)] : [])))], [pools]);
  const asset = useAssetInfo(cats);
  const activity = useQueries({ queries: pools.map(p => ({ queryKey: ['mesh', 'activity', p.address], queryFn: () => meshApi.activity(p.address, { limit: 50 }), refetchInterval: 20_000 })) });
  const firstToken = cats.find(c => c !== '0x');
  const market = useStrategySuggest(s && firstToken ? { template: s.template === 'multi-pair' || s.template === 'stable-pair' ? 'fixed' : s.template, token: firstToken } : null);
  const idle = useIdle(wallet.pkh && s && wallet.pkh === s.ownerPkh ? wallet.pkh : null);
  const [recycleOpen, setRecycleOpen] = useState(false);

  if (q.isLoading) return <div className="py-28 text-center text-zinc-400 text-sm"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-emerald-400" />Loading strategy…</div>;
  if (!s) {
    return (
      <div className="container mx-auto max-w-lg py-16"><Panel><div className="text-center space-y-3 py-6">
        <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
        <h2 className="text-xl font-bold text-white">Strategy not found</h2>
        <Link to="/mesh?tab=positions" className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-300 hover:text-white"><ArrowLeft className="w-4 h-4" />My positions</Link>
      </div></Panel></div>
    );
  }

  const bchUsd = stats.data?.bchUsd ?? null;
  const pnl = BigInt(s.pnlSats);
  const roleOf = (address: string) => s.pools.find(x => x.address === address)?.role ?? 'member';
  const mainToken = cats.find(c => c !== '0x') ?? '';
  const levels = pools.flatMap(p => (p.v3 ? poolLevels(p.address, p.v3, c => asset(c).decimals, roleOf(p.address)) : [])).filter(l => l.token === mainToken);
  const mainInfo = asset(mainToken);
  const ctx = market.data?.market?.[mainToken] ?? null;
  const mid = ctx?.midSatsPerToken ?? null;
  const marketTokensPerBch = mid ? tokensPerBch(mid, mainInfo.decimals) : null;
  const myIdle = idle.data?.items.filter(i => i.strategy === s.id) ?? [];
  const value = Number(s.valueSats);
  const bchPart = s.inventory ? Number(s.inventory.sats) : null;
  const ageH = (Date.now() / 1000 - s.createdAt) / 3600;
  const events = activity.flatMap((a, i) => (a.data?.events ?? []).map(e => ({ ...e, pool: pools[i]! })))
    .sort((a, b) => b.time - a.time).slice(0, 60) as Array<PoolEvent & { pool: Pool }>;
  const links = pools.flatMap(p => (p.v3?.slots ?? []).filter(x => x.proceeds.kind === 'mirror').map(x => ({ from: p, to: (x.proceeds as { address: string }).address })));

  return (
    <div className="container mx-auto py-4 sm:py-6 px-4 md:px-8 max-w-[1200px] space-y-6">
      <Link to="/mesh?tab=positions" className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300"><ArrowLeft className="w-3.5 h-3.5" />My positions</Link>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <TemplateIcon id={s.template} className="w-11 h-11" />
          <div className="min-w-0">
            <h1 className="font-heading text-2xl sm:text-3xl font-bold text-white tracking-tight">{templateName(s.template)}</h1>
            <p className="text-xs text-zinc-500 font-mono mt-1 truncate">{s.id} · deployed {timeAgo(s.createdAt)}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {strategyRecycles(s) && <RecyclePill />}
          {myIdle.length > 0 && <IdlePill title={myIdle.map(i => i.reason).join(' · ')} />}
          <StatusPill status={s.status} />
        </div>
      </div>
      {myIdle.length > 0 && idle.data && (
        <DefiCard tone="idle" className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-amber-100">
            <div className="font-heading text-sm font-semibold text-white">Part of this strategy is idle</div>
            {myIdle.map(i => <div key={i.id} className="text-[11px] text-amber-200/90">{i.reason} · <span className="font-mono">{formatSatsCompact(i.valueSats)}</span></div>)}
          </div>
          <Button className="rounded-xl font-bold shrink-0" onClick={() => setRecycleOpen(true)}><Recycle className="w-4 h-4 mr-1.5" />Recycle</Button>
          <RecycleDialog open={recycleOpen} onOpenChange={setRecycleOpen}
            report={{ ...idle.data, items: myIdle, count: myIdle.length, totalValueSats: myIdle.reduce((a, i) => a + BigInt(i.valueSats), 0n).toString() }}
            infoOf={c => asset(c)} bchUsd={bchUsd} />
        </DefiCard>
      )}
      {s.replacedBy && (
        <div className="p-4 rounded-2xl bg-violet-500/10 border border-violet-500/25 text-xs text-violet-200 flex justify-between gap-3">
          <span>This strategy was rebalanced; its funds moved to a new one.</span><Link className="underline font-semibold" to={strategyUrl(s.replacedBy)}>Open it</Link>
        </div>
      )}
      {s.replaces && <div className="text-[11px] text-zinc-500">Rebalanced from <Link className="underline" to={strategyUrl(s.replaces)}>{s.replaces.slice(0, 16)}…</Link></div>}

      <DefiCard className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <MetricCell label="Value" value={formatSatsCompact(s.valueSats)} sub={bchUsd ? formatUsd(satsToUsd(s.valueSats, bchUsd)) : undefined} />
          <MetricCell label="P&L" value={`${pnl >= 0n ? '+' : ''}${formatSatsCompact(s.pnlSats)}`} accent={pnl >= 0n ? 'text-emerald-300' : 'text-rose-300'} sub="value + withdrawn + proceeds − deposits" />
          <MetricCell label="Fees" value={formatSatsCompact(s.feesAllSats)} accent="text-emerald-300" sub={`7d ${formatSatsCompact(s.fees7dSats)}`} />
          <MetricCell label="Fee APR" value={s.feeApr7dPct !== null && s.feeApr7dPct !== undefined ? formatPct(s.feeApr7dPct) : '—'}
            sub={s.feeApr7dPct === null || s.feeApr7dPct === undefined ? (ageH < 24 ? 'after 24 h of history' : 'no value yet') : 'estimate · last 7d'} />
          <MetricCell label="Volume 7d" value={formatSatsCompact(s.volume7dSats)} sub={`${s.fillCount} fills${s.lastFillAt ? ` · last ${timeAgo(s.lastFillAt)}` : ''}`} />
        </div>
        {bchPart !== null && value > 0 && (
          <InventoryBar segments={[
            { label: 'BCH', valueSats: Math.min(bchPart, value), tone: 'bch' },
            { label: mainToken ? mainInfo.symbol : 'Tokens', valueSats: Math.max(0, value - bchPart), tone: 'token' },
          ]} />
        )}
      </DefiCard>
      {mainToken && <MarketStrip ctx={ctx} symbol={mainInfo.symbol} decimals={mainInfo.decimals} loading={market.isLoading} />}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 space-y-6">
          {levels.length > 0 && <Panel title="Price ladder"><PriceLadder levels={levels} market={marketTokensPerBch} symbol={mainInfo.symbol} /></Panel>}
          <Panel title="Pools" action={<span className="text-[11px] text-zinc-500">{s.activePools} of {s.poolCount} active</span>}>
            <div className="space-y-2">
              {pools.map(p => (
                <Link key={p.address} to={poolUrl(p.address)} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-black/30 border border-white/[0.06] hover:border-white/20">
                  <div className="min-w-0 space-y-1">
                    {p.v3 ? <V3PoolLabel pool={p} size={22} /> : <span className="text-sm text-white">{shortHex(p.address, 8, 6)}</span>}
                    <div className="text-[10px] text-zinc-500 capitalize">{roleOf(p.address).replace('-', ' ')}</div>
                  </div>
                  <div className="text-right text-xs space-y-1 shrink-0">
                    <div className="font-mono text-zinc-200">{p.v3 ? amountOf(p.v3.reserve === '0x' ? p.reserves.sats : p.reserves.tokens, asset(p.v3.reserve)) : formatSatsCompact(p.valueSats)}</div>
                    {p.v3 && mid && <div><VsMid bps={poolVsMidBps(p.v3, mid)} /></div>}
                    <StatusPill status={p.status} />
                  </div>
                </Link>
              ))}
            </div>
          </Panel>
          {links.length > 0 && (
            <Panel title="Recycling">
              <div className="space-y-2 text-xs">
                {links.map(l => (
                  <div key={`${l.from.address}-${l.to}`} className="flex items-center gap-2 text-zinc-400">
                    <Link className="font-mono underline" to={poolUrl(l.from.address)}>{shortHex(l.from.address, 6, 4)}</Link>
                    <Repeat className="w-3.5 h-3.5 text-amber-300" />
                    <Link className="font-mono underline" to={poolUrl(l.to)}>{shortHex(l.to, 6, 4)}</Link>
                    <span className="text-zinc-500">fills of one fund the other, at your prices</span>
                  </div>
                ))}
              </div>
            </Panel>
          )}
          <Panel title="Activity">
            {events.length === 0 ? <p className="text-xs text-zinc-500">No activity yet.</p> : (
              <div className="space-y-1.5 text-xs">
                {events.map(e => (
                  <div key={`${e.pool.address}-${e.txid}-${e.type}`} className="flex justify-between gap-3 py-1.5 border-b border-white/[0.04]">
                    <span className="text-zinc-400 w-20 shrink-0">{timeAgo(e.time)}</span>
                    <span className="font-semibold text-zinc-200 w-20 shrink-0">{e.type}</span>
                    <span className="text-zinc-400 flex-1 min-w-0 truncate">
                      {e.type === 'FILL' && e.asset ? `gave ${amountOf(e.amountOut ?? '0', asset(e.pool.v3?.reserve ?? '0x'))} for ${amountOf(e.amountIn ?? '0', asset(e.asset))}` : `${formatSatsCompact(e.deltaSats)}`}
                      {e.recycledTo ? ' → recycled' : ''}{e.from ? ' (recycled in)' : ''}
                    </span>
                    <Link to={poolUrl(e.pool.address)} className="font-mono text-zinc-500 hover:text-white">{shortHex(e.pool.address, 4, 4)}</Link>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
        <div className="lg:col-span-5 space-y-6">
          <StrategyActions strategy={s} pools={pools} ownerPkh={s.ownerPkh} />
        </div>
      </div>
    </div>
  );
}

/** Rebalance (N → M in one tx) and withdraw everything. Owner only. */
function StrategyActions({ strategy, pools, ownerPkh }: { strategy: NonNullable<ReturnType<typeof useStrategy>['data']>['strategy']; pools: Pool[]; ownerPkh: string }) {
  const wallet = useMeshSigner();
  const navigate = useNavigate();
  const invalidate = useInvalidateMesh();
  const templates = useStrategyTemplates();
  const balances = useSignerBalances(wallet.signer);
  const [mode, setMode] = useState<'rebalance' | 'withdraw'>('rebalance');
  const [template, setTemplate] = useState(strategy.template);
  const [pending, setPending] = useState<{ label: string; built: BuiltTx; after: (txid: string) => Promise<void> } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isOwner = !!wallet.pkh && wallet.pkh === ownerPkh;

  if (!wallet.signer || !isOwner) {
    return <Panel title="Manage"><div className="flex gap-3 text-xs text-zinc-400"><Lock className="w-4 h-4 shrink-0 text-zinc-500 mt-0.5" />Connect the wallet that owns this strategy to rebalance or withdraw.</div></Panel>;
  }
  const signer = wallet.signer;

  /** Every live pool UTXO, with a contract rebuilt locally from the server's params (address checked). */
  const closeSet = async (): Promise<ClosePool[]> => {
    const out: ClosePool[] = [];
    for (const p of pools) {
      if (!p.v3) continue;
      const utxos = await signer.provider.getUtxos(p.address);
      if (utxos.length) out.push({ contract: v3ContractFor(p.v3, p.address, signer.provider).contract, utxos });
    }
    return out;
  };

  async function prepare(label: string, build: () => Promise<BuiltTx>, after: (txid: string) => Promise<void>) {
    setError(null); setBusy('Building transaction…');
    try { setPending({ label, built: await build(), after }); } catch (e: any) { setError(e?.message ?? String(e)); } finally { setBusy(null); }
  }
  async function confirm() {
    if (!pending) return;
    setBusy(wallet.kind === 'external' ? 'Approve in your wallet…' : 'Signing and broadcasting…');
    try {
      const txid = await sendPoolTx(signer, pending.built, pending.label);
      setBusy('Updating the Mesh server…');
      await pending.after(txid);
      toast.success(pending.label, { description: `tx ${shortHex(txid)}` });
      setPending(null); invalidate();
    } catch (e: any) { setError(e?.message ?? String(e)); } finally { setBusy(null); }
  }

  const syncAll = async () => { for (const p of pools) await meshApi.sync(p.address).catch(() => undefined); };

  const withdrawAll = () => prepare('Withdraw the whole strategy', async () => {
    const close = await closeSet();
    if (!close.length) throw new Error('Nothing left in these pools');
    return buildWithdrawV3(signer, close);
  }, async () => { await new Promise(r => setTimeout(r, 2_000)); await syncAll(); });

  const rebalance = () => navigate(`/mesh?tab=create&template=${encodeURIComponent(template)}&replaces=${encodeURIComponent(strategy.id)}`);

  const tmpl = templates.data?.templates.find(t => t.id === template);
  return (
    <Panel title="Manage your strategy">
      <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-black/40 border border-white/[0.06]">
        {([['rebalance', 'Rebalance', Shuffle], ['withdraw', 'Withdraw all', MinusCircle]] as const).map(([k, l, Icon]) => (
          <button key={k} type="button" onClick={() => { setMode(k); setError(null); }}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold ${mode === k ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}><Icon className="w-3.5 h-3.5" />{l}</button>
        ))}
      </div>
      {mode === 'rebalance' && (
        <div className="space-y-3 text-xs">
          <p className="text-zinc-400">Closes every pool of this strategy and opens the new set in one transaction. Your wallet adds any missing funds and the fee.</p>
          <select value={template} onChange={e => setTemplate(e.target.value)} className="w-full h-9 rounded-xl bg-black/40 border border-white/10 px-3 text-sm text-white">
            {(templates.data?.templates ?? []).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          {tmpl && <p className="text-[11px] text-zinc-500">{tmpl.summary}</p>}
          <Button className="w-full rounded-xl" disabled={!!busy} onClick={rebalance}>Choose new parameters</Button>
        </div>
      )}
      {mode === 'withdraw' && (
        <div className="space-y-3 text-xs">
          <p className="text-zinc-400">Docks every pool of this strategy (mirror pools included) back to your wallet in one transaction.</p>
          <Button className="w-full rounded-xl" variant="destructive" disabled={!!busy} onClick={withdrawAll}>{busy && !pending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Review withdraw'}</Button>
        </div>
      )}
      {pending && (
        <div className="p-3 rounded-xl border border-white/15 bg-white/[0.03] space-y-2 text-xs">
          <div className="flex justify-between"><span className="font-semibold text-white">{pending.label}</span><span className="font-mono text-zinc-400">fee {pending.built.fee.toString()} sats</span></div>
          <div className="text-zinc-500">{pending.built.inputs} input(s) → {pending.built.outputs.length} output(s)</div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="flex-1 rounded-lg" disabled={!!busy} onClick={() => setPending(null)}>Cancel</Button>
            <Button size="sm" className="flex-1 rounded-lg" disabled={!!busy} onClick={confirm}>{busy ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />{busy}</> : 'Sign and send'}</Button>
          </div>
        </div>
      )}
      {error && <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-200">{error}</div>}
      {balances.data && <div className="text-[10px] text-zinc-500 font-mono">Wallet: {formatSatsCompact(balances.data.sats)}</div>}
    </Panel>
  );
}

export default MeshStrategyPage;
