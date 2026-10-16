/**
 * A Mesh V4 position: in-place bins owned by an NFT (/mesh/position/:category).
 *
 * Header (name from the position's BCMR registry, NFT category, holder, engine),
 * totals, the bin strip on the grid, activity read from the chain, and — for the
 * wallet holding the NFT — Withdraw and Send. A genesis this browser broadcast
 * but could not register yet is registered from here.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ExternalLink, Gem, Info, Loader2, MinusCircle, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { meshApi, useInvalidateMesh, useMarketRef, useMeshSigner } from '@/hooks/useMesh';
import { useV4Activity, useV4Position } from '@/hooks/useMeshV4';
import { MeshApiError } from '@/lib/mesh/meshApi';
import { explorerTx, formatNumber, formatSatsCompact, formatUnits, shortHex } from '@/lib/mesh/format';
import { tokenPerBchFromSatsPerUnit } from '@/lib/mesh/pool';
import { gridPriceNum } from '@/lib/mesh/v4/position';
import { pendingV4, removePendingV4, tokenPerBch } from '@/lib/mesh/v4/display';
import type { V4ActivityEvent } from '@/lib/mesh/v4/types';
import { Panel, TokenAvatar, useTokenInfo } from '@/components/mesh/pools/shared';
import { DefiCard, MetricCell } from '@/components/mesh/ui/defi';
import { EngineBadge } from '@/components/mesh/v4/V4DeployPanel';
import { BinStrip } from '@/components/mesh/v4/BinStrip';
import { TransferV4Dialog, WithdrawV4Dialog } from '@/components/mesh/v4/V4ManageDialogs';
import { cn } from '@/lib/utils';

const KIND: Record<V4ActivityEvent['kind'], { label: string; cls: string }> = {
  deposit: { label: 'Deposit', cls: 'text-sky-300' },
  'top-up': { label: 'Top-up', cls: 'text-sky-300' },
  buy: { label: 'Sold tokens', cls: 'text-amber-300' },        // a trader bought tokens from the bin
  sell: { label: 'Bought tokens', cls: 'text-emerald-300' },   // a trader sold tokens to the bin
  withdraw: { label: 'Withdraw', cls: 'text-zinc-300' },
};

/** The name in the position's BCMR registry (served byte-exact by Mesh). */
function usePositionName(category: string | undefined) {
  return useQuery({
    queryKey: ['mesh', 'v4', 'name', category ?? ''],
    enabled: !!category,
    staleTime: Infinity,
    retry: false,
    queryFn: async () => {
      const r = await fetch(`${meshApi.baseUrl}/api/v1/v4/metadata/${category}.json`);
      if (!r.ok) return null;
      const j = await r.json();
      const revs = j?.identities?.[category!];
      const latest = revs ? revs[Object.keys(revs).sort().pop()!] : null;
      return (latest?.name as string | undefined) ?? null;
    },
  });
}

export default function MeshPositionPage() {
  const { category: raw } = useParams();
  const category = (raw ?? '').toLowerCase();
  const wallet = useMeshSigner();
  const invalidate = useInvalidateMesh();
  const holderAddr = wallet.signer?.tokenAddress ?? null;
  const pos = useV4Position(/^[0-9a-f]{64}$/.test(category) ? category : undefined, holderAddr);
  const activity = useV4Activity(pos.data ? category : undefined);
  const name = usePositionName(pos.data ? category : undefined);
  const tokenCat = pos.data?.commitment.tokenCat;
  const { get } = useTokenInfo([tokenCat]);
  const info = get(tokenCat);
  const market = useMarketRef(tokenCat);
  const marketTpb = market.data?.cauldron ? Number(tokenPerBchFromSatsPerUnit(market.data.cauldron.satsPerToken, info.decimals)) : null;
  const [dialog, setDialog] = useState<'withdraw' | 'send' | null>(null);

  // a genesis this browser broadcast but did not get registered: register it now
  const notFound = pos.error instanceof MeshApiError && pos.error.status === 404;
  const pending = useMemo(() => pendingV4().find(p => p.category === category), [category, notFound]); // eslint-disable-line react-hooks/exhaustive-deps
  const [registering, setRegistering] = useState<string | null>(null);
  useEffect(() => {
    if (!notFound || !pending || registering) return;
    let stop = false;
    (async () => {
      setRegistering('Registering the position…');
      for (let i = 0; i < 10 && !stop; i++) {
        try {
          await meshApi.v4Register({ genesisTxid: pending.genesisTxid, bins: pending.bins, pairName: pending.pairName });
          removePendingV4(category);
          invalidate();
          break;
        } catch (e: any) {
          if (e instanceof MeshApiError && e.status === 409) { removePendingV4(category); invalidate(); break; }
          setRegistering(`Waiting for the genesis to be visible (${e?.message ?? e})…`);
          await new Promise(r => setTimeout(r, 4000));
        }
      }
      if (!stop) setRegistering(null);
    })();
    return () => { stop = true; };
  }, [notFound, pending]); // eslint-disable-line react-hooks/exhaustive-deps

  const fills = useMemo(() => {
    const m = new Map<number, { buys: number; sells: number }>();
    for (const e of activity.data?.events ?? []) {
      if (e.kind !== 'buy' && e.kind !== 'sell') continue;
      const x = m.get(e.bin) ?? { buys: 0, sells: 0 };
      if (e.kind === 'buy') x.sells++; else x.buys++;    // the bin's view: a trader's buy is the bin selling
      m.set(e.bin, x);
    }
    return m;
  }, [activity.data]);

  if (!/^[0-9a-f]{64}$/.test(category)) return <Shell><Panel><p className="text-sm text-zinc-400">Not a position category.</p></Panel></Shell>;
  if (pos.isLoading) return <Shell><div className="flex items-center gap-2 text-sm text-zinc-400"><Loader2 className="w-4 h-4 animate-spin" />Loading position…</div></Shell>;
  if (notFound) {
    return (
      <Shell>
        <Panel title="Position not registered">
          <p className="text-sm text-zinc-400">
            {pending ? <>{registering ?? 'Registration did not go through yet.'} Genesis <a className="underline font-mono" href={explorerTx(wallet.network, pending.genesisTxid)} target="_blank" rel="noreferrer">{shortHex(pending.genesisTxid)}</a>.</>
              : 'Mesh does not know this position. If you just created it, the registration may still be on its way.'}
          </p>
        </Panel>
      </Shell>
    );
  }
  if (pos.isError || !pos.data) return <Shell><Panel><p className="text-sm text-rose-300">{(pos.error as Error)?.message ?? 'Could not load the position'}</p></Panel></Shell>;

  const v = pos.data;
  const c = v.commitment;
  const isHolder = !!v.holder;
  const low = tokenPerBch(gridPriceNum(c.binStepBps, c.highIndex + 1), info.decimals);
  const high = tokenPerBch(gridPriceNum(c.binStepBps, c.lowIndex), info.decimals);
  const funded = v.bins.filter(b => b.utxos.length > 0).length;
  const inRange = marketTpb !== null && marketTpb >= low && marketTpb <= high;

  return (
    <Shell>
      <DefiCard className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <TokenAvatar info={info} size={40} />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-heading text-xl font-semibold text-white truncate">{name.data ?? v.pairName ?? `BCH/${info.symbol} position`}</h1>
                <EngineBadge engine="v4" />
                {marketTpb !== null && (
                  <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border', inRange ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-amber-500/10 border-amber-500/30 text-amber-300')}>
                    {inRange ? 'In range' : 'Out of range'}
                  </span>
                )}
              </div>
              <div className="mt-1 flex items-center gap-2 text-[11px] text-zinc-400 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-violet-500/10 border border-violet-500/25 text-violet-200 font-mono" title={v.category}>
                  <Gem className="w-3 h-3" />NFT {shortHex(v.category, 8, 6)}
                </span>
                <span>{isHolder ? 'You hold this NFT' : wallet.signer ? 'Held by another wallet' : 'Connect the wallet holding the NFT to manage it'}</span>
                <a className="inline-flex items-center gap-1 hover:text-white" href={explorerTx(wallet.network, v.genesisTxid)} target="_blank" rel="noreferrer">genesis <ExternalLink className="w-3 h-3" /></a>
              </div>
            </div>
          </div>
          {isHolder && (
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" className="rounded-xl" onClick={() => setDialog('withdraw')} disabled={!funded}><MinusCircle className="w-4 h-4 mr-1.5" />Withdraw</Button>
              <Button variant="outline" className="rounded-xl" onClick={() => setDialog('send')}><Send className="w-4 h-4 mr-1.5" />Send</Button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 border-t border-white/[0.06]">
          <MetricCell label="Value at bids" value={formatSatsCompact(v.totals.valueAtBidSats)} sub="what the bins would pay to unwind" />
          <MetricCell label="Holds" value={formatSatsCompact(v.totals.sats)} sub={`+ ${formatUnits(v.totals.tokens, info.decimals)} ${info.symbol}`} />
          <MetricCell label="Range" value={`${formatNumber(low, 2)}–${formatNumber(high, 2)}`} sub={`${info.symbol} per BCH · ${(c.binStepBps / 100).toFixed(2)}% step`} />
          <MetricCell label="Bins" value={`${funded} / ${v.bins.length}`} sub={`${v.totals.binsWithTokens} holding ${info.symbol}`} />
        </div>
      </DefiCard>

      <Panel title="Bins on the grid">
        <BinStrip bins={v.bins} decimals={info.decimals} symbol={info.symbol} market={marketTpb} activity={fills} />
        <p className="text-[11px] text-zinc-500 flex gap-1.5"><Info className="w-3.5 h-3.5 shrink-0 mt-px" />Each bin buys {info.symbol} at its lower price and sells at the next level up, in place. A full round trip earns one {(c.binStepBps / 100).toFixed(2)}% step.</p>
      </Panel>

      <Panel title="Activity" action={activity.isFetching ? <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-500" /> : undefined}>
        {activity.data?.events.length ? (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-xs">
              <thead className="text-[10px] uppercase tracking-wider text-zinc-500">
                <tr><th className="text-left px-2 py-1.5">Event</th><th className="text-left px-2">Bin</th><th className="text-right px-2">BCH</th><th className="text-right px-2">{info.symbol}</th><th className="text-right px-2">Price</th><th className="text-right px-2">Tx</th></tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04] font-mono">
                {activity.data.events.map(e => (
                  <tr key={`${e.txid}-${e.bin}`}>
                    <td className={cn('px-2 py-1.5 font-sans font-semibold', KIND[e.kind].cls)}>{KIND[e.kind].label}</td>
                    <td className="px-2 text-zinc-400">#{e.bin}</td>
                    <td className="px-2 text-right text-zinc-200">{signed(e.dSats, s => formatSatsCompact(s))}</td>
                    <td className="px-2 text-right text-zinc-200">{signed(e.dTokens, s => formatUnits(s, info.decimals))}</td>
                    <td className="px-2 text-right text-zinc-400">{e.satsPerUnit ? formatNumber(tokenPerBch(e.satsPerUnit, info.decimals), 4) : '—'}</td>
                    <td className="px-2 text-right"><a className="text-zinc-400 hover:text-white" href={explorerTx(wallet.network, e.txid)} target="_blank" rel="noreferrer">{e.height > 0 ? e.height : 'mempool'} · {shortHex(e.txid, 4, 4)}</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-xs text-zinc-500">{activity.isLoading ? 'Reading the chain…' : 'No activity yet.'}</p>}
      </Panel>

      <p className="text-[11px] text-zinc-500 px-1">This position is an NFT. Sending it sends the position; burning it locks the funds for good. Mesh never holds a key to your bins.</p>

      {isHolder && (
        <>
          <WithdrawV4Dialog open={dialog === 'withdraw'} onOpenChange={o => setDialog(o ? 'withdraw' : null)} view={v} symbol={info.symbol} decimals={info.decimals} />
          <TransferV4Dialog open={dialog === 'send'} onOpenChange={o => setDialog(o ? 'send' : null)} view={v} symbol={info.symbol} decimals={info.decimals} />
        </>
      )}
    </Shell>
  );
}

function signed(v: string, fmt: (abs: string) => string): string {
  const neg = v.startsWith('-');
  const abs = neg ? v.slice(1) : v;
  return abs === '0' ? '—' : `${neg ? '−' : '+'}${fmt(abs)}`;
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="max-w-5xl mx-auto px-4 pb-16 space-y-5">
      <Link to="/mesh?tab=positions" className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white"><ArrowLeft className="w-3.5 h-3.5" />My positions</Link>
      {children}
    </div>
  );
}
