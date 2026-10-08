/**
 * Cross-chain USDC (Circle CCTP): the transfer list, one transfer with its timeline and operator actions,
 * and the chains page with relayer gas, per-chain and per-route switches.
 */
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeftRight, Fuel, RefreshCw, RotateCcw, Ban, Radar, Link2 } from 'lucide-react';
import {
  ActionButton, ConfirmAction, DataTable, EmptyBlock, Hash, KeyValue, KpiTile, PageHeader, Pager, Pill, QueryState, SearchBox, Section, Segmented, TimeAgo, useUrlState,
  type Column,
} from '../kit';
import { Timeline } from '../EventFeed';
import { useSwapAction, useSwapAdmin, useSwapOverview, useTransfer, useTransfers } from './SwapAdminContext';
import { PauseControl } from './SwapOverviewPages';
import { AlertList, HourlyBars, RouteLabel, SwapEventList, SwitchRow, TransferStatusBadge, pct, secs, swapUrl, usdc } from './swapKit';
import type { ChainRow, Transfer } from './swapApi';

function useChainNames(): Record<string, string> {
  const o = useSwapOverview().data;
  return useMemo(() => Object.fromEntries((o?.cctp.chains ?? []).map(c => [c.key, c.name])), [o]);
}

const TERMINAL = new Set(['COMPLETED', 'COMPLETED_EXTERNAL', 'FAILED', 'EXPIRED']);

function FeeStatusPill({ status }: { status?: string }) {
  if (status === 'paid') return <Pill tone="emerald">paid</Pill>;
  if (status === 'awaiting') return <Pill tone="amber" title="The fee has not been seen; delivery is on hold">waiting</Pill>;
  if (status === 'unpaid') return <Pill tone="rose" title="Delivered without the fee">unpaid</Pill>;
  if (status === 'pending') return <Pill tone="zinc">expected</Pill>;
  return null;
}

export function CctpTransfersPage() {
  const [f, setF] = useUrlState({ status: '', src: '', dst: '', q: '', offset: '0' });
  const limit = 50;
  const q = useTransfers({ status: f.status, src: f.src, dst: f.dst, q: f.q, limit, offset: f.offset });
  const o = useSwapOverview();
  const names = useChainNames();
  const nav = useNavigate();
  const stats = o.data?.cctp.stats;
  const by = q.data?.byStatus ?? {};

  const columns: Column<Transfer>[] = [
    { key: 'when', header: 'Created', cell: t => <TimeAgo at={t.createdAt} unit="ms" /> },
    { key: 'route', header: 'Route', cell: t => <RouteLabel src={t.src} dst={t.dst} names={names} /> },
    { key: 'amount', header: 'Amount', align: 'right', cell: t => <span className="font-mono text-xs tabular-nums text-zinc-100">{t.amount === '0' ? '—' : `${usdc(t.amount, 6)} USDC`}</span> },
    { key: 'status', header: 'Status', cell: t => (
      <span className="inline-flex items-center gap-1.5">
        <TransferStatusBadge status={t.status} />
        {!TERMINAL.has(t.status) && t.failCount > 0 && <Pill tone="amber" title={t.lastError}>retry {t.failCount}</Pill>}
      </span>
    ) },
    { key: 'speed', header: 'Speed', hideBelow: 'md', cell: t => <span className="text-xs text-zinc-400">{t.speed}{t.origin === 'track' ? ' · tracked' : ''}</span> },
    { key: 'fee', header: 'Our fee', align: 'right', hideBelow: 'md', cell: t => (!t.protocolFee || t.protocolFee === '0' ? <span className="text-xs text-zinc-600">—</span> : (
      <span className="inline-flex items-center gap-1.5 font-mono text-xs tabular-nums">
        {usdc(t.protocolFee, 4)}
        <FeeStatusPill status={t.feeStatus} />
      </span>
    )) },
    { key: 'took', header: 'Burn to mint', align: 'right', hideBelow: 'md', cell: t => <span className="font-mono text-xs tabular-nums text-zinc-400">{t.completedAt && t.burnSubmittedAt ? secs((t.completedAt - t.burnSubmittedAt) / 1000) : '—'}</span> },
    { key: 'sender', header: 'Sender', hideBelow: 'lg', cell: t => <Hash value={t.sender || undefined} head={6} tail={4} /> },
    { key: 'id', header: 'Id', hideBelow: 'xl', cell: t => <Hash value={t.id} head={8} tail={4} to={swapUrl.transfer(t.id)} copy={false} /> },
  ];

  return (
    <>
      <PageHeader title="Cross-chain transfers" icon={<ArrowLeftRight className="w-5 h-5 text-emerald-300" aria-hidden />} crumbs={[{ label: 'Swap server', to: swapUrl.home }, { label: 'Cross-chain USDC' }]}
        description="USDC burned on one chain and minted on another through Circle CCTP. The user signs the burn; this server's relayer pays for the mint."
        actions={o.data && <PauseControl section="cctp" paused={o.data.cctp.settings.paused} />} />
      {o.data && <AlertList alerts={o.data.alerts} section="cctp" />}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5">
          <KpiTile label="Transfers, 24h" value={stats.last24h.created} sub={`${stats.total} all time`} />
          <KpiTile label="Volume, 24h" value={usdc(stats.last24h.volume)} sub={`${usdc(stats.volume)} USDC all time`} />
          <KpiTile label="In flight" value={stats.active - stats.awaitingBurn} tone={stats.stuck.length ? 'rose' : undefined} sub={stats.stuck.length ? `${stats.stuck.length} stuck` : `${stats.retrying} retrying`} />
          <KpiTile label="Success rate" value={pct(stats.successRate)} sub={`${stats.completed} completed · ${stats.failed} failed`} />
          <KpiTile label="Median time" value={secs(stats.timingSec.total)} sub={`attest ${secs(stats.timingSec.confirmedToAttested)} · mint ${secs(stats.timingSec.attestedToMinted)}`} />
        </div>
      )}
      {stats && (
        <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
          <Section title="Last 24 hours"><HourlyBars hourly={stats.hourly} /></Section>
          <Section title="By route" description="Completed over created, and the median time from burn to mint.">
            {stats.byRoute.length === 0 ? <EmptyBlock title="No transfers yet" /> : (
              <DataTable rowKey={r => r.route} rows={stats.byRoute.slice(0, 8)} onRowClick={r => setF({ src: r.src, dst: r.dst })} columns={[
                { key: 'r', header: 'Route', cell: r => <RouteLabel src={r.src} dst={r.dst} names={names} /> },
                { key: 'n', header: 'Done / all', align: 'right', cell: r => <span className="font-mono text-xs tabular-nums">{r.completed}/{r.count}</span> },
                { key: 'f', header: 'Failed', align: 'right', cell: r => <span className={r.failed ? 'font-mono text-xs text-rose-300' : 'font-mono text-xs text-zinc-600'}>{r.failed}</span> },
                { key: 'v', header: 'Volume', align: 'right', cell: r => <span className="font-mono text-xs tabular-nums">{usdc(r.volume)}</span> },
                { key: 't', header: 'Median', align: 'right', cell: r => <span className="font-mono text-xs tabular-nums text-zinc-400">{secs(r.medianSec)}</span> },
              ]} />
            )}
          </Section>
        </div>
      )}
      <Section actions={<>
        <Segmented label="Status" value={f.status} onChange={v => setF({ status: v })} options={[
          { value: '', label: 'All' }, { value: 'active', label: 'In flight' }, { value: 'problem', label: 'Problems' },
          { value: 'COMPLETED', label: 'Completed', count: by.COMPLETED }, { value: 'FAILED', label: 'Failed', count: by.FAILED }, { value: 'CREATED', label: 'Awaiting burn', count: by.CREATED },
        ]} />
        <SearchBox value={f.q} onChange={v => setF({ q: v })} placeholder="Id, wallet or tx hash" className="w-52" />
        {(f.src || f.dst) && <ActionButton onClick={() => setF({ src: '', dst: '' })}>Clear route filter</ActionButton>}
      </>}>
        <QueryState q={q}>{d => (
          <>
            <DataTable columns={columns} rows={d.transfers} rowKey={t => t.id} onRowClick={t => nav(swapUrl.transfer(t.id))}
              empty={<EmptyBlock title="No transfers match">Change the filters, or run a transfer through the API.</EmptyBlock>} />
            <Pager offset={d.offset} limit={limit} total={d.total} onChange={o2 => setF({ offset: String(o2) })} />
          </>
        )}</QueryState>
      </Section>
    </>
  );
}

// ── one transfer ─────────────────────────────────────────────────────────────

function TransferActions({ t }: { t: Transfer }) {
  const { api } = useSwapAdmin();
  const [reason, setReason] = useState('');
  const retry = useSwapAction(() => api.retryTransfer(t.id), { label: 'Retry', success: () => 'Retry queued' });
  const fail = useSwapAction((r: string) => api.failTransfer(t.id, r), { label: 'Stop', success: () => 'Transfer stopped' });
  const reopen = useSwapAction(() => api.reopenTransfer(t.id), { label: 'Reopen', success: r => `Reopened at ${r.status}` });
  const active = !TERMINAL.has(t.status);
  return (
    <>
      {active && t.status !== 'CREATED' && <ActionButton icon={<RefreshCw className="w-3.5 h-3.5" />} onClick={() => retry.run(undefined)} pending={retry.isPending} title="Clear the retry delay and try the current step now">Retry now</ActionButton>}
      {t.status === 'FAILED' && t.burnTxHash && (
        <ConfirmAction label="Reopen" icon={<RotateCcw className="w-3.5 h-3.5" />} title="Put this transfer back in the queue?" confirmLabel="Reopen" onConfirm={() => reopen.run(undefined)} pending={reopen.isPending}
          description="The relayer resumes from the furthest step on record: the mint if the attestation is stored, otherwise the burn check. Safe to repeat: a nonce that is already used is recorded as minted by the user." />
      )}
      {active && t.status !== 'MINT_SUBMITTED' && (
        <ConfirmAction label="Stop" tone="danger" icon={<Ban className="w-3.5 h-3.5" />} title="Stop relaying this transfer?" confirmLabel="Stop transfer" onConfirm={() => fail.run(reason.trim())} pending={fail.isPending}
          description="The transfer is marked failed and the relayer leaves it alone. No funds are lost: once the burn is attested, the user can mint with the message and attestation shown on this page.">
          <label className="block text-xs text-zinc-300">Reason
            <input value={reason} onChange={e => setReason(e.target.value)} maxLength={200} className="mt-1 w-full h-8 px-2.5 rounded-lg bg-white/[0.03] border border-white/10 text-xs text-white focus:outline-none focus:border-emerald-400/50" />
          </label>
        </ConfirmAction>
      )}
    </>
  );
}

export function CctpTransferDetailPage() {
  const { id = '' } = useParams();
  const q = useTransfer(id);
  const names = useChainNames();
  return (
    <QueryState q={q} rows={8}>{({ transfer: t, events }) => (
      <>
        <PageHeader title={<><RouteLabel src={t.src} dst={t.dst} names={names} className="text-xl sm:text-2xl text-white" /><TransferStatusBadge status={t.status} /></>}
          crumbs={[{ label: 'Swap server', to: swapUrl.home }, { label: 'Cross-chain USDC', to: swapUrl.transfers }, { label: t.id.slice(0, 8) }]}
          description={t.failReason ? `Failed: ${t.failReason}` : t.lastError && !TERMINAL.has(t.status) ? `Last error: ${t.lastError}` : undefined}
          actions={<TransferActions t={t} />} />
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5">
          <KpiTile label="Sent" value={t.amount === '0' ? '—' : `${t.display.grossAmount} USDC`} sub={`${t.speed} · ${t.display.amount} burned · Circle ${t.feeBps} bps`} />
          <KpiTile label="Our fee" value={t.protocolFee && t.protocolFee !== '0' ? `${t.display.protocolFee} USDC` : 'none'}
            tone={t.feeStatus === 'paid' ? 'emerald' : t.feeStatus === 'awaiting' || t.feeStatus === 'unpaid' ? 'amber' : undefined}
            sub={t.feeStatus === 'paid' ? 'received by the treasury' : t.feeStatus === 'awaiting' ? 'not seen yet: delivery on hold' : t.feeStatus === 'unpaid' ? 'never paid' : t.feeStatus === 'pending' ? 'expected with the burn' : 'no fee on this transfer'} />
          <KpiTile label="Received" value={t.display.received ? `${t.display.received} USDC` : '—'} sub={`expected ${t.display.expectedReceive}`} tone={t.display.received ? 'emerald' : undefined} />
          <KpiTile label="Burn to mint" value={t.completedAt && t.burnSubmittedAt ? secs((t.completedAt - t.burnSubmittedAt) / 1000) : '—'} sub={t.mintTxHashes && t.mintTxHashes.length > 1 ? `${t.mintTxHashes.length} mint broadcasts` : undefined} />
          <KpiTile label="Retries" value={t.failCount} tone={t.failCount ? 'amber' : undefined} sub={t.retryAfter && t.retryAfter > Date.now() ? `next try in ${Math.ceil((t.retryAfter - Date.now()) / 1000)}s` : undefined} />
        </div>
        <div className="grid gap-5 lg:grid-cols-2 items-start">
          <Section title="Timeline">
            <Timeline items={[
              { at: Math.floor(t.createdAt / 1000), label: t.origin === 'track' ? 'Burn adopted for tracking' : 'Transfer created, unsigned burn returned', tone: 'zinc' },
              { at: t.burnSubmittedAt ? Math.floor(t.burnSubmittedAt / 1000) : null, label: 'Burn hash received', tone: 'sky' },
              { at: t.burnConfirmedAt ? Math.floor(t.burnConfirmedAt / 1000) : null, label: 'Burn confirmed on the source chain', tone: 'sky' },
              { at: t.attestedAt ? Math.floor(t.attestedAt / 1000) : null, label: 'Attested by Circle', tone: 'violet' },
              { at: t.mintSubmittedAt ? Math.floor(t.mintSubmittedAt / 1000) : null, label: 'Mint broadcast by the relayer', tone: 'violet' },
              { at: t.completedAt ? Math.floor(t.completedAt / 1000) : null, label: t.status === 'COMPLETED_EXTERNAL' ? 'Minted by the user or another relayer' : 'Minted on the destination chain', tone: 'emerald' },
              ...(t.status === 'FAILED' || t.status === 'EXPIRED' ? [{ at: Math.floor(t.updatedAt / 1000), label: t.status === 'EXPIRED' ? 'Expired' : 'Failed', detail: t.failReason, tone: 'rose' as const }] : []),
            ]} />
          </Section>
          <Section title="Details">
            <KeyValue rows={[
              ['Transfer id', <Hash key="id" value={t.id} head={36} tail={0} />],
              ['Sender', <Hash key="s" value={t.sender || undefined} head={10} tail={8} />],
              ['Recipient', <Hash key="r" value={t.recipient || undefined} head={10} tail={8} />],
              t.recipientTokenAccount ? ['Token account', <Hash key="ta" value={t.recipientTokenAccount} head={10} tail={8} />] : null,
              ['Burn tx', <Hash key="b" value={t.burnTxHash} href={t.links.burn} head={10} tail={8} />],
              ['Mint tx', <Hash key="m" value={t.mintTxHash} href={t.links.mint} head={10} tail={8} />],
              ['Domains', `${t.srcDomain} → ${t.dstDomain}`],
              ['Max fee', `${usdc(t.maxFee, 6)} USDC`],
              t.feeRecipient ? ['Fee paid to', <Hash key="fr" value={t.feeRecipient} head={10} tail={8} />] : null,
              t.feeTxHash ? ['Fee tx', <Hash key="ft" value={t.feeTxHash} head={10} tail={8} />] : null,
              t.relayCost ? ['Relayer gas', `${Number(t.relayCost.amount).toLocaleString(undefined, { maximumSignificantDigits: 4 })} ${t.relayCost.symbol}`] : null,
              t.feeExecuted ? ['Fee charged', `${usdc(t.feeExecuted, 6)} USDC`] : null,
              t.nonce ? ['Nonce', <Hash key="n" value={t.nonce} head={10} tail={8} />] : null,
            ]} />
          </Section>
        </div>
        {t.selfMint && (
          <Section title="Manual mint" icon={<Link2 className="w-4 h-4 text-amber-300" aria-hidden />}
            description={`This transfer is attested and not minted yet. Anyone can mint it by calling ${t.selfMint.method} on ${t.selfMint.contract} (${names[t.selfMint.chain] ?? t.selfMint.chain}).`}>
            <KeyValue rows={[['Message', <Hash key="msg" value={t.selfMint.message} head={24} tail={16} />], ['Attestation', <Hash key="att" value={t.selfMint.attestation} head={24} tail={16} />]]} />
          </Section>
        )}
        <Section title="Events for this transfer"><SwapEventList events={events} showSection={false} /></Section>
      </>
    )}</QueryState>
  );
}

// ── chains, relayer gas, routes ──────────────────────────────────────────────

function TrackBurn({ chains }: { chains: ChainRow[] }) {
  const { api } = useSwapAdmin();
  const nav = useNavigate();
  const [src, setSrc] = useState(chains[0]?.key ?? '');
  const [hash, setHash] = useState('');
  const track = useSwapAction(() => api.trackBurn(src, hash.trim()), { label: 'Track', success: r => `Tracking as ${r.id.slice(0, 8)}` });
  return (
    <form onSubmit={e => { e.preventDefault(); track.mutate(undefined, { onSuccess: r => nav(swapUrl.transfer(r.id)) }); }} className="flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor="track-src">Source chain</label>
      <select id="track-src" value={src} onChange={e => setSrc(e.target.value)} className="h-8 px-2 rounded-lg bg-white/[0.03] border border-white/10 text-xs text-zinc-100 focus:outline-none">
        {chains.map(c => <option key={c.key} value={c.key} className="bg-zinc-900">{c.name}</option>)}
      </select>
      <input value={hash} onChange={e => setHash(e.target.value)} placeholder="Burn transaction hash" aria-label="Burn transaction hash"
        className="flex-1 min-w-[220px] h-8 px-2.5 rounded-lg bg-white/[0.03] border border-white/10 text-xs text-white font-mono placeholder:text-zinc-600 focus:outline-none focus:border-emerald-400/50" />
      <ActionButton icon={<Radar className="w-3.5 h-3.5" />} disabled={!hash.trim()} pending={track.isPending} onClick={() => track.mutate(undefined, { onSuccess: r => nav(swapUrl.transfer(r.id)) })}>Track and relay</ActionButton>
    </form>
  );
}

export function CctpChainsPage() {
  const q = useSwapOverview();
  const { api } = useSwapAdmin();
  const setChain = useSwapAction((a: { key: string; open: boolean }) => api.setChain(a.key, a.open), { label: 'Chain', success: (_, a) => `${a.key} ${a.open ? 'opened' : 'closed'}` });
  const setRoute = useSwapAction((a: { src: string; dst: string; open: boolean }) => api.setRoute(a.src, a.dst, a.open), { label: 'Route', success: (_, a) => `${a.src} → ${a.dst} ${a.open ? 'opened' : 'closed'}` });
  const refresh = useSwapAction(() => api.balances(true), { label: 'Refresh', success: () => 'Balances refreshed' });
  return (
    <>
      <PageHeader title="Chains and relayer" icon={<Fuel className="w-5 h-5 text-emerald-300" aria-hidden />} crumbs={[{ label: 'Swap server', to: swapUrl.home }, { label: 'Cross-chain USDC', to: swapUrl.transfers }, { label: 'Chains' }]}
        description="The relayer wallet pays for the mint on the destination chain. A chain where it has no gas cannot receive transfers; close it until it is funded."
        actions={<ActionButton icon={<RefreshCw className="w-3.5 h-3.5" />} onClick={() => refresh.run(undefined)} pending={refresh.isPending}>Refresh balances</ActionButton>} />
      <QueryState q={q} rows={8}>{o => {
        const { chains, settings, balancesAgeSec } = o.cctp;
        const closedRoutes = new Set(settings.disabledRoutes);
        return (
          <>
            <Section title="Chains" description={balancesAgeSec !== undefined ? `Balances read ${balancesAgeSec}s ago.` : undefined}>
              <DataTable rowKey={c => c.key} rows={chains} columns={[
                { key: 'name', header: 'Chain', cell: c => <div><div className="text-xs font-medium text-zinc-100">{c.name}</div><div className="text-[10px] text-zinc-600 font-mono">{c.key} · domain {c.domain}{c.chainId ? ` · id ${c.chainId}` : ''}</div></div> },
                { key: 'open', header: 'Open', cell: c => (
                  <button type="button" role="switch" aria-checked={c.open} aria-label={`${c.name} open`} onClick={() => setChain.run({ key: c.key, open: !c.open })}
                    className={c.open ? 'px-2 py-0.5 rounded-md text-[11px] font-semibold border bg-emerald-500/10 border-emerald-400/30 text-emerald-200' : 'px-2 py-0.5 rounded-md text-[11px] font-semibold border bg-amber-500/10 border-amber-400/30 text-amber-200'}>
                    {c.open ? 'Open' : 'Closed'}
                  </button>
                ) },
                { key: 'gas', header: 'Relayer gas', align: 'right', cell: c => c.relayer?.error
                  ? <span className="text-xs text-rose-300">{c.relayer.error}</span>
                  : <span className={c.relayer?.low ? 'font-mono text-xs tabular-nums text-rose-300' : 'font-mono text-xs tabular-nums text-zinc-100'}>{c.relayer?.amount ? Number(c.relayer.amount).toFixed(4) : '—'} {c.relayer?.symbol?.replace(' (native gas)', '')}{c.relayer?.low ? ' · low' : ''}</span> },
                { key: 'usdc', header: 'Relayer USDC', align: 'right', hideBelow: 'md', cell: c => <span className="font-mono text-xs tabular-nums text-zinc-400">{c.relayer?.usdc ?? '—'}</span> },
                { key: 'relayer', header: 'Relayer address', hideBelow: 'md', cell: c => <Hash value={c.relayer?.relayer} head={8} tail={6} /> },
                { key: 'speed', header: 'Attestation', hideBelow: 'lg', cell: c => <span className="text-xs text-zinc-400">{c.fastSource && c.fastEtaSec ? `fast ${c.fastEtaSec}s · ` : ''}standard {c.standardEtaSec >= 120 ? `${Math.round(c.standardEtaSec / 60)}m` : `${c.standardEtaSec}s`}</span> },
                { key: 'rpc', header: 'RPC', hideBelow: 'xl', cell: c => <span className="text-[11px] text-zinc-500 font-mono">{c.rpcHost}</span> },
              ]} />
            </Section>
            <Section title="Routes" description="Close a single direction without closing the whole chain. Rows are the source, columns the destination.">
              <div className="overflow-x-auto">
                <table className="text-xs border-separate border-spacing-1">
                  <thead><tr><th className="text-left text-[10px] font-semibold uppercase tracking-wider text-zinc-600 pr-3">From \ To</th>{chains.map(c => <th key={c.key} scope="col" className="px-1 text-[10px] font-medium text-zinc-500 whitespace-nowrap">{c.name.replace(' Sepolia', '').replace(' Testnet', '').replace(' Devnet', '')}</th>)}</tr></thead>
                  <tbody>
                    {chains.map(s => (
                      <tr key={s.key}>
                        <th scope="row" className="text-left font-medium text-zinc-300 pr-3 whitespace-nowrap">{s.name}</th>
                        {chains.map(d => {
                          if (s.key === d.key) return <td key={d.key} className="text-center text-zinc-700">·</td>;
                          const chainClosed = !s.open || !d.open;
                          const open = !closedRoutes.has(`${s.key}>${d.key}`);
                          return (
                            <td key={d.key} className="text-center">
                              <button type="button" role="switch" aria-checked={open && !chainClosed} disabled={chainClosed} aria-label={`${s.name} to ${d.name}`}
                                title={chainClosed ? 'A chain on this route is closed' : `${s.name} → ${d.name}: ${open ? 'open' : 'closed'}`}
                                onClick={() => setRoute.run({ src: s.key, dst: d.key, open: !open })}
                                className={chainClosed ? 'w-14 h-6 rounded-md border border-white/[0.06] text-[10px] text-zinc-600 cursor-not-allowed' : open ? 'w-14 h-6 rounded-md border bg-emerald-500/10 border-emerald-400/25 text-[10px] font-semibold text-emerald-200 hover:bg-emerald-500/20' : 'w-14 h-6 rounded-md border bg-amber-500/10 border-amber-400/30 text-[10px] font-semibold text-amber-200 hover:bg-amber-500/20'}>
                                {chainClosed ? 'chain' : open ? 'open' : 'closed'}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
            <div className="grid gap-5 lg:grid-cols-2 items-start">
              <Section title="Relaying">
                <RelaySwitches relayEnabled={settings.relayEnabled} fastEnabled={settings.fastEnabled} />
                <div className="pt-2 text-[11px] text-zinc-500">Limits and the fee buffer are on the <Link to={swapUrl.settings} className="text-zinc-300 hover:text-emerald-300">settings page</Link>.</div>
              </Section>
              <Section title="Track a burn" description="Adopt a CCTP burn that was made outside this server (or whose record was lost) and relay its mint.">
                <TrackBurn chains={chains} />
              </Section>
            </div>
          </>
        );
      }}</QueryState>
    </>
  );
}

function RelaySwitches({ relayEnabled, fastEnabled }: { relayEnabled: boolean; fastEnabled: boolean }) {
  const { api } = useSwapAdmin();
  const set = useSwapAction((p: { relayEnabled?: boolean; fastEnabled?: boolean }) => api.setSettings({ cctp: p }), { label: 'Setting', success: r => `Saved: ${r.changed.join(', ') || 'nothing changed'}` });
  return (
    <div className="divide-y divide-white/[0.05]">
      <SwitchRow label="Relay mints" checked={relayEnabled} disabled={set.isPending} onChange={v => set.run({ relayEnabled: v })} description="Off: attested transfers wait and the user mints with their own gas." />
      <SwitchRow label="Fast transfers" checked={fastEnabled} disabled={set.isPending} onChange={v => set.run({ fastEnabled: v })} description="Off: every transfer waits for full finality." />
    </div>
  );
}
