/**
 * Lending (borrowing through Liquidium): the overview, the loan list, and one loan with its history.
 *
 * The swap server is a proxy and a tracker here: it creates loans for users and follows them, and holds no
 * keys and no funds. These pages show what it has seen.
 */
import { useNavigate, useParams } from 'react-router-dom';
import { Landmark, RefreshCw } from 'lucide-react';
import {
  ActionButton, DataTable, EmptyBlock, Hash, KeyValue, KpiTile, PageHeader, Pager, Pill, QueryState, SearchBox, Section, Segmented, TimeAgo, useUrlState,
  type Column,
} from '../kit';
import { useLendLoan, useLendLoans, useLendOverview, useSwapAction, useSwapAdmin } from './SwapAdminContext';
import { SwitchRow, swapUrl, usd } from './swapKit';
import type { LendLoan } from './swapApi';

const PHASE: Record<string, { label: string; tone: 'emerald' | 'amber' | 'rose' | 'zinc' | 'sky' }> = {
  awaiting_deposit: { label: 'Awaiting deposit', tone: 'amber' },
  confirming: { label: 'Confirming', tone: 'sky' },
  active: { label: 'Active', tone: 'emerald' },
  repaying: { label: 'Repaying', tone: 'sky' },
  closed: { label: 'Closed', tone: 'zinc' },
  expired: { label: 'Expired', tone: 'zinc' },
  failed: { label: 'Failed', tone: 'rose' },
  liquidated: { label: 'Liquidated', tone: 'rose' },
};

export function LoanPhaseBadge({ phase }: { phase: string }) {
  const p = PHASE[phase] ?? { label: phase, tone: 'zinc' as const };
  return <Pill tone={p.tone} dot>{p.label}</Pill>;
}

const units = (amount: string, decimals: number, maxFrac = 6) => {
  const n = Number(amount) / 10 ** decimals;
  return n.toLocaleString('en-US', { maximumFractionDigits: maxFrac });
};
const ltv = (bps: number) => `${(bps / 100).toFixed(1)}%`;
const debtOf = (l: LendLoan) => (BigInt(l.position.totalDebt || '0') > 0n ? l.position.totalDebt : l.borrow.amount);
const collateralOf = (l: LendLoan) => (BigInt(l.position.collateral || '0') > 0n ? l.position.collateral : l.collateral.amount);

function LtvCell({ l, warnBps }: { l: LendLoan; warnBps: number }) {
  if (!l.ltvBps) return <span className="text-zinc-600 text-xs">—</span>;
  return <span className={`font-mono text-xs tabular-nums ${l.ltvBps >= warnBps ? 'text-rose-300' : l.ltvBps >= warnBps - 1500 ? 'text-amber-300' : 'text-zinc-100'}`}>{ltv(l.ltvBps)}</span>;
}

export function LendOverviewPage() {
  const o = useLendOverview();
  const { api } = useSwapAdmin();
  const nav = useNavigate();
  const set = useSwapAction((patch: Record<string, unknown>) => api.setLendSettings(patch), { label: 'Saving lend settings', success: r => (r.changed.length ? `Saved: ${r.changed.join(', ')}` : 'Nothing changed') });

  return (
    <>
      <PageHeader title="Lending" icon={<Landmark className="w-5 h-5 text-emerald-300" aria-hidden />} crumbs={[{ label: 'Swap server', to: swapUrl.home }, { label: 'Lending' }]}
        description="Loans users open through this server. The lending protocol holds the collateral; this server creates the loan, follows it and records what happens. It holds no keys and no funds." />
      <QueryState q={o}>{d => (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5">
            <KpiTile label="Active loans" value={d.active} sub={`${d.total} all time`} to={swapUrl.lendLoans} />
            <KpiTile label="Collateral locked" value={usd(d.collateralUsd)} />
            <KpiTile label="Borrowed" value={usd(d.debtUsd)} />
            <KpiTile label="Average LTV" value={ltv(d.averageLtvBps)} sub={`warn at ${ltv(d.settings.warnLtvBps)}`} tone={d.averageLtvBps >= d.settings.warnLtvBps ? 'rose' : undefined} />
            <KpiTile label="Protocol" value={d.provider.lastError ? 'Error' : d.provider.lastOkAt ? 'Reachable' : 'Not asked yet'} tone={d.provider.lastError ? 'rose' : undefined}
              sub={d.provider.lastError ?? (d.provider.lastOkAt ? <>answered <TimeAgo at={d.provider.lastOkAt} unit="ms" /></> : d.provider.name)} />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Section title="By stage">
              {d.total === 0 ? <EmptyBlock title="No loans yet">A loan appears here the moment a user creates one.</EmptyBlock> : (
                <ul className="space-y-2">
                  {Object.entries(d.byPhase).map(([phase, count]) => (
                    <li key={phase} className="flex items-center justify-between"><LoanPhaseBadge phase={phase} /><span className="font-mono text-xs tabular-nums text-zinc-200">{count}</span></li>
                  ))}
                </ul>
              )}
            </Section>
            <Section title="Controls" description="Pausing stops new loans. Loans that exist are still followed and can still be repaid: repayment goes to the protocol, not through this server.">
              <SwitchRow label="Pause new loans" description={d.settings.pauseReason || 'Users see the reason you give.'} checked={d.settings.paused} danger
                onChange={paused => set.run({ paused, ...(paused ? { pauseReason: window.prompt('Reason shown to users', d.settings.pauseReason || 'Lending is paused for maintenance.') ?? d.settings.pauseReason } : {}) })} disabled={set.isPending} />
              <KeyValue className="mt-4" rows={[
                ['Largest loan', d.settings.maxBorrowUsd > 0 ? usd(d.settings.maxBorrowUsd) : 'No limit of ours'],
                ['LTV warning at', ltv(d.settings.warnLtvBps)],
              ]} />
              <div className="mt-3 flex flex-wrap gap-2">
                <ActionButton onClick={() => { const v = window.prompt('Largest loan in USD (0 for no limit)', String(d.settings.maxBorrowUsd)); if (v !== null && v.trim() !== '') set.run({ maxBorrowUsd: Number(v) }); }}>Set largest loan</ActionButton>
                <ActionButton onClick={() => { const v = window.prompt('Warn when a loan reaches this LTV, in percent', String(d.settings.warnLtvBps / 100)); if (v !== null && v.trim() !== '') set.run({ warnLtvBps: Math.round(Number(v) * 100) }); }}>Set LTV warning</ActionButton>
              </div>
            </Section>
          </div>

          <Section title="Close to liquidation" description={`Active loans at or above ${ltv(d.settings.warnLtvBps)} LTV.`}>
            <DataTable rows={d.atRisk} rowKey={l => l.ref} onRowClick={l => nav(swapUrl.lendLoan(l.ref))} empty={<EmptyBlock title="None">No active loan is near its liquidation point.</EmptyBlock>} columns={[
              { key: 'ref', header: 'Loan', cell: l => <span className="font-mono text-xs text-zinc-100">{l.ref}</span> },
              { key: 'ltv', header: 'LTV', align: 'right', cell: l => <LtvCell l={l} warnBps={d.settings.warnLtvBps} /> },
              { key: 'liq', header: 'Liquidates at', align: 'right', cell: l => <span className="font-mono text-xs tabular-nums text-zinc-400">{ltv(l.liquidationThresholdBps)}</span> },
              { key: 'debt', header: 'Debt', align: 'right', cell: l => <span className="font-mono text-xs tabular-nums">{units(debtOf(l), l.borrow.decimals, 2)} {l.borrow.asset}</span> },
            ]} />
          </Section>
        </>
      )}</QueryState>
    </>
  );
}

export function LendLoansPage() {
  const [f, setF] = useUrlState({ phase: '', q: '', offset: '0' });
  const limit = 50;
  const q = useLendLoans({ phase: f.phase, q: f.q, limit, offset: f.offset });
  const o = useLendOverview();
  const nav = useNavigate();
  const warn = o.data?.settings.warnLtvBps ?? 6800;
  const by = o.data?.byPhase ?? {};

  const columns: Column<LendLoan>[] = [
    { key: 'when', header: 'Created', cell: l => <TimeAgo at={l.createdAt} unit="ms" /> },
    { key: 'ref', header: 'Loan', cell: l => <span className="font-mono text-xs text-zinc-100">{l.ref}</span> },
    { key: 'borrow', header: 'Borrowed', align: 'right', cell: l => <span className="font-mono text-xs tabular-nums text-zinc-100">{units(debtOf(l), l.borrow.decimals, 2)} {l.borrow.asset}</span> },
    { key: 'collateral', header: 'Collateral', align: 'right', cell: l => <span className="font-mono text-xs tabular-nums text-zinc-300">{units(collateralOf(l), l.collateral.decimals, 8)} {l.collateral.asset}</span> },
    { key: 'ltv', header: 'LTV', align: 'right', cell: l => <LtvCell l={l} warnBps={warn} /> },
    { key: 'phase', header: 'Stage', cell: l => <LoanPhaseBadge phase={l.phase} /> },
    { key: 'conf', header: 'Confirmations', hideBelow: 'lg', cell: l => <span className="text-xs text-zinc-400">{l.status.confirmations !== null && l.status.requiredConfirmations ? `${l.status.confirmations}/${l.status.requiredConfirmations}` : '—'}</span> },
    { key: 'to', header: 'Paid to', hideBelow: 'lg', cell: l => <Hash value={l.borrow.destination} head={6} tail={4} copy={false} /> },
    { key: 'upd', header: 'Updated', hideBelow: 'xl', cell: l => <TimeAgo at={l.updatedAt} unit="ms" /> },
  ];

  return (
    <>
      <PageHeader title="Loans" icon={<Landmark className="w-5 h-5 text-emerald-300" aria-hidden />} crumbs={[{ label: 'Swap server', to: swapUrl.home }, { label: 'Lending', to: swapUrl.lend }, { label: 'Loans' }]}
        description="Every loan created through this server, and every loan found for an address a user looked up." />
      <Section actions={<>
        <Segmented label="Stage" value={f.phase} onChange={v => setF({ phase: v, offset: '0' })} options={[
          { value: '', label: 'All' }, { value: 'open', label: 'Open' }, { value: 'active', label: 'Active', count: by.active },
          { value: 'awaiting_deposit', label: 'Awaiting deposit', count: by.awaiting_deposit }, { value: 'closed', label: 'Closed', count: by.closed },
          { value: 'expired', label: 'Expired', count: by.expired }, { value: 'liquidated', label: 'Liquidated', count: by.liquidated },
        ]} />
        <SearchBox value={f.q} onChange={v => setF({ q: v, offset: '0' })} placeholder="Loan ID or address" className="w-56" />
      </>}>
        <QueryState q={q}>{d => (
          <>
            <DataTable columns={columns} rows={d.loans} rowKey={l => l.ref} onRowClick={l => nav(swapUrl.lendLoan(l.ref))}
              empty={<EmptyBlock title="No loans match">Change the filters, or create a loan from /borrow.</EmptyBlock>} />
            <Pager offset={d.offset} limit={limit} total={d.total} onChange={o2 => setF({ offset: String(o2) })} />
          </>
        )}</QueryState>
      </Section>
    </>
  );
}

export function LendLoanDetailPage() {
  const { ref = '' } = useParams();
  const q = useLendLoan(ref);
  const { api } = useSwapAdmin();
  const refresh = useSwapAction(() => api.refreshLendLoan(ref), { label: 'Refreshing the loan', success: () => `Loan ${ref} read from the protocol` });

  return (
    <>
      <PageHeader title={<span className="font-mono">{ref}</span>} icon={<Landmark className="w-5 h-5 text-emerald-300" aria-hidden />}
        crumbs={[{ label: 'Swap server', to: swapUrl.home }, { label: 'Lending', to: swapUrl.lend }, { label: 'Loans', to: swapUrl.lendLoans }, { label: ref }]}
        actions={<ActionButton onClick={() => refresh.run(undefined as never)} pending={refresh.isPending} icon={<RefreshCw className="w-3.5 h-3.5" aria-hidden />}>Read from protocol</ActionButton>} />
      <QueryState q={q}>{d => {
        const l = d.view;
        return (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
              <KpiTile label="Stage" value={<LoanPhaseBadge phase={l.phase} />} sub={`${l.status.operation} / ${l.status.state}`} />
              <KpiTile label="LTV" value={l.ltvBps ? ltv(l.ltvBps) : '—'} sub={`liquidates at ${ltv(l.liquidationThresholdBps)}`} />
              <KpiTile label="Debt" value={`${units(debtOf(l), l.borrow.decimals, 2)} ${l.borrow.asset}`} sub={`borrowed ${units(l.borrow.amount, l.borrow.decimals, 2)} · ${l.borrowApy.toFixed(2)}% APY`} />
              <KpiTile label="Collateral" value={`${units(collateralOf(l), l.collateral.decimals, 8)} ${l.collateral.asset}`} sub={l.liquidationPrice ? `liquidation price ${usd(l.liquidationPrice)}` : undefined} />
            </div>
            <div className="grid gap-5 lg:grid-cols-2">
              <Section title="Loan">
                <KeyValue rows={[
                  ['Protocol', l.provider],
                  ['Protocol loan id', d.loanId],
                  ['Created', <TimeAgo key="c" at={d.createdAt} unit="ms" />],
                  ['Last read', <TimeAgo key="u" at={d.updatedAt} unit="ms" />],
                  ['Funds paid to', <Hash key="d" value={l.borrow.destination} head={10} tail={8} />],
                  ['Collateral returns to', <Hash key="r" value={l.refundDestination} head={10} tail={8} />],
                  ['Deposit expires', l.deposit.expiresAt ? new Date(l.deposit.expiresAt).toLocaleString() : '—'],
                  ['Deposit seen', l.deposit.detectedAt ? new Date(l.deposit.detectedAt).toLocaleString() : 'Not yet'],
                  ['Interest accrued', `${units(l.position.interest, l.borrow.decimals, 6)} ${l.borrow.asset}`],
                ]} />
              </Section>
              <Section title="Where the user sends" description="Addresses given by the protocol. Nothing passes through this server.">
                <KeyValue rows={[
                  ...l.deposit.targets.map((t): [React.ReactNode, React.ReactNode] => [`Collateral (${t.chain})`, <span key={t.address}><Hash value={t.address} head={10} tail={8} /> <span className="text-zinc-500">· {units(t.amount, l.collateral.decimals, 8)} {l.collateral.asset}</span></span>]),
                  ...l.repayment.targets.map((t): [React.ReactNode, React.ReactNode] => [`Repayment (${t.chain})`, <span key={t.address}><Hash value={t.address} head={10} tail={8} /> <span className="text-zinc-500">· {units(t.amount, l.borrow.decimals, 2)} {l.borrow.asset}</span></span>]),
                  l.repayment.targets.length === 0 ? ['Repayment', 'Available once the loan has started'] : null,
                ]} />
              </Section>
            </div>
            <Section title="History" description="Each change of stage this server saw.">
              <ol className="space-y-2">
                {[...d.history].reverse().map((h, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 text-xs">
                    <span className="flex items-center gap-2"><LoanPhaseBadge phase={h.phase} /><span className="font-mono text-zinc-500">{h.state}</span></span>
                    <span className="text-zinc-400">{new Date(h.at).toLocaleString()}</span>
                  </li>
                ))}
              </ol>
            </Section>
          </>
        );
      }}</QueryState>
    </>
  );
}
