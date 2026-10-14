/**
 * Lending (borrowing through Liquidium): the overview, the loan list, and one loan with its history.
 *
 * The swap server is a proxy and a tracker here: it creates loans for users and follows them, and holds no
 * keys and no funds. These pages show what it has seen.
 */
import { useNavigate, useParams } from 'react-router-dom';
import { Landmark, RefreshCw, Users, PlusCircle, Edit3 } from 'lucide-react';
import {
  ActionButton, DataTable, EmptyBlock, Hash, KeyValue, KpiTile, PageHeader, Pager, Pill, QueryState, SearchBox, Section, Segmented, TimeAgo, useUrlState,
  type Column,
} from '../kit';
import { useLendLoan, useLendLoans, useLendOverview, useLendUser, useLendUsers, useSwapAction, useSwapAdmin } from './SwapAdminContext';
import { SwitchRow, swapUrl, usd } from './swapKit';
import type { LendLoan, AdminLendUserSummary } from './swapApi';

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

export function HealthFactorBadge({ hf }: { hf: number | null | undefined }) {
  if (hf === null || hf === undefined) return <Pill tone="zinc">No Debt</Pill>;
  if (hf >= 1.5) return <Pill tone="emerald" dot>{hf.toFixed(2)} (Safe)</Pill>;
  if (hf >= 1.1) return <Pill tone="amber" dot>{hf.toFixed(2)} (Warning)</Pill>;
  return <Pill tone="rose" dot>{hf.toFixed(2)} (At Risk)</Pill>;
}

export function LendOverviewPage() {
  const o = useLendOverview();
  const u = useLendUsers({ limit: 5 });
  const { api } = useSwapAdmin();
  const nav = useNavigate();
  const set = useSwapAction((patch: Record<string, unknown>) => api.setLendSettings(patch), { label: 'Saving lend settings', success: r => (r.changed.length ? `Saved: ${r.changed.join(', ')}` : 'Nothing changed') });

  return (
    <>
      <PageHeader title="Lending" icon={<Landmark className="w-5 h-5 text-emerald-300" aria-hidden />} crumbs={[{ label: 'Swap server', to: swapUrl.home }, { label: 'Lending' }]}
        description="Loans users open through this server. The lending protocol holds the collateral; this server creates the loan, follows it and records what happens. It holds no keys and no funds." />
      <QueryState q={o}>{d => (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-2.5">
            <KpiTile label="Active loans" value={d.active} sub={`${d.total} all time`} to={swapUrl.lendLoans} />
            <KpiTile label="Tracked users" value={u.data ? u.data.total : '—'} sub={`${u.data?.stats.activeBorrowers ?? 0} active borrower(s)`} to={swapUrl.lendUsers} />
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

          <Section
            title="Tracked Users & Profiles"
            description="Users and accounts interacting with lending and borrowing."
            actions={<ActionButton onClick={() => nav(swapUrl.lendUsers)}>View all users</ActionButton>}
          >
            {u.data && u.data.users.length > 0 ? (
              <DataTable
                rows={u.data.users}
                rowKey={x => x.profileId}
                onRowClick={x => nav(swapUrl.lendUser(x.profileId))}
                columns={[
                  { key: 'profile', header: 'Profile Principal', cell: x => <Hash value={x.profileId} head={10} tail={8} copy={false} /> },
                  { key: 'wallet', header: 'Primary Wallet', cell: x => <Hash value={x.primaryAddress} head={8} tail={6} copy={false} /> },
                  { key: 'collateral', header: 'Collateral', align: 'right', cell: x => <span className="font-mono text-xs tabular-nums text-zinc-100">{x.portfolio ? usd(x.portfolio.suppliedUsd) : '—'}</span> },
                  { key: 'debt', header: 'Debt', align: 'right', cell: x => <span className="font-mono text-xs tabular-nums text-zinc-100">{x.portfolio ? usd(x.portfolio.borrowedUsd) : '—'}</span> },
                  { key: 'health', header: 'Health Factor', align: 'right', cell: x => <HealthFactorBadge hf={x.portfolio?.healthFactor} /> },
                  { key: 'lastSeen', header: 'Last Active', align: 'right', cell: x => <TimeAgo at={x.lastSeenAt} unit="ms" /> },
                ]}
              />
            ) : (
              <EmptyBlock title="No profiles tracked yet">Profiles appear automatically when users connect or borrow. You can also track any user from the Users page.</EmptyBlock>
            )}
          </Section>

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

export function LendUsersPage() {
  const [f, setF] = useUrlState({ q: '', offset: '0' });
  const limit = 50;
  const q = useLendUsers({ q: f.q, limit, offset: f.offset });
  const { api } = useSwapAdmin();
  const nav = useNavigate();

  const track = useSwapAction((addressOrProfileId: string) => api.trackLendUser(addressOrProfileId), {
    label: 'Tracking user',
    success: (r) => `Tracked profile ${r.profile.profileId}`,
  });

  const columns: Column<AdminLendUserSummary>[] = [
    {
      key: 'profile',
      header: 'Profile Principal',
      cell: (u) => (
        <div className="flex items-center gap-1.5 font-mono text-xs text-zinc-100">
          <Hash value={u.profileId} head={10} tail={8} copy={true} />
        </div>
      ),
    },
    {
      key: 'primaryWallet',
      header: 'Primary Wallet',
      cell: (u) => {
        const isBtc = !u.primaryAddress.startsWith('0x') && u.primaryAddress.length > 25;
        return (
          <div className="flex items-center gap-1.5 text-xs">
            <Pill tone={isBtc ? 'amber' : 'sky'}>{isBtc ? 'BTC' : 'ETH'}</Pill>
            <Hash value={u.primaryAddress} head={8} tail={6} copy={true} />
          </div>
        );
      },
    },
    {
      key: 'walletsCount',
      header: 'Linked Wallets',
      hideBelow: 'lg',
      cell: (u) => (
        <span className="text-xs text-zinc-400">
          {u.wallets?.length || 1} wallet{u.wallets?.length === 1 ? '' : 's'}
        </span>
      ),
    },
    {
      key: 'collateral',
      header: 'Collateral Locked',
      align: 'right',
      cell: (u) => (
        <span className="font-mono text-xs tabular-nums text-zinc-100">
          {u.portfolio ? usd(u.portfolio.suppliedUsd) : '—'}
        </span>
      ),
    },
    {
      key: 'debt',
      header: 'Borrowed Debt',
      align: 'right',
      cell: (u) => (
        <span className="font-mono text-xs tabular-nums text-zinc-100">
          {u.portfolio ? usd(u.portfolio.borrowedUsd) : '—'}
        </span>
      ),
    },
    {
      key: 'health',
      header: 'Health Factor',
      align: 'right',
      cell: (u) => <HealthFactorBadge hf={u.portfolio?.healthFactor} />,
    },
    {
      key: 'netApy',
      header: 'Net APY',
      align: 'right',
      hideBelow: 'md',
      cell: (u) => (
        <span className="font-mono text-xs tabular-nums text-zinc-300">
          {u.portfolio ? `${(u.portfolio.netApy * 100).toFixed(2)}%` : '—'}
        </span>
      ),
    },
    {
      key: 'loans',
      header: 'Simple Loans',
      align: 'right',
      hideBelow: 'lg',
      cell: (u) => (
        <span className="font-mono text-xs tabular-nums text-zinc-400">
          {u.loansCount > 0 ? (
            <Pill tone="emerald">{u.loansCount}</Pill>
          ) : (
            '0'
          )}
        </span>
      ),
    },
    {
      key: 'lastSeen',
      header: 'Last Active',
      hideBelow: 'xl',
      cell: (u) => <TimeAgo at={u.lastSeenAt} unit="ms" />,
    },
  ];

  return (
    <>
      <PageHeader
        title="Users & Accounts"
        icon={<Users className="w-5 h-5 text-emerald-300" aria-hidden />}
        crumbs={[
          { label: 'Swap server', to: swapUrl.home },
          { label: 'Lending', to: swapUrl.lend },
          { label: 'Users & Accounts' },
        ]}
        description="Track each user profile, linked Bitcoin and EVM wallet accounts, live collateral, borrowed debt, health factor, and protocol positions."
        actions={
          <ActionButton
            onClick={() => {
              const val = window.prompt('Enter Bitcoin address, EVM address, or Liquidium profile principal:');
              if (val && val.trim()) track.run(val.trim());
            }}
            pending={track.isPending}
            icon={<PlusCircle className="w-3.5 h-3.5" aria-hidden />}
          >
            Track User
          </ActionButton>
        }
      />
      <QueryState q={q}>
        {(d) => (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5">
              <KpiTile label="Tracked users" value={d.stats.totalUsers} sub="Registered profiles" />
              <KpiTile label="Active borrowers" value={d.stats.activeBorrowers} tone={d.stats.activeBorrowers > 0 ? 'emerald' : undefined} />
              <KpiTile label="Total collateral" value={usd(d.stats.totalSuppliedUsd)} sub="Supplied across accounts" />
              <KpiTile label="Total borrowed" value={usd(d.stats.totalBorrowedUsd)} sub="Active debt balance" />
              <KpiTile
                label="At risk (<1.3 HF)"
                value={d.stats.atRiskCount}
                tone={d.stats.atRiskCount > 0 ? 'rose' : undefined}
                sub={d.stats.atRiskCount > 0 ? 'Near liquidation threshold' : 'All accounts healthy'}
              />
            </div>

            <Section
              title="Tracked Profiles & Accounts"
              description="Click on any user to view their complete position breakdown, linked wallets, and simple loans."
              actions={
                <SearchBox
                  value={f.q}
                  onChange={(v) => setF({ q: v, offset: '0' })}
                  placeholder="Address or profile principal"
                  className="w-64"
                />
              }
            >
              <DataTable
                columns={columns}
                rows={d.users}
                rowKey={(u) => u.profileId}
                onRowClick={(u) => nav(swapUrl.lendUser(u.profileId))}
                empty={
                  <EmptyBlock title="No users found">
                    Users are automatically tracked when they connect or open loans. You can also click "Track User" to track any address.
                  </EmptyBlock>
                }
              />
              <Pager offset={d.offset} limit={limit} total={d.total} onChange={(o2) => setF({ offset: String(o2) })} />
            </Section>
          </>
        )}
      </QueryState>
    </>
  );
}

export function LendUserDetailPage() {
  const { profileId = '' } = useParams();
  const q = useLendUser(profileId);
  const { api } = useSwapAdmin();
  const nav = useNavigate();

  const refresh = useSwapAction(() => api.lendUser(profileId), {
    label: 'Refreshing user data',
    success: () => `Refreshed positions for ${profileId}`,
  });

  const updateNotes = useSwapAction((notes: string) => api.setLendUserNotes(profileId, notes), {
    label: 'Saving notes',
    success: () => 'Operator notes updated',
  });

  return (
    <>
      <PageHeader
        title={<span className="font-mono text-base sm:text-lg">{profileId}</span>}
        icon={<Users className="w-5 h-5 text-emerald-300" aria-hidden />}
        crumbs={[
          { label: 'Swap server', to: swapUrl.home },
          { label: 'Lending', to: swapUrl.lend },
          { label: 'Users', to: swapUrl.lendUsers },
          { label: profileId },
        ]}
        actions={
          <ActionButton onClick={() => refresh.run(undefined as never)} pending={refresh.isPending} icon={<RefreshCw className="w-3.5 h-3.5" aria-hidden />}>
            Refresh Canister
          </ActionButton>
        }
      />
      <QueryState q={q}>
        {(d) => {
          const prof = d.profile;
          const pf = d.portfolio;
          const hf = pf.healthFactor;
          const hfTone = hf === null ? undefined : hf >= 1.5 ? 'emerald' : hf >= 1.1 ? 'amber' : 'rose';
          const hfLabel = hf === null ? 'No Debt' : hf >= 1.5 ? 'Safe' : hf >= 1.1 ? 'Warning' : 'Critical Risk';

          return (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5">
                <KpiTile
                  label="Health factor"
                  value={hf !== null ? hf.toFixed(2) : '—'}
                  sub={hfLabel}
                  tone={hfTone}
                />
                <KpiTile label="Collateral locked" value={usd(pf.suppliedUsd)} sub={`${pf.supplied.length} supplied asset(s)`} />
                <KpiTile label="Borrowed debt" value={usd(pf.borrowedUsd)} sub={`${pf.borrowed.length} active borrow(s)`} />
                <KpiTile label="Net collateral value" value={usd(pf.netValueUsd)} sub="Collateral minus debt" />
                <KpiTile label="Net APY" value={`${(pf.netApy * 100).toFixed(2)}%`} sub={usd(pf.netInterestUsd) + ' net interest'} />
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <Section
                  title="Profile & Accounts"
                  actions={
                    <ActionButton
                      onClick={() => {
                        const note = window.prompt('Operator notes for this user profile:', prof.notes || '');
                        if (note !== null) updateNotes.run(note);
                      }}
                      icon={<Edit3 className="w-3.5 h-3.5" aria-hidden />}
                    >
                      Edit Notes
                    </ActionButton>
                  }
                >
                  <KeyValue
                    rows={[
                      ['Profile Principal', <Hash key="p" value={prof.profileId} head={14} tail={10} copy={true} />],
                      ['Primary Wallet', <Hash key="w" value={prof.primaryAddress} head={14} tail={10} copy={true} />],
                      ['First Tracked', <TimeAgo key="c" at={prof.createdAt} unit="ms" />],
                      ['Last Active', <TimeAgo key="u" at={prof.lastSeenAt} unit="ms" />],
                      ['Operator Notes', prof.notes || <span className="text-zinc-500 italic">No notes added</span>],
                    ]}
                  />

                  {prof.wallets && prof.wallets.length > 0 && (
                    <div className="mt-4 border-t border-white/[0.06] pt-3">
                      <h3 className="text-xs font-semibold text-zinc-300 mb-2">Linked Wallets</h3>
                      <div className="space-y-1.5">
                        {prof.wallets.map((w, i) => (
                          <div key={i} className="flex items-center justify-between text-xs p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                            <div className="flex items-center gap-2">
                              <Pill tone={w.chain.toUpperCase() === 'BTC' ? 'amber' : 'sky'}>{w.chain.toUpperCase()}</Pill>
                              <Hash value={w.address} head={12} tail={8} copy={true} />
                            </div>
                            <span className="text-zinc-500 text-[11px]"><TimeAgo at={w.addedAt} unit="ms" /></span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </Section>

                <Section title="Borrowing Capacity" description="Available headroom this user can borrow right now based on their locked collateral.">
                  {Object.entries(pf.borrowable).length === 0 ? (
                    <EmptyBlock title="No borrow limits available">Deposit collateral to unlock borrowing capacity.</EmptyBlock>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(pf.borrowable).map(([asset, amount]) => {
                        const amtNum = Number(amount) / (asset === 'USDC' ? 1e6 : 1e8);
                        return (
                          <div key={asset} className="p-3 rounded-xl border border-white/[0.06] bg-white/[0.015]">
                            <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">{asset} Available</span>
                            <div className="text-base font-semibold font-mono text-white mt-1">
                              {amtNum.toLocaleString('en-US', { maximumFractionDigits: 4 })} {asset}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Section>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <Section title="Supplied Collateral" description="Active collateral deposits earning supply interest on Liquidium.">
                  {pf.supplied.length === 0 ? (
                    <EmptyBlock title="No collateral deposited">This profile currently has no active collateral positions.</EmptyBlock>
                  ) : (
                    <DataTable
                      rows={pf.supplied}
                      rowKey={(p) => p.poolId}
                      columns={[
                        { key: 'asset', header: 'Asset', cell: (p) => <span className="font-semibold text-white">{p.asset}</span> },
                        { key: 'amount', header: 'Balance', align: 'right', cell: (p) => <span className="font-mono text-xs tabular-nums text-zinc-300">{p.amount}</span> },
                        { key: 'usd', header: 'USD Value', align: 'right', cell: (p) => <span className="font-mono text-xs tabular-nums text-emerald-300">{usd(p.usd)}</span> },
                        { key: 'apy', header: 'Supply APY', align: 'right', cell: (p) => <span className="font-mono text-xs tabular-nums text-emerald-400">+{p.apy.toFixed(2)}%</span> },
                        { key: 'interest', header: 'Earned Interest', align: 'right', cell: (p) => <span className="font-mono text-xs tabular-nums text-zinc-400">{p.interest}</span> },
                      ]}
                    />
                  )}
                </Section>

                <Section title="Borrowed Debt" description="Active loans taken by this user profile against their collateral.">
                  {pf.borrowed.length === 0 ? (
                    <EmptyBlock title="No active borrows">This profile has zero outstanding debt.</EmptyBlock>
                  ) : (
                    <DataTable
                      rows={pf.borrowed}
                      rowKey={(p) => p.poolId}
                      columns={[
                        { key: 'asset', header: 'Asset', cell: (p) => <span className="font-semibold text-white">{p.asset}</span> },
                        { key: 'amount', header: 'Debt Balance', align: 'right', cell: (p) => <span className="font-mono text-xs tabular-nums text-zinc-300">{p.amount}</span> },
                        { key: 'usd', header: 'USD Value', align: 'right', cell: (p) => <span className="font-mono text-xs tabular-nums text-rose-300">{usd(p.usd)}</span> },
                        { key: 'apy', header: 'Borrow APY', align: 'right', cell: (p) => <span className="font-mono text-xs tabular-nums text-rose-400">{p.apy.toFixed(2)}%</span> },
                        { key: 'interest', header: 'Accrued Interest', align: 'right', cell: (p) => <span className="font-mono text-xs tabular-nums text-zinc-400">{p.interest}</span> },
                      ]}
                    />
                  )}
                </Section>
              </div>

              {d.loans && d.loans.length > 0 && (
                <Section title="Associated Simple Loans" description="Simple loans opened with this user's wallet addresses.">
                  <DataTable
                    rows={d.loans}
                    rowKey={(l) => l.ref}
                    onRowClick={(l) => nav(swapUrl.lendLoan(l.ref))}
                    columns={[
                      { key: 'ref', header: 'Loan', cell: (l) => <span className="font-mono text-xs text-zinc-100">{l.ref}</span> },
                      { key: 'borrow', header: 'Borrowed', align: 'right', cell: (l) => <span className="font-mono text-xs tabular-nums text-zinc-100">{units(debtOf(l), l.borrow.decimals, 2)} {l.borrow.asset}</span> },
                      { key: 'collateral', header: 'Collateral', align: 'right', cell: (l) => <span className="font-mono text-xs tabular-nums text-zinc-300">{units(collateralOf(l), l.collateral.decimals, 8)} {l.collateral.asset}</span> },
                      { key: 'ltv', header: 'LTV', align: 'right', cell: (l) => <LtvCell l={l} warnBps={6800} /> },
                      { key: 'phase', header: 'Stage', cell: (l) => <LoanPhaseBadge phase={l.phase} /> },
                      { key: 'when', header: 'Created', cell: (l) => <TimeAgo at={l.createdAt} unit="ms" /> },
                    ]}
                  />
                </Section>
              )}

              {d.events && d.events.length > 0 && (
                <Section title="Audit & Event History" description="Events recorded for this user and linked addresses.">
                  <ol className="space-y-2">
                    {d.events.map((ev: any, idx: number) => (
                      <li key={idx} className="flex items-center justify-between gap-3 text-xs p-2 rounded-lg bg-white/[0.015] border border-white/[0.04]">
                        <div className="flex items-center gap-2">
                          <Pill tone={ev.severity === 'error' ? 'rose' : ev.severity === 'warn' ? 'amber' : 'emerald'}>{ev.type}</Pill>
                          <span className="text-zinc-200">{ev.summary}</span>
                        </div>
                        <span className="text-zinc-500 font-mono"><TimeAgo at={ev.at} unit="ms" /></span>
                      </li>
                    ))}
                  </ol>
                </Section>
              )}
            </>
          );
        }}
      </QueryState>
    </>
  );
}
