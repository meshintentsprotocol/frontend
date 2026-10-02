import { useParams, useNavigate } from 'react-router-dom';
import { ArrowDownUp, RotateCcw, Undo2, Zap, Clock, FileCode2, Repeat } from 'lucide-react';
import { useAdmin } from '../AdminContext';
import { useAdminAction, useIntent } from '../hooks';
import {
  PageHeader, Section, QueryState, KeyValue, IntentStatusBadge, KindBadge, MethodBadge, VenueBadge, Hash, TxLink, AddressLink, adminUrl,
  DataTable, ConfirmAction, Pill, duration, TimeAgo, SplitBar, Progress,
} from '../kit';
import { Amount, AssetPair } from '../assets';
import { EventFeed, Timeline } from '../EventFeed';
import { sellAsset, buyAsset, type FillLeg, type FillRecord, type IntentDetail, type IntentView } from '../api';

const MILESTONE_TONE: Record<string, 'emerald' | 'sky' | 'amber' | 'rose' | 'violet' | 'zinc'> = {
  created: 'zinc', funded: 'sky', unfillable: 'amber', filled: 'emerald', refunded: 'violet', cancelled: 'zinc', closed_external: 'rose',
};

function FillBreakdown({ fill, intent }: { fill: FillRecord; intent: IntentView }) {
  const buy = buyAsset(intent);
  const sell = sellAsset(intent);
  const rows: Array<[string, string | undefined]> = [
    ['Covenant minimum', fill.required], ['Sources delivered (gross)', fill.gross], ['Maker received', fill.makerPaid],
    ['Total surplus', fill.totalSurplus], ['Maker bonus', fill.userBonus], ['Protocol treasury', fill.protocolPaid],
    ['Frontend', fill.frontendPaid], ['Kept by solver', fill.solverProfit],
  ];
  const src = fill.sources;
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="space-y-4">
        <KeyValue rows={[
          ['Route', <span className="inline-flex items-center gap-2"><MethodBadge method={fill.method} />{fill.routeKind && <span className="text-zinc-500">{fill.routeKind}</span>}</span>],
          ['Filled by', fill.external ? <Pill tone="rose">Another solver</Pill> : fill.filler ? <AddressLink address={fill.filler} /> : '—'],
          ['Fill transaction', <TxLink txid={fill.txid} />],
          ['Latency', <span className="font-mono">{duration(fill.latencySec)}</span>],
          ['Network fee', fill.feeSats ? <Amount asset="0x" value={fill.feeSats} /> : '—'],
          ['Sold', <Amount asset={sell} value={fill.amountIn} />],
          fill.reason ? ['Planner', <span className="text-zinc-400">{fill.reason}</span>] : null,
        ]} />
        <div>
          <div className="text-[11px] text-zinc-500 mb-2">Buy amount by source</div>
          <SplitBar parts={[
            { label: 'Mesh', value: Number(src.mesh), color: '#34d399' },
            { label: 'Cauldron', value: Number(src.cauldron), color: '#38bdf8' },
            { label: 'Solver', value: Number(src.solver), color: '#fbbf24' },
          ]} />
        </div>
      </div>
      <div>
        <div className="text-[11px] text-zinc-500 mb-2">Value split ({buy === '0x' ? 'BCH' : 'buy token'})</div>
        <dl className="divide-y divide-white/[0.04] rounded-xl border border-white/[0.06]">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between px-3 py-2 text-xs">
              <dt className="text-zinc-500">{k}</dt>
              <dd>{v ? <Amount asset={buy} value={v} /> : <span className="text-zinc-600">{fill.derived ? 'not recorded' : '—'}</span>}</dd>
            </div>
          ))}
        </dl>
        {fill.derived && <p className="mt-2 text-[11px] text-amber-300/80">This fill happened before fill records were kept: legs are rebuilt from the pool ledger, the surplus split was not stored.</p>}
      </div>
    </div>
  );
}

function Legs({ legs }: { legs: FillLeg[] }) {
  return (
    <DataTable<FillLeg>
      rows={legs} rowKey={l => `${l.venue}:${l.address ?? ''}:${l.amountOut}`}
      columns={[
        { key: 'venue', header: 'Source', cell: l => <VenueBadge venue={l.venue} /> },
        { key: 'addr', header: 'Pool / wallet', cell: l => l.venue === 'mesh' && l.address ? <Hash value={l.address} to={adminUrl.pool(l.address)} /> : <AddressLink address={l.address} /> },
        { key: 'lp', header: 'LP', cell: l => l.ownerPkh ? <Hash value={l.ownerPkh} to={adminUrl.lp(l.ownerPkh)} /> : <span className="text-zinc-600 text-xs">—</span> },
        { key: 'strategy', header: 'Strategy', cell: l => l.strategy ? <Hash value={l.strategy} to={adminUrl.strategy(l.strategy)} head={12} tail={4} /> : <span className="text-zinc-600 text-xs">—</span>, hideBelow: 'md' },
        { key: 'in', header: 'Took', align: 'right', cell: l => <Amount asset={l.assetIn} value={l.amountIn} muted /> },
        { key: 'out', header: 'Gave', align: 'right', cell: l => <Amount asset={l.assetOut} value={l.amountOut} /> },
      ]}
    />
  );
}

function Twap({ d }: { d: NonNullable<IntentDetail['twap']> }) {
  const nav = useNavigate();
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Hash value={d.orderId} to={adminUrl.twap(d.orderId)} />
        <Pill tone="violet">{d.status.replace(/_/g, ' ').toLowerCase()}</Pill>
        <Progress value={d.slicesFilled} max={d.numSlices} label="slices filled" />
      </div>
      <DataTable<IntentView>
        rows={d.slices} rowKey={s => s.intentId} onRowClick={s => nav(adminUrl.intent(s.intentId))}
        columns={[
          { key: 'n', header: 'Slice', cell: s => <span className="font-mono text-xs">#{(s.twapSliceIndex ?? 0) + 1}</span> },
          { key: 'start', header: 'Window opens', cell: s => <span className="text-xs text-zinc-400 tabular-nums">{s.startTime ? new Date(s.startTime * 1000).toLocaleString() : '—'}</span> },
          { key: 'sell', header: 'Sells', align: 'right', cell: s => <Amount asset={sellAsset(s)} value={s.sellAmount} /> },
          { key: 'status', header: 'Status', cell: s => <IntentStatusBadge status={s.status} /> },
          { key: 'route', header: 'Route', cell: s => <MethodBadge method={s.fillMethod} /> },
        ]}
      />
    </div>
  );
}

export function IntentDetailPage() {
  const { id = '' } = useParams();
  const { api } = useAdmin();
  const q = useIntent(id);
  const retry = useAdminAction((x: string) => api.retryIntent(x), { label: 'Retry', success: () => 'Fill state cleared; the solver retries on its next cycle' });
  const refund = useAdminAction((x: string) => api.refundIntent(x), { label: 'Refund', success: r => (r.result.status === 'SUCCESS' ? `Refunded in ${r.result.txid?.slice(0, 12)}…` : `Refund: ${r.result.status}`) });

  return (
    <QueryState q={q} rows={10}>
      {d => {
        const i = d.intent;
        return (
          <>
            <PageHeader
              crumbs={[{ label: 'Intents', to: '/admin/intents' }, { label: i.intentId }]}
              title={<span className="font-mono text-lg sm:text-xl break-all">{i.intentId}</span>}
              icon={<ArrowDownUp className="w-5 h-5 text-cyan-300 shrink-0" />}
              description={<span className="inline-flex flex-wrap items-center gap-2"><KindBadge kind={i.kind} slice={i.twapSliceIndex} /><IntentStatusBadge status={i.status} /><AssetPair sell={sellAsset(i)} buy={buyAsset(i)} />{i.fillMethod && <MethodBadge method={i.fillMethod} />}</span>}
              actions={
                <>
                  <ConfirmAction label="Retry fill" icon={<RotateCcw className="w-3.5 h-3.5" />} disabled={!d.actions.retry} pending={retry.isPending}
                    title="Retry this intent?" description="Clears the failed-attempt count, the no-route flag and the last error, so the solver plans it again on its next cycle."
                    onConfirm={() => retry.run(i.intentId)} />
                  <ConfirmAction label="Refund now" tone="warn" icon={<Undo2 className="w-3.5 h-3.5" />} disabled={!d.actions.refund} pending={refund.isPending}
                    title="Refund this intent now?" description="Broadcasts the covenant's cancel path, returning the funds to the maker. Only possible after the covenant deadline."
                    onConfirm={() => refund.run(i.intentId)} />
                </>
              }
            />

            <div className="grid gap-5 xl:grid-cols-3">
              <Section title="Order" icon={<FileCode2 className="w-4 h-4 text-zinc-400" />} className="xl:col-span-2">
                <div className="grid gap-5 md:grid-cols-2">
                  <KeyValue rows={[
                    ['Sells', <Amount asset={sellAsset(i)} value={i.sellAmount} icon />],
                    ['Minimum out', <Amount asset={buyAsset(i)} value={i.minAmountOut} icon />],
                    i.kind !== 'limit' && i.startBuyAmount ? ['Dutch start → end', <span className="inline-flex flex-wrap gap-1"><Amount asset={buyAsset(i)} value={i.startBuyAmount} /> → <Amount asset={buyAsset(i)} value={i.endBuyAmount} /></span>] : null,
                    ['Maker', <AddressLink address={i.makerAddress} to={`/admin/intents?owner=${encodeURIComponent(i.makerPkh ?? i.makerAddress)}`} />],
                    i.frontendPkh ? ['Frontend', <span className="inline-flex items-center gap-2"><Hash value={i.frontendPkh} />{i.userSurplusShareBps !== undefined && <span className="text-zinc-500">maker gets {i.userSurplusShareBps / 100}% of the frontend split</span>}</span>] : null,
                    ['Created', <span>{new Date(i.createdAt * 1000).toLocaleString()} · <TimeAgo at={i.createdAt} /></span>],
                  ]} />
                  <KeyValue rows={[
                    ['Covenant', <AddressLink address={i.contractAddress} />],
                    ['Contract', <span className="font-mono">{i.contractName ?? '—'}</span>],
                    ['Funding', i.fundingOutpoint ? <Hash value={i.fundingOutpoint} /> : <span className="text-zinc-500">not funded</span>],
                    i.fundedAmount ? ['Funded amount', <Amount asset={sellAsset(i)} value={i.fundedAmount} />] : null,
                    i.startTime ? ['Window', <span className="tabular-nums">{new Date(i.startTime * 1000).toLocaleString()} + {duration(i.duration ?? 0)}</span>] : null,
                    ['Covenant deadline', <span className="tabular-nums">{new Date(i.covenantDeadline * 1000).toLocaleString()}</span>],
                    ['Refund eligible', <span className="tabular-nums">{new Date(i.refundEligibleAt * 1000).toLocaleString()}</span>],
                  ]} />
                </div>
                {i.constructorArgs && (
                  <details className="mt-4 group">
                    <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-300">Constructor args ({i.constructorArgs.length})</summary>
                    <pre className="mt-2 rounded-lg bg-black/40 border border-white/[0.06] p-3 text-[11px] font-mono text-zinc-400 whitespace-pre-wrap break-all">{i.constructorArgs.map((a, n) => `${n}: ${a}`).join('\n')}</pre>
                  </details>
                )}
              </Section>

              <Section title="Lifecycle" icon={<Clock className="w-4 h-4 text-zinc-400" />}>
                <Timeline items={d.milestones.map(m => ({ at: m.at, label: m.label, detail: m.detail, txid: m.txid, tone: MILESTONE_TONE[m.type] }))} />
                {(i.fillAttempts > 0 || i.lastFillError || i.refundAttempts > 0) && (
                  <div className="mt-4 space-y-2 rounded-xl border border-amber-400/20 bg-amber-500/[0.04] p-3 text-xs">
                    {i.fillAttempts > 0 && <div className="text-amber-200">Fill attempts: <span className="font-mono">{i.fillAttempts}</span></div>}
                    {i.lastFillError && <div className="text-amber-200/80 break-words">Last fill error: {i.lastFillError}</div>}
                    {i.refundAttempts > 0 && <div className="text-rose-200">Refund attempts: <span className="font-mono">{i.refundAttempts}</span>{i.lastRefundError && ` · ${i.lastRefundError}`}</div>}
                  </div>
                )}
                <div className="mt-4 text-xs text-zinc-500">
                  Refund {d.refund.eligible ? <span className="text-amber-300">possible now</span> : <>possible after <span className="tabular-nums text-zinc-300">{new Date(d.refund.covenantDeadline * 1000).toLocaleString()}</span> (chain time)</>}
                </div>
              </Section>
            </div>

            {d.fill && (
              <Section title="Who filled it" icon={<Zap className="w-4 h-4 text-emerald-300" />} description="Every liquidity source of the fill transaction, the LP behind each Mesh pool, and where the surplus went.">
                <div className="space-y-5">
                  <FillBreakdown fill={d.fill} intent={i} />
                  <div><div className="text-[11px] text-zinc-500 mb-2">Legs</div><Legs legs={d.fill.legs} /></div>
                </div>
              </Section>
            )}

            {d.twap && <Section title="TWAP order" icon={<Repeat className="w-4 h-4 text-violet-300" />} description="All slices of the order this intent belongs to."><Twap d={d.twap} /></Section>}

            <Section title="Events" description="Everything recorded about this intent.">
              <EventFeed events={d.events} />
            </Section>
          </>
        );
      }}
    </QueryState>
  );
}
