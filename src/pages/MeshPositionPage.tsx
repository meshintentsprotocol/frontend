/**
 * A Mesh V4 position: in-place bins owned by an NFT (/mesh/position/:category).
 * Refactored onto PositionShell (MeshDocs/meshv3v4flow/09 §3.3).
 */
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Loader2 } from 'lucide-react';
import { meshApi, useInvalidateMesh, useMarketRef, useMeshSigner } from '@/hooks/useMesh';
import { useV4Activity, useV4Position } from '@/hooks/useMeshV4';
import { MeshApiError } from '@/lib/mesh/meshApi';
import { explorerTx, formatNumber, formatSatsCompact, formatUnits, satsToUsd, shortHex } from '@/lib/mesh/format';
import { tokenPerBchFromSatsPerUnit } from '@/lib/mesh/pool';
import { gridPriceNum } from '@/lib/mesh/v4/position';
import { pendingV4, removePendingV4, tokenPerBch } from '@/lib/mesh/v4/display';
import type { V4ActivityEvent } from '@/lib/mesh/v4/types';
import { Panel, useTokenInfo } from '@/components/mesh/pools/shared';
import { DefiCard, MetricCell } from '@/components/mesh/ui/defi';
import { BinStrip } from '@/components/mesh/v4/BinStrip';
import { TransferV4Dialog, WithdrawV4Dialog } from '@/components/mesh/v4/V4ManageDialogs';
import { PositionShell } from '@/components/mesh/position/PositionShell';
import { cn } from '@/lib/utils';

const KIND: Record<V4ActivityEvent['kind'], { label: string; cls: string }> = {
  deposit: { label: 'Deposit', cls: 'text-sky-300' },
  'top-up': { label: 'Top-up', cls: 'text-sky-300' },
  buy: { label: 'Sold tokens', cls: 'text-amber-300' },
  sell: { label: 'Bought tokens', cls: 'text-emerald-300' },
  withdraw: { label: 'Withdraw', cls: 'text-zinc-300' },
};

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

  // Auto-register pending genesis if not indexed yet
  const notFound = pos.error instanceof MeshApiError && pos.error.status === 404;
  const pending = useMemo(() => pendingV4().find(p => p.category === category), [category, notFound]);
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
  }, [notFound, pending]);

  const fills = useMemo(() => {
    const m = new Map<number, { buys: number; sells: number }>();
    for (const e of activity.data?.events ?? []) {
      if (e.kind !== 'buy' && e.kind !== 'sell') continue;
      const x = m.get(e.bin) ?? { buys: 0, sells: 0 };
      if (e.kind === 'buy') x.sells++; else x.buys++;
      m.set(e.bin, x);
    }
    return m;
  }, [activity.data]);

  if (!/^[0-9a-f]{64}$/.test(category)) {
    return (
      <div className="container mx-auto py-8 max-w-[1200px]">
        <Panel><p className="text-sm text-zinc-400">Not a position category.</p></Panel>
      </div>
    );
  }

  if (pos.isLoading) {
    return (
      <div className="container mx-auto py-20 text-center text-sm text-zinc-400 max-w-[1200px]">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-400 mx-auto mb-2" />
        Loading position…
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="container mx-auto py-8 max-w-[1200px]">
        <Panel title="Position not registered">
          <p className="text-sm text-zinc-400">
            {pending ? (
              <>
                {registering ?? 'Registration did not go through yet.'} Genesis{' '}
                <a className="underline font-mono" href={explorerTx(wallet.network, pending.genesisTxid)} target="_blank" rel="noreferrer">
                  {shortHex(pending.genesisTxid)}
                </a>.
              </>
            ) : (
              'Mesh does not know this position. If you just created it, the registration may still be on its way.'
            )}
          </p>
        </Panel>
      </div>
    );
  }

  if (pos.isError || !pos.data) {
    return (
      <div className="container mx-auto py-8 max-w-[1200px]">
        <Panel><p className="text-sm text-rose-300">{(pos.error as Error)?.message ?? 'Could not load the position'}</p></Panel>
      </div>
    );
  }

  const v = pos.data;
  const c = v.commitment;
  const isHolder = !!v.holder;
  const low = tokenPerBch(gridPriceNum(c.binStepBps, c.highIndex + 1), info.decimals);
  const high = tokenPerBch(gridPriceNum(c.binStepBps, c.lowIndex), info.decimals);
  const funded = v.bins.filter(b => b.utxos.length > 0).length;
  const inRange = marketTpb !== null && marketTpb >= low && marketTpb <= high;
  const valSats = BigInt(v.totals.valueAtBidSats || v.totals.sats);
  const valUsd = satsToUsd(valSats, market.data?.bchUsd);

  return (
    <div className="container mx-auto py-6 max-w-[1200px]">
      <PositionShell
        id={category}
        engine="v4"
        pairLabel={name.data ?? v.pairName ?? `BCH / ${info.symbol}`}
        tokenInfo={info}
        strategyName={`Range (${c.binCount} bins)`}
        status={inRange ? 'in-range' : 'out-of-range'}
        isOwner={isHolder}
        valueSats={valSats}
        valueUsd={valUsd}
        activeUnitsCount={funded}
        totalUnitsCount={v.bins.length}
        capabilities={{
          canRemoveLiquidity: isHolder && funded > 0,
          canSendNft: isHolder,
          canClose: isHolder && funded > 0,
        }}
        actions={{
          onRemoveLiquidity: () => setDialog('withdraw'),
          onSendNft: () => setDialog('send'),
          onClose: () => setDialog('withdraw'),
        }}
      >
        {/* Discrete Bins Visualization */}
        <DefiCard className="space-y-4">
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Discrete Bins Layout</h2>
            <div className="text-xs text-zinc-400">
              Step <span className="font-mono text-white">{(c.binStepBps / 100).toFixed(2)}%</span>
            </div>
          </div>

          <BinStrip
            bins={v.bins}
            marketTpb={marketTpb}
            symbol={info.symbol}
            decimals={info.decimals}
            minSatsPerUnit={market.data?.cauldron ? Number(market.data.cauldron.satsPerToken) : null}
            fills={fills}
          />

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
            <MetricCell label="BCH in bins" value={`${formatSatsCompact(v.totals.sats)}`} />
            <MetricCell label={`${info.symbol} in bins`} value={`${formatUnits(v.totals.tokens, info.decimals)} ${info.symbol}`} />
            <MetricCell label="Total in BCH" value={`${formatSatsCompact(valSats)}`} />
          </div>
        </DefiCard>

        {/* Activity Feed */}
        <DefiCard className="space-y-4">
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Activity on this position</h2>
            <span className="text-xs text-zinc-500 font-mono">{activity.data?.events?.length ?? 0} events</span>
          </div>

          {(activity.data?.events ?? []).length === 0 ? (
            <p className="py-8 text-center text-xs text-zinc-500">No fills or withdrawals on-chain yet.</p>
          ) : (
            <div className="space-y-2">
              {(activity.data?.events ?? []).map(e => {
                const k = KIND[e.kind];
                return (
                  <div key={`${e.txid}-${e.bin}-${e.kind}`} className="flex items-center justify-between p-3 rounded-xl border border-white/[0.04] bg-white/[0.02] text-xs">
                    <div className="flex items-center gap-3">
                      <span className={cn('font-semibold', k.cls)}>{k.label}</span>
                      <span className="text-zinc-400 font-mono">Bin #{e.bin}</span>
                      <a
                        href={explorerTx(wallet.network, e.txid)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-zinc-500 hover:text-zinc-300 font-mono inline-flex items-center gap-1"
                      >
                        {shortHex(e.txid, 6, 4)} <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                    <div className="font-mono text-right text-xs">
                      {BigInt(e.dSats) !== 0n && (
                        <div className="text-emerald-400">{formatSatsCompact(e.dSats)}</div>
                      )}
                      {BigInt(e.dTokens) !== 0n && (
                        <div className="text-sky-300">
                          {formatNumber(Number(e.dTokens) / 10 ** info.decimals, 2)} {info.symbol}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DefiCard>
      </PositionShell>

      {/* Dialogs */}
      {dialog === 'withdraw' && (
        <WithdrawV4Dialog
          open={true}
          onOpenChange={o => !o && setDialog(null)}
          view={v}
          symbol={info.symbol}
          decimals={info.decimals}
          onDone={() => { setDialog(null); invalidate(); }}
        />
      )}
      {dialog === 'send' && (
        <TransferV4Dialog
          open={true}
          onOpenChange={o => !o && setDialog(null)}
          view={v}
          symbol={info.symbol}
          onDone={() => { setDialog(null); invalidate(); }}
        />
      )}
    </div>
  );
}
