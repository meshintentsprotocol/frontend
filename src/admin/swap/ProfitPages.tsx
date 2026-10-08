/**
 * Profits and treasury: what both products earn, whether each fee is actually being collected, the wallets the
 * money goes to, and the Jupiter referral account. Margins themselves are edited on the settings page.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PiggyBank, Wallet, RefreshCw, Plus, KeyRound, Eye, CheckCircle2, CircleSlash, HandCoins, Fuel, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ActionButton, ConfirmAction, DataTable, EmptyBlock, Hash, KeyValue, KpiTile, PageHeader, Pill, QueryState, Section, TimeAgo } from '../kit';
import { useProfits, useSwapAction, useSwapAdmin, useSwapOverview } from './SwapAdminContext';
import { SwapEventList, swapUrl, usd, usdc } from './swapKit';
import type { ProfitsView, ReferralStatus, TreasuryWallet } from './swapApi';

const solscan = (a: string) => `https://solscan.io/account/${a}`;
const fmtUnits = (base: string, decimals = 6) => (Number(base) / 10 ** decimals).toLocaleString(undefined, { maximumFractionDigits: Math.min(decimals, 6) });

/** 14 daily bars; the value of each day is in its tooltip and the total is stated next to the title. */
function DailyBars({ days, value, label, format }: { days: ProfitsView['stats']['daily']; value: (d: ProfitsView['stats']['daily'][number]) => number; label: string; format: (n: number) => string }) {
  const max = Math.max(...days.map(value), 0);
  if (max <= 0) return <div className="text-xs text-zinc-600 py-6 text-center">Nothing collected in the last {days.length} days</div>;
  return (
    <div>
      <div className="flex items-end gap-1 h-24" role="img" aria-label={`${label}, last ${days.length} days`}>
        {days.map(d => (
          <div key={d.day} className="flex-1 h-full flex flex-col justify-end" title={`${new Date(d.day).toLocaleDateString()}: ${format(value(d))}`}>
            <div className={cn('rounded-t-sm', value(d) > 0 ? 'bg-emerald-400/80' : 'bg-white/[0.04]')} style={{ height: value(d) > 0 ? `${Math.max(4, (value(d) / max) * 100)}%` : '2px' }} />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-zinc-600"><span>{new Date(days[0].day).toLocaleDateString()}</span><span>today</span></div>
    </div>
  );
}

function CollectingRow({ on, label, why }: { on: boolean; label: string; why: string }) {
  return (
    <li className="flex items-start gap-2.5 py-2">
      {on ? <CheckCircle2 className="w-4 h-4 mt-px shrink-0 text-emerald-400" aria-hidden /> : <CircleSlash className="w-4 h-4 mt-px shrink-0 text-zinc-600" aria-hidden />}
      <div className="min-w-0">
        <div className="text-xs font-medium text-zinc-100">{label} <span className={on ? 'text-emerald-300' : 'text-zinc-500'}>{on ? 'collecting' : 'not collecting'}</span></div>
        <div className="text-[11px] text-zinc-500 leading-relaxed">{why}</div>
      </div>
    </li>
  );
}

function Collecting({ p }: { p: ProfitsView }) {
  const { margins: m, collecting: c, treasury } = p;
  const has = (k: 'evm' | 'solana') => treasury.some(w => w.kind === k && w.active);
  const cctpRate = m.cctp.feeBps > 0 || m.cctp.feeMinUsdc > 0 || Object.keys(m.cctp.gasFeeUsdc).length > 0;
  const rate = `${m.cctp.feeBps} bps${m.cctp.feeMinUsdc ? `, minimum ${m.cctp.feeMinUsdc} USDC` : ''}${m.cctp.feeMaxUsdc ? `, maximum ${m.cctp.feeMaxUsdc} USDC` : ''}${Object.keys(m.cctp.gasFeeUsdc).length ? `, plus a gas charge on ${Object.keys(m.cctp.gasFeeUsdc).length} destination(s)` : ''}`;
  const why = (kind: 'evm' | 'solana') => (!cctpRate ? 'The rate is 0. Set one in the settings.' : !has(kind) ? `No active ${kind === 'evm' ? 'EVM' : 'Solana'} treasury wallet: there is nowhere to send the fee. Create one below.` : `${rate}. ${m.cctp.feeEnforced ? 'Delivery waits for the fee.' : 'Delivery does not wait for the fee.'}`);
  const jup = m.solana.referralFeeBps > 0 || !!m.solana.stocksFeeBps || !!m.solana.stablesFeeBps;
  return (
    <Section title="Is each fee being collected?" description={<>Margins are set on the <Link to={swapUrl.settings} className="text-zinc-300 hover:text-emerald-300">settings page</Link>. A rate alone collects nothing: it also needs somewhere to go.</>}>
      <ul className="divide-y divide-white/[0.05]">
        <CollectingRow on={c.evm} label="Cross-chain USDC from EVM chains:" why={why('evm')} />
        <CollectingRow on={c.solanaCctp} label="Cross-chain USDC from Solana:" why={why('solana')} />
        <CollectingRow on={c.jupiter} label="Solana swaps (Jupiter):"
          why={!m.solana.referralAccount ? 'No Jupiter referral account. Create one below or paste one in the settings.' : !jup ? 'A referral account is set but every rate is 0.'
            : `${m.solana.referralFeeBps} bps${m.solana.stocksFeeBps !== null ? `, stocks ${m.solana.stocksFeeBps} bps` : ''}${m.solana.stablesFeeBps !== null ? `, stablecoin pairs ${m.solana.stablesFeeBps} bps` : ''}. Jupiter keeps 20% of it.`} />
      </ul>
    </Section>
  );
}

function NewWallet() {
  const { api } = useSwapAdmin();
  const [kind, setKind] = useState<'evm' | 'solana'>('evm');
  const [label, setLabel] = useState('');
  const [address, setAddress] = useState('');
  const create = useSwapAction(() => api.createWallet({ kind, label: label.trim() || undefined, address: address.trim() || undefined }), { label: 'Create wallet', success: r => `${r.wallet.label} ${r.wallet.active ? 'created and active' : 'created'}` });
  const external = !!address.trim();
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.015] p-3.5 space-y-2.5">
      <div className="flex items-center gap-2 text-xs font-semibold text-zinc-100"><Plus className="w-3.5 h-3.5 text-emerald-300" aria-hidden />New treasury wallet</div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="tw-kind">Chain type</label>
        <select id="tw-kind" value={kind} onChange={e => setKind(e.target.value as 'evm' | 'solana')} className="h-8 px-2 rounded-lg bg-white/[0.03] border border-white/10 text-xs text-zinc-100 focus:outline-none">
          <option value="evm" className="bg-zinc-900">EVM chains (one address for all)</option>
          <option value="solana" className="bg-zinc-900">Solana</option>
        </select>
        <input value={label} onChange={e => setLabel(e.target.value)} maxLength={60} placeholder="Label, e.g. Fees Q4" aria-label="Label"
          className="w-44 h-8 px-2.5 rounded-lg bg-white/[0.03] border border-white/10 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-400/50" />
        <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Existing address (leave empty to generate one)" aria-label="Existing address"
          className="flex-1 min-w-[240px] h-8 px-2.5 rounded-lg bg-white/[0.03] border border-white/10 text-xs text-white font-mono placeholder:text-zinc-600 focus:outline-none focus:border-emerald-400/50" />
        <ConfirmAction label={external ? 'Add address' : 'Generate wallet'} tone="primary" icon={external ? <Eye className="w-3.5 h-3.5" /> : <KeyRound className="w-3.5 h-3.5" />} pending={create.isPending}
          title={external ? 'Add this address as a treasury wallet?' : `Generate a new ${kind === 'evm' ? 'EVM' : 'Solana'} wallet on the server?`} confirmLabel={external ? 'Add' : 'Generate'}
          onConfirm={() => { create.run(undefined); setLabel(''); setAddress(''); }}
          description={external
            ? 'The server only watches this address; the key stays wherever it is now. This is the right choice for mainnet: a hardware wallet or a multisig.'
            : 'The key is created and kept on the swap server (data/treasury-keys). It is never shown here; scripts/treasury_export.ts prints it on the server when you need to move funds. Anyone with access to the server can spend from this wallet, so keep balances small and sweep them.'} />
      </div>
      <p className="text-[11px] text-zinc-500 leading-relaxed">The first wallet of a type becomes active. A generated Solana wallet can also create and claim from the Jupiter referral account; an external one cannot sign from here.</p>
    </div>
  );
}

function Wallets({ wallets }: { wallets: TreasuryWallet[] }) {
  const { api } = useSwapAdmin();
  const activate = useSwapAction((id: string) => api.activateWallet(id), { label: 'Activate', success: r => `Fees now go to ${r.wallet.label}` });
  const archive = useSwapAction((id: string) => api.archiveWallet(id), { label: 'Archive', success: r => `${r.wallet.label} archived` });
  return (
    <Section title="Treasury wallets" icon={<Wallet className="w-4 h-4 text-emerald-300" aria-hidden />}
      description="Where fees are paid. One active wallet per chain type. Switching affects new quotes only: a transfer already created pays the wallet it was quoted with.">
      <div className="space-y-4">
        {wallets.length === 0 ? <EmptyBlock title="No treasury wallet yet">Without one, no cross-chain fee can be collected. Generate a wallet or add an address you already hold.</EmptyBlock> : (
          <DataTable rowKey={w => w.id} rows={wallets} columns={[
            { key: 'label', header: 'Wallet', cell: w => <div><div className="text-xs font-medium text-zinc-100">{w.label}</div><div className="text-[10px] text-zinc-600">{w.kind === 'evm' ? 'EVM chains' : 'Solana'} · created <TimeAgo at={w.createdAt} unit="ms" className="text-[10px] text-zinc-600" /></div></div> },
            { key: 'state', header: 'State', cell: w => <span className="inline-flex gap-1">{w.active ? <Pill tone="emerald" dot>Active</Pill> : <Pill tone="zinc">Standby</Pill>}{w.hasKey ? <Pill tone="amber" title="The key is on the server">key on server</Pill> : <Pill tone="sky" title="Watch-only: the key is held elsewhere">watch-only</Pill>}</span> },
            { key: 'addr', header: 'Address', cell: w => <Hash value={w.address} head={8} tail={6} href={w.kind === 'solana' ? solscan(w.address) : undefined} /> },
            { key: 'bal', header: 'Holds', cell: w => {
              const held = w.balances.filter(b => (b.usdc && Number(b.usdc) > 0) || (b.native && Number(b.native) > 0));
              const failed = w.balances.filter(b => b.error).length;
              return (
                <div className="text-xs">
                  {held.length === 0 ? <span className="text-zinc-600">nothing yet</span> : held.map(b => (
                    <div key={b.chain} className="font-mono tabular-nums text-zinc-100 whitespace-nowrap">{b.usdc ? `${b.usdc} USDC` : `${b.native} ${b.symbol}`} <span className="text-zinc-500 font-sans">on {b.name}</span></div>
                  ))}
                  {failed > 0 && <div className="text-[10px] text-amber-300">{failed} chain(s) could not be read</div>}
                </div>
              );
            } },
            { key: 'act', header: '', align: 'right', cell: w => (
              <span className="inline-flex gap-1.5">
                {!w.active && (
                  <ConfirmAction label="Make active" title={`Send ${w.kind === 'evm' ? 'EVM' : 'Solana'} fees to ${w.label}?`} confirmLabel="Make active" onConfirm={() => activate.run(w.id)} pending={activate.isPending}
                    description={<>New quotes will pay <span className="font-mono text-zinc-300">{w.address}</span>. Check the address: fees sent to a wrong address cannot be recovered.</>} />
                )}
                {!w.active && <ActionButton onClick={() => archive.run(w.id)} pending={archive.isPending}>Archive</ActionButton>}
              </span>
            ) },
          ]} />
        )}
        <NewWallet />
      </div>
    </Section>
  );
}

function Referral({ r, signer }: { r: ReferralStatus; signer?: TreasuryWallet }) {
  const { api } = useSwapAdmin();
  const [name, setName] = useState('bch-intents');
  const create = useSwapAction((n: string) => api.createReferral(n), { label: 'Create referral account', success: x => `Referral account created: ${x.account.slice(0, 8)}…` });
  const accounts = useSwapAction(() => api.addReferralAccounts(), { label: 'Fee accounts', success: () => 'Fee accounts are ready' });
  const claim = useSwapAction(() => api.claimReferral(), { label: 'Claim', success: x => `Claimed in ${x.signatures.length} transaction(s)` });
  const sol = signer?.balances.find(b => b.chain === 'solana-mainnet')?.native;
  const canSign = !!signer?.hasKey;
  const missing = r.tokenAccounts.filter(t => !t.exists);
  const claimable = r.tokenAccounts.some(t => t.exists && t.balance !== '0');
  return (
    <Section title="Jupiter referral account" icon={<Sparkles className="w-4 h-4 text-emerald-300" aria-hidden />}
      description="Solana swap fees are paid by Jupiter into this account, one token account per fee currency. Claiming moves them to the treasury wallet that owns it.">
      {r.error && <p role="alert" className="mb-3 text-xs text-amber-300">Could not read the account: {r.error}</p>}
      {!r.account ? (
        <div className="space-y-3">
          <p className="text-xs text-zinc-400 leading-relaxed">No referral account is set, so Solana swaps earn nothing. Create one from the Solana treasury wallet (about 0.01 SOL on mainnet for rent), or make one at <a href="https://referral.jup.ag/" target="_blank" rel="noreferrer" className="text-sky-300 hover:underline">referral.jup.ag</a> and paste its address in the settings.</p>
          <KeyValue rows={[
            ['Signing wallet', signer ? <Hash key="s" value={signer.address} href={solscan(signer.address)} head={8} tail={6} /> : <span className="text-amber-300">none: create a Solana treasury wallet first</span>],
            signer ? ['Its SOL on mainnet', <span key="b" className={Number(sol ?? 0) < 0.01 ? 'text-amber-300 font-mono' : 'font-mono'}>{sol ?? '—'} SOL{Number(sol ?? 0) < 0.01 ? ' (needs about 0.01)' : ''}</span>] : null,
            signer && !canSign ? ['Note', 'This wallet is watch-only; the server cannot sign for it.'] : null,
          ]} />
          <form onSubmit={e => { e.preventDefault(); create.run(name.trim()); }} className="flex flex-wrap items-center gap-2">
            <input value={name} onChange={e => setName(e.target.value)} maxLength={32} aria-label="Referral account name" placeholder="name"
              className="w-48 h-8 px-2.5 rounded-lg bg-white/[0.03] border border-white/10 text-xs text-white font-mono focus:outline-none focus:border-emerald-400/50" />
            <ConfirmAction label="Create referral account" tone="primary" disabled={!canSign || !name.trim()} pending={create.isPending} title="Create the Jupiter referral account?" confirmLabel="Create"
              onConfirm={() => create.run(name.trim())}
              description="This sends real transactions on Solana mainnet from the treasury wallet: one to create the account and one per fee currency (SOL, USDC, USDT). The account address is then saved in the settings." />
          </form>
        </div>
      ) : (
        <div className="space-y-4">
          <KeyValue rows={[
            ['Account', <Hash key="a" value={r.account} href={solscan(r.account)} head={10} tail={8} />],
            ['On chain', r.exists ? <Pill key="e" tone="emerald" dot>found{r.name ? ` · ${r.name}` : ''}</Pill> : <Pill key="e" tone="rose" dot>not found on mainnet</Pill>],
            r.partner ? ['Owner (claims go here)', <Hash key="p" value={r.partner} href={solscan(r.partner)} head={10} tail={8} />] : null,
          ]} />
          <DataTable rowKey={t => t.mint} rows={r.tokenAccounts} empty={<EmptyBlock title="No fee accounts" />} columns={[
            { key: 'sym', header: 'Fee currency', cell: t => <span className="text-xs font-medium text-zinc-100">{t.symbol ?? `${t.mint.slice(0, 6)}…`}</span> },
            { key: 'ok', header: 'Account', cell: t => (t.exists ? <Pill tone="emerald">ready</Pill> : <Pill tone="amber" title="Swaps whose fee falls in this currency pay us nothing">missing</Pill>) },
            { key: 'bal', header: 'Waiting to be claimed', align: 'right', cell: t => <span className={cn('font-mono text-xs tabular-nums', t.balance !== '0' ? 'text-emerald-300' : 'text-zinc-500')}>{fmtUnits(t.balance, t.decimals)} {t.symbol ?? ''}</span> },
            { key: 'addr', header: 'Token account', hideBelow: 'md', cell: t => <Hash value={t.address} href={solscan(t.address)} head={6} tail={4} /> },
          ]} />
          <div className="flex flex-wrap items-center gap-2">
            {missing.length > 0 && <ActionButton tone="warn" disabled={!canSign} pending={accounts.isPending} onClick={() => accounts.run(undefined)}>Create {missing.length} missing fee account(s)</ActionButton>}
            <ConfirmAction label="Claim to treasury" icon={<HandCoins className="w-3.5 h-3.5" />} tone="primary" disabled={!canSign || !claimable} pending={claim.isPending} title="Claim every accrued fee?" confirmLabel="Claim"
              onConfirm={() => claim.run(undefined)} description="Sends mainnet transactions from the treasury wallet that move all accrued fees from the referral token accounts to it." />
            {!canSign && <span className="text-[11px] text-zinc-500">The active Solana treasury wallet is watch-only or missing: manage this account from its owner at referral.jup.ag.</span>}
          </div>
        </div>
      )}
    </Section>
  );
}

export function ProfitsPage() {
  const q = useProfits();
  const o = useSwapOverview();
  const { api } = useSwapAdmin();
  const refresh = useSwapAction(() => api.profits(true), { label: 'Refresh', success: () => 'Balances refreshed' });
  const names = Object.fromEntries((o.data?.cctp.chains ?? []).map(c => [c.key, c.name]));
  return (
    <>
      <PageHeader title="Profits and treasury" icon={<PiggyBank className="w-5 h-5 text-emerald-300" aria-hidden />} crumbs={[{ label: 'Swap server', to: swapUrl.home }, { label: 'Profits' }]}
        description="What the two products earn and where it goes. Cross-chain fees are counted when the USDC is seen arriving at the treasury. Solana fees are estimated from each swap; the referral account balances below are the exact figure."
        actions={<ActionButton icon={<RefreshCw className="w-3.5 h-3.5" />} onClick={() => refresh.run(undefined)} pending={refresh.isPending}>Refresh balances</ActionButton>} />
      <QueryState q={q} rows={10}>{p => {
        const { cctp, solana, daily } = p.stats;
        const gas = Object.entries(cctp.relayCost);
        return (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
              <KpiTile label="Cross-chain fees received" value={`${usdc(cctp.paid, 4)} USDC`} sub={`${cctp.paidCount} transfer(s) · ${usdc(cctp.last24h.paid, 4)} in 24h`} tone={cctp.paidCount ? 'emerald' : undefined} icon={<PiggyBank className="w-4 h-4" />} />
              <KpiTile label="Waiting or unpaid" value={`${usdc((BigInt(cctp.awaiting) + BigInt(cctp.unpaid)).toString(), 4)} USDC`} tone={cctp.awaitingCount || cctp.unpaidCount ? 'amber' : undefined}
                sub={`${cctp.awaitingCount} on hold · ${cctp.unpaidCount} delivered unpaid`} to={`${swapUrl.transfers}?status=active`} />
              <KpiTile label="Solana fees, estimated" value={usd(solana.estimatedUsd)} sub={`${solana.swapsWithFee} swap(s) · ${usd(solana.last24h.estimatedUsd)} in 24h`} tone={solana.swapsWithFee ? 'emerald' : undefined} />
              <KpiTile label="Relayer gas spent" icon={<Fuel className="w-4 h-4" />} value={gas.length ? gas.map(([sym, n]) => `${n.toLocaleString(undefined, { maximumSignificantDigits: 3 })} ${sym}`).join(' · ') : '—'} sub={`${cctp.relayed} mint(s) paid for`} />
            </div>
            <Collecting p={p} />
            <div className="grid gap-5 lg:grid-cols-2">
              <Section title="Cross-chain fees by day" description={`${usdc(daily.reduce((a, d) => a + BigInt(d.cctpFees), 0n).toString(), 4)} USDC in the last ${daily.length} days`}>
                <DailyBars days={daily} value={d => Number(d.cctpFees) / 1e6} label="Cross-chain fees" format={n => `${n.toLocaleString(undefined, { maximumFractionDigits: 4 })} USDC`} />
                {cctp.byChain.length > 0 && (
                  <ul className="mt-4 space-y-1">
                    {cctp.byChain.map(c => (
                      <li key={c.chain} className="flex items-center justify-between text-xs"><span className="text-zinc-400">From {names[c.chain] ?? c.chain}</span><span className="font-mono tabular-nums text-zinc-100">{usdc(c.fees, 4)} USDC <span className="text-zinc-600">· {c.count}</span></span></li>
                    ))}
                  </ul>
                )}
              </Section>
              <Section title="Solana fees by day" description={`${usd(daily.reduce((a, d) => a + d.solanaUsd, 0))} estimated in the last ${daily.length} days`}>
                <DailyBars days={daily} value={d => d.solanaUsd} label="Solana swap fees" format={n => usd(n)} />
                {solana.byMint.length > 0 && (
                  <ul className="mt-4 space-y-1">
                    {solana.byMint.map(m => (
                      <li key={m.mint} className="flex items-center justify-between text-xs"><span className="text-zinc-400">Reported by Jupiter in <Hash value={m.mint} head={4} tail={4} copy={false} /></span><span className="font-mono tabular-nums text-zinc-100">{m.ours} base units <span className="text-zinc-600">· {m.count}</span></span></li>
                    ))}
                  </ul>
                )}
              </Section>
            </div>
            <Wallets wallets={p.treasury} />
            <Referral r={p.referral} signer={p.treasury.find(w => w.kind === 'solana' && w.active)} />
            <Section title="Fee events" description="Fees received, fees a transfer is waiting for, and claims."><SwapEventList events={p.history} empty="No fee has been recorded yet" /></Section>
          </>
        );
      }}</QueryState>
    </>
  );
}
