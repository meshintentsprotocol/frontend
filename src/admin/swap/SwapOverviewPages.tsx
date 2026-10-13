/**
 * Swap server: the overview of both products, the event log and the settings.
 * Cross-chain USDC (Circle CCTP) and Solana swaps (Jupiter) each get their own column, controls and settings.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Activity, ArrowLeftRight, Coins, Pause, Play, Settings2, ShieldAlert, RotateCcw, Save, StickyNote, Server, LogOut } from 'lucide-react';
import { ActionButton, ConfirmAction, KeyValue, KpiTile, PageHeader, Pager, Pill, QueryState, SearchBox, Section, Segmented, useUrlState } from '../kit';
import { useBchSwaps, useProfits, useSwapAction, useSwapAdmin, useSwapEvents, useSwapOverview, useSwapSettings, useSwapSystem } from './SwapAdminContext';
import { AlertList, HourlyBars, SwapEventList, SwitchRow, pct, secs, swapUrl, usd, usdc } from './swapKit';
import type { BchSettings, CctpSettings, SolanaSettings, SwapOverview } from './swapApi';

/** Pause or resume one product. Pausing asks for a reason, which is shown to operators and logged. */
export function PauseControl({ section, paused }: { section: 'cctp' | 'solana' | 'bch'; paused: boolean }) {
  const { api } = useSwapAdmin();
  const [reason, setReason] = useState('');
  const what = section === 'cctp' ? 'cross-chain transfers' : section === 'solana' ? 'Solana swaps' : 'Bitcoin Cash swaps';
  const pause = useSwapAction((r: string) => (section === 'cctp' ? api.pauseCctp(r) : section === 'solana' ? api.pauseSolana(r) : api.pauseBch(r)), { label: 'Pause', success: () => `New ${what} paused` });
  const resume = useSwapAction(() => (section === 'cctp' ? api.resumeCctp() : section === 'solana' ? api.resumeSolana() : api.resumeBch()), { label: 'Resume', success: () => `New ${what} resumed` });
  if (paused) {
    return <ActionButton tone="primary" icon={<Play className="w-3.5 h-3.5" />} pending={resume.isPending} onClick={() => resume.run(undefined)}>Resume</ActionButton>;
  }
  return (
    <ConfirmAction label="Pause" tone="warn" icon={<Pause className="w-3.5 h-3.5" />} pending={pause.isPending}
      title={`Pause new ${what}?`} confirmLabel="Pause" onConfirm={() => pause.run(reason.trim())}
      description={section === 'cctp'
        ? 'New transfers are refused with "temporarily unavailable". Transfers already burned keep being relayed to their destination.'
        : 'New swaps are refused. A swap whose transaction is already signed can still be executed.'}>
      <label className="block text-xs text-zinc-300">
        Reason (optional)
        <input value={reason} onChange={e => setReason(e.target.value)} maxLength={200} placeholder="e.g. relayer out of gas on Arc"
          className="mt-1 w-full h-8 px-2.5 rounded-lg bg-white/[0.03] border border-white/10 text-xs text-white focus:outline-none focus:border-emerald-400/50" />
      </label>
    </ConfirmAction>
  );
}

function ProductCard({ title, icon, paused, pauseReason, section, to, children }: {
  title: string; icon: ReactNode; paused: boolean; pauseReason?: string; section: 'cctp' | 'solana' | 'bch'; to: string; children: ReactNode;
}) {
  return (
    <Section title={<Link to={to} className="hover:text-emerald-300">{title}</Link>} icon={icon}
      description={paused ? `Paused${pauseReason ? `: ${pauseReason}` : ''}` : undefined}
      actions={<><Pill tone={paused ? 'amber' : 'emerald'} dot>{paused ? 'Paused' : 'Running'}</Pill><PauseControl section={section} paused={paused} /></>}>
      <div className="space-y-4">{children}</div>
    </Section>
  );
}

function CctpCard({ o }: { o: SwapOverview }) {
  const { stats, settings, chains } = o.cctp;
  const low = chains.filter(c => c.relayer?.low || c.relayer?.error).length;
  return (
    <ProductCard title="Cross-chain USDC" icon={<ArrowLeftRight className="w-4 h-4 text-emerald-300" aria-hidden />} paused={settings.paused} pauseReason={settings.pauseReason} section="cctp" to={swapUrl.transfers}>
      <div className="grid grid-cols-2 gap-2.5">
        <KpiTile label="Transfers, 24h" value={stats.last24h.created} sub={`${stats.last24h.completed} completed · ${stats.last24h.failed} failed`} to={swapUrl.transfers} />
        <KpiTile label="Volume, 24h" value={`${usdc(stats.last24h.volume)} USDC`} sub={`${usdc(stats.volume)} USDC all time`} />
        <KpiTile label="In flight" value={stats.active - stats.awaitingBurn} tone={stats.stuck.length ? 'rose' : stats.active - stats.awaitingBurn ? 'sky' : undefined}
          sub={stats.stuck.length ? `${stats.stuck.length} stuck` : `${stats.awaitingBurn} awaiting burn`} to={`${swapUrl.transfers}?status=active`} />
        <KpiTile label="Success rate" value={pct(stats.successRate)} tone={stats.successRate !== null && stats.successRate < 0.9 ? 'amber' : undefined} sub={`median ${secs(stats.timingSec.total)} burn to mint`} />
      </div>
      <HourlyBars hourly={stats.hourly} />
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500">
        <span>{chains.filter(c => c.open).length} of {chains.length} chains open · network {o.network.cctp}</span>
        <Link to={swapUrl.chains} className={low ? 'text-rose-300 hover:underline' : 'hover:text-zinc-200'}>{low ? `${low} relayer wallet(s) need gas` : 'Relayer gas is fine'} →</Link>
      </div>
    </ProductCard>
  );
}

function SolanaCard({ o }: { o: SwapOverview }) {
  const { stats, settings, jupiter, catalog } = o.solana;
  return (
    <ProductCard title="Solana swaps" icon={<Coins className="w-4 h-4 text-emerald-300" aria-hidden />} paused={settings.paused} pauseReason={settings.pauseReason} section="solana" to={swapUrl.swaps}>
      <div className="grid grid-cols-2 gap-2.5">
        <KpiTile label="Swaps, 24h" value={stats.last24h.created} sub={`${stats.last24h.completed} completed · ${stats.last24h.failed} failed`} to={swapUrl.swaps} />
        <KpiTile label="Volume, 24h" value={usd(stats.last24h.volumeUsd)} sub={`${usd(stats.volumeUsd)} all time`} />
        <KpiTile label="Awaiting result" value={stats.submitted} tone={stats.submitted ? 'sky' : undefined} sub={`${stats.byStatus.CREATED ?? 0} awaiting signature`} to={`${swapUrl.swaps}?status=active`} />
        <KpiTile label="Success rate" value={pct(stats.successRate)} tone={stats.successRate !== null && stats.successRate < 0.9 ? 'amber' : undefined} sub={`median ${secs(stats.medianLandSec)} to land`} />
      </div>
      <HourlyBars hourly={stats.hourly} />
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500">
        <span>Jupiter {jupiter.apiKey ? 'key set' : 'no key'} · {jupiter.rps} req/s · {jupiter.errors} errors of {jupiter.requests}</span>
        <Link to={swapUrl.tokens} className="hover:text-zinc-200">{catalog.tokens.toLocaleString()} tokens · stocks {settings.stocksEnabled ? 'on' : 'off'} →</Link>
      </div>
    </ProductCard>
  );
}

function BchCard() {
  const p = useProfits();
  const q = useBchSwaps({ limit: 10 });
  const bchStats = p.data?.bchStats;
  const swaps = q.data?.swaps ?? [];
  const bchPaused = !!p.data?.margins.bch && !p.data?.collecting.bch;
  return (
    <ProductCard title="Bitcoin Cash" icon={<ArrowLeftRight className="w-4 h-4 text-emerald-400" aria-hidden />} paused={bchPaused} section="bch" to={swapUrl.bchSwaps}>
      <div className="grid grid-cols-2 gap-2.5">
        <KpiTile label="Total Swaps" value={bchStats?.totalSwaps ?? swaps.length} sub={`${bchStats?.successfulSwaps ?? swaps.filter(s => s.status === 'SUCCESS').length} settled`} to={swapUrl.bchSwaps} />
        <KpiTile label="Est. Total Volume" value={usd(bchStats?.totalVolumeUsd ?? 0)} sub="Across all chains" />
        <KpiTile label="Net App Profit" value={usd(bchStats?.totalProfitUsd ?? 0)} tone="emerald" sub="0.25% margin" />
        <KpiTile label="Pending Deposits" value={swaps.filter(s => s.status === 'PENDING_DEPOSIT').length} sub="Awaiting send" to={`${swapUrl.bchSwaps}?status=PENDING_DEPOSIT`} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500 pt-3 border-t border-white/[0.05]">
        <span>NEAR Intents 1Click · Bidirectional</span>
        <Link to={swapUrl.bchTokens} className="hover:text-zinc-200">Token catalog →</Link>
      </div>
    </ProductCard>
  );
}

export function SwapOverviewPage() {
  const q = useSwapOverview();
  const { setAdminKey, serverUrl } = useSwapAdmin();
  return (
    <>
      <PageHeader title="Swap server" icon={<Server className="w-5 h-5 text-emerald-300" aria-hidden />}
        description="Cross-chain USDC (CCTP), Solana (Jupiter), and Bitcoin Cash (1Click), served by one server. Each has its own controls and audit trails."
        actions={<>
          <span className="text-[11px] text-zinc-500 font-mono">{serverUrl.replace(/^https?:\/\//, '')}</span>
          <ActionButton icon={<LogOut className="w-3.5 h-3.5" />} onClick={() => setAdminKey(null)} title="Forget the swap server key saved in this browser">Forget key</ActionButton>
        </>} />
      <QueryState q={q} rows={8}>{o => (
        <>
          <Section title="Needs attention" icon={<ShieldAlert className="w-4 h-4 text-amber-300" aria-hidden />}><AlertList alerts={o.alerts} /></Section>
          <div className="grid gap-5 xl:grid-cols-3 items-start">
            <CctpCard o={o} />
            <SolanaCard o={o} />
            <BchCard />
          </div>
          <Section title="Latest events" icon={<Activity className="w-4 h-4 text-emerald-300" aria-hidden />}
            description={`Last 24 hours: ${o.events.h24.error} errors, ${o.events.h24.warn} warnings, ${o.events.h24.success} completions`}
            actions={<Link to={swapUrl.events} className="text-xs text-zinc-400 hover:text-zinc-100">All events →</Link>}>
            <SwapEventList events={o.events.recent} />
          </Section>
        </>
      )}</QueryState>
    </>
  );
}

// ── events ───────────────────────────────────────────────────────────────────

export function SwapEventsPage() {
  const [f, setF] = useUrlState({ section: '', severity: '', type: '', offset: '0' });
  const limit = 100;
  const q = useSwapEvents({ section: f.section, severity: f.severity, type: f.type, limit, offset: f.offset });
  const { api } = useSwapAdmin();
  const [text, setText] = useState('');
  const note = useSwapAction((t: string) => api.note(t, f.section === 'cctp' || f.section === 'solana' ? f.section : undefined), { label: 'Note', success: () => 'Note added' });
  return (
    <>
      <PageHeader title="Swap server events" crumbs={[{ label: 'Swap server', to: swapUrl.home }, { label: 'Events' }]}
        description="Every status change of a transfer or a swap, every operator action and every watchdog warning, newest first." />
      <Section actions={<>
        <Segmented label="Product" value={f.section} onChange={v => setF({ section: v })} options={[{ value: '', label: 'All' }, { value: 'cctp', label: 'Cross-chain' }, { value: 'solana', label: 'Solana' }, { value: 'system', label: 'Server' }]} />
        <Segmented label="Severity" value={f.severity} onChange={v => setF({ severity: v })} options={[{ value: '', label: 'Any' }, { value: 'error', label: 'Errors' }, { value: 'warn', label: 'Warnings' }, { value: 'success', label: 'Completions' }]} />
        <SearchBox value={f.type} onChange={v => setF({ type: v })} placeholder="Type prefix, e.g. admin. or swap.failed" className="w-56" />
      </>}>
        <form onSubmit={e => { e.preventDefault(); if (text.trim()) { note.run(text.trim()); setText(''); } }} className="flex items-center gap-2 mb-3">
          <StickyNote className="w-3.5 h-3.5 text-zinc-500 shrink-0" aria-hidden />
          <input value={text} onChange={e => setText(e.target.value)} maxLength={500} placeholder="Add a note to the log (what you did, what you saw)" aria-label="Note"
            className="flex-1 h-8 px-2.5 rounded-lg bg-white/[0.03] border border-white/[0.08] text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-400/50" />
          <ActionButton onClick={() => { if (text.trim()) { note.run(text.trim()); setText(''); } }} disabled={!text.trim()} pending={note.isPending}>Add note</ActionButton>
        </form>
        <QueryState q={q}>{d => (
          <>
            <SwapEventList events={d.events} empty="No events match these filters" />
            <Pager offset={Number(f.offset)} limit={limit} total={d.total} onChange={o => setF({ offset: String(o) })} />
          </>
        )}</QueryState>
      </Section>
    </>
  );
}

// ── settings ─────────────────────────────────────────────────────────────────

function NumberField({ label, hint, value, onChange, min, max, step = 1, suffix }: {
  label: string; hint?: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; suffix?: string;
}) {
  return (
    <label className="block py-2.5">
      <span className="text-xs font-medium text-zinc-200">{label}</span>
      {hint && <span className="block mt-0.5 text-[11px] text-zinc-500 leading-relaxed">{hint}</span>}
      <span className="mt-1.5 flex items-center gap-2">
        <input type="number" value={Number.isFinite(value) ? value : ''} min={min} max={max} step={step} onChange={e => onChange(e.target.value === '' ? NaN : Number(e.target.value))}
          className="w-36 h-8 px-2.5 rounded-lg bg-white/[0.03] border border-white/10 text-xs text-white font-mono tabular-nums focus:outline-none focus:border-emerald-400/50" />
        {suffix && <span className="text-[11px] text-zinc-500">{suffix}</span>}
      </span>
    </label>
  );
}

/** A rate that may be left empty: empty means "same as the default rate". */
function OptionalNumberField({ label, hint, value, onChange, suffix, placeholder }: {
  label: string; hint?: string; value: number | null; onChange: (v: number | null) => void; suffix?: string; placeholder?: string;
}) {
  return (
    <label className="block py-2.5">
      <span className="text-xs font-medium text-zinc-200">{label}</span>
      {hint && <span className="block mt-0.5 text-[11px] text-zinc-500 leading-relaxed">{hint}</span>}
      <span className="mt-1.5 flex items-center gap-2">
        <input type="number" value={value === null || !Number.isFinite(value) ? '' : value} min={0} max={255} placeholder={placeholder}
          onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
          className="w-28 h-8 px-2.5 rounded-lg bg-white/[0.03] border border-white/10 text-xs text-white font-mono tabular-nums placeholder:text-zinc-600 focus:outline-none focus:border-emerald-400/50" />
        {suffix && <span className="text-[11px] text-zinc-500">{suffix}</span>}
      </span>
    </label>
  );
}

/** Edits a copy of one product's settings and saves only the fields that changed. */
function useDraft<T extends object>(saved: T) {
  const [draft, setDraft] = useState<T>(saved);
  const key = JSON.stringify(saved);
  useEffect(() => setDraft(saved), [key]);
  const changed = (Object.keys(saved) as (keyof T)[]).filter(k => JSON.stringify(saved[k]) !== JSON.stringify(draft[k]));
  const patch = Object.fromEntries(changed.map(k => [k, draft[k]])) as Partial<T>;
  return { draft, set: (p: Partial<T>) => setDraft(d => ({ ...d, ...p })), changed, patch, reset: () => setDraft(saved) };
}

function SaveBar({ changed, onSave, onDiscard, pending }: { changed: string[]; onSave: () => void; onDiscard: () => void; pending: boolean }) {
  if (!changed.length) return <div className="pt-3 text-[11px] text-zinc-600">No unsaved changes.</div>;
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2">
      <span className="text-xs text-amber-100">Unsaved: {changed.join(', ')}</span>
      <span className="flex items-center gap-2">
        <ActionButton onClick={onDiscard}>Discard</ActionButton>
        <ActionButton tone="primary" icon={<Save className="w-3.5 h-3.5" />} onClick={onSave} pending={pending}>Save</ActionButton>
      </span>
    </div>
  );
}

function CctpSettingsCard({ saved, chains }: { saved: CctpSettings; chains: Array<{ key: string; name: string }> }) {
  const { api } = useSwapAdmin();
  const d = useDraft(saved);
  const save = useSwapAction(() => api.setSettings({ cctp: d.patch }), { label: 'Save', success: r => (r.changed.length ? `Saved: ${r.changed.join(', ')}` : 'Nothing changed') });
  const reset = useSwapAction(() => api.resetSettings('cctp'), { label: 'Reset', success: () => 'Cross-chain settings reset' });
  const toggleChain = (key: string) => d.set({ disabledChains: d.draft.disabledChains.includes(key) ? d.draft.disabledChains.filter(k => k !== key) : [...d.draft.disabledChains, key] });
  return (
    <Section title="Cross-chain USDC" icon={<ArrowLeftRight className="w-4 h-4 text-emerald-300" aria-hidden />} description="Circle CCTP transfers. Changes apply to the next quote."
      actions={<ConfirmAction label="Reset" icon={<RotateCcw className="w-3.5 h-3.5" />} title="Reset cross-chain settings?" description="Every cross-chain setting goes back to the value in the server's env, including the pause and closed chains." confirmLabel="Reset" tone="warn" onConfirm={() => reset.run(undefined)} pending={reset.isPending} />}>
      <div className="divide-y divide-white/[0.05]">
        <SwitchRow label="Pause new transfers" danger checked={d.draft.paused} onChange={v => d.set({ paused: v })} description="Refuses new transfers. Transfers already burned are still delivered." />
        <SwitchRow label="Relay mints" checked={d.draft.relayEnabled} onChange={v => d.set({ relayEnabled: v })} description="Off: attested transfers wait and the user must mint with their own gas. Use when the relayer wallet is compromised or empty." />
        <SwitchRow label="Fast transfers" checked={d.draft.fastEnabled} onChange={v => d.set({ fastEnabled: v })} description="Off: every transfer waits for full finality (about 15 minutes from Ethereum and its rollups) and pays no Fast fee." />
        <div className="grid sm:grid-cols-3 gap-x-4">
          <NumberField label="Minimum transfer" value={d.draft.minTransferUsdc} onChange={v => d.set({ minTransferUsdc: v })} min={0.01} step={0.5} suffix="USDC" />
          <NumberField label="Maximum transfer" value={d.draft.maxTransferUsdc} onChange={v => d.set({ maxTransferUsdc: v })} min={0.01} step={10} suffix="USDC" />
          <NumberField label="Fee buffer" value={d.draft.feeBufferPct} onChange={v => d.set({ feeBufferPct: v })} min={0} max={500} suffix="% over Circle's fee" />
        </div>
        <div className="py-2.5">
          <div className="text-xs font-semibold text-emerald-200">Our fee</div>
          <div className="mt-0.5 text-[11px] text-zinc-500 leading-relaxed">Taken from the amount the user sends and paid to the treasury wallet on the source chain. Nothing is charged on a chain type with no active <Link to={swapUrl.profits} className="text-zinc-300 hover:text-emerald-300">treasury wallet</Link>.</div>
          <div className="grid sm:grid-cols-3 gap-x-4">
            <NumberField label="Rate" value={d.draft.feeBps} onChange={v => d.set({ feeBps: v })} min={0} max={1000} step={0.5} suffix="bps (100 = 1%)" />
            <NumberField label="Minimum" hint="Floor on the rate part. 0 = none." value={d.draft.feeMinUsdc} onChange={v => d.set({ feeMinUsdc: v })} min={0} step={0.01} suffix="USDC" />
            <NumberField label="Maximum" hint="Cap on the rate part. 0 = none." value={d.draft.feeMaxUsdc} onChange={v => d.set({ feeMaxUsdc: v })} min={0} step={1} suffix="USDC" />
          </div>
          <div className="mt-1 text-xs font-medium text-zinc-200">Gas charge by destination</div>
          <div className="mt-0.5 text-[11px] text-zinc-500">A flat amount added when the transfer lands on that chain, to cover what the relayer pays to mint there.</div>
          <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
            {chains.map(c => (
              <label key={c.key} className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.07] bg-white/[0.015] px-2.5 py-1.5">
                <span className="text-[11px] text-zinc-300 truncate">{c.name}</span>
                <input type="number" min={0} step={0.01} aria-label={`Gas charge to ${c.name}`} value={d.draft.gasFeeUsdc[c.key] ?? 0}
                  onChange={e => { const v = Number(e.target.value); const next = { ...d.draft.gasFeeUsdc }; if (v > 0) next[c.key] = v; else delete next[c.key]; d.set({ gasFeeUsdc: next }); }}
                  className="w-20 h-7 px-2 rounded-md bg-white/[0.03] border border-white/10 text-xs text-white font-mono tabular-nums text-right focus:outline-none focus:border-emerald-400/50" />
              </label>
            ))}
          </div>
        </div>
        <SwitchRow label="Hold the delivery until the fee is paid" checked={d.draft.feeEnforced} onChange={v => d.set({ feeEnforced: v })}
          description="On: a transfer whose fee has not arrived waits; the user can still mint it with their own gas. Off: it is delivered anyway and the fee is recorded as unpaid." />
        <div className="py-2.5">
          <div className="text-xs font-medium text-zinc-200">Open chains</div>
          <div className="mt-0.5 text-[11px] text-zinc-500">A closed chain is refused as source and as destination. Single routes are closed on the chains page.</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {chains.map(c => {
              const open = !d.draft.disabledChains.includes(c.key);
              return (
                <button key={c.key} type="button" role="switch" aria-checked={open} onClick={() => toggleChain(c.key)}
                  className={open ? 'px-2.5 py-1 rounded-md text-xs border bg-emerald-500/10 border-emerald-400/30 text-emerald-200' : 'px-2.5 py-1 rounded-md text-xs border bg-white/[0.02] border-white/10 text-zinc-500 line-through'}>
                  {c.name}
                </button>
              );
            })}
          </div>
          {d.draft.disabledRoutes.length > 0 && <div className="mt-2 text-[11px] text-amber-200">Closed routes: {d.draft.disabledRoutes.map(r => r.replace('>', ' → ')).join(', ')}</div>}
        </div>
      </div>
      <SaveBar changed={d.changed as string[]} onSave={() => save.run(undefined)} onDiscard={d.reset} pending={save.isPending} />
    </Section>
  );
}

function SolanaSettingsCard({ saved, referralAccount }: { saved: SolanaSettings; referralAccount: string | null }) {
  const { api } = useSwapAdmin();
  const d = useDraft(saved);
  const save = useSwapAction(() => api.setSettings({ solana: d.patch }), { label: 'Save', success: r => (r.changed.length ? `Saved: ${r.changed.join(', ')}` : 'Nothing changed') });
  const reset = useSwapAction(() => api.resetSettings('solana'), { label: 'Reset', success: () => 'Solana settings reset' });
  return (
    <Section title="Solana swaps" icon={<Coins className="w-4 h-4 text-emerald-300" aria-hidden />} description="Jupiter swaps on Solana mainnet. Changes apply to the next quote."
      actions={<ConfirmAction label="Reset" icon={<RotateCcw className="w-3.5 h-3.5" />} title="Reset Solana settings?" description="Every Solana setting goes back to the value in the server's env, including the pause and the blocked tokens." confirmLabel="Reset" tone="warn" onConfirm={() => reset.run(undefined)} pending={reset.isPending} />}>
      <div className="divide-y divide-white/[0.05]">
        <SwitchRow label="Pause new swaps" danger checked={d.draft.paused} onChange={v => d.set({ paused: v })} description="Refuses new swaps. A swap that is already signed can still be executed." />
        <SwitchRow label="Tokenized stocks" checked={d.draft.stocksEnabled} onChange={v => d.set({ stocksEnabled: v })} description="Off: stock tokens disappear from every list and cannot be quoted or swapped. Issuers do not offer them to US persons." />
        <SwitchRow label="Unverified tokens" checked={d.draft.allowUnverified} onChange={v => d.set({ allowUnverified: v })} description="Off: only tokens on Jupiter's verified list can be swapped. Fake copies of popular tokens are all unverified." />
        <div className="grid sm:grid-cols-2 gap-x-4">
          <NumberField label="Maximum slippage" hint="The most a client may ask for." value={d.draft.maxSlippageBps} onChange={v => d.set({ maxSlippageBps: v })} min={1} max={10000} suffix="bps" />
          <NumberField label="Default slippage" hint="Used when the client sends none. 0 lets Jupiter estimate it per trade." value={d.draft.defaultSlippageBps} onChange={v => d.set({ defaultSlippageBps: v })} min={0} max={10000} suffix="bps" />
          <NumberField label="Maximum swap size" hint="0 means no limit." value={d.draft.maxSwapUsd} onChange={v => d.set({ maxSwapUsd: v })} min={0} step={100} suffix="USD" />
          <NumberField label="Stock liquidity floor" hint="Stocks with less liquidity are hidden from the stocks list." value={d.draft.minStockLiquidityUsd} onChange={v => d.set({ minStockLiquidityUsd: v })} min={0} step={10000} suffix="USD" />
        </div>
        <div className="py-2.5">
          <div className="text-xs font-semibold text-emerald-200">Our fee</div>
          <div className="mt-0.5 text-[11px] text-zinc-500 leading-relaxed">
            Jupiter's referral fee, taken inside the swap: 0 is off, otherwise 50 to 255 bps. Jupiter keeps 20% of it, and swaps that carry a fee are not gasless.
            {!(d.draft.referralAccount || referralAccount) && <> It needs a referral account: create one on the <Link to={swapUrl.profits} className="text-zinc-300 hover:text-emerald-300">profits page</Link> or paste one below.</>}
          </div>
          <div className="grid sm:grid-cols-3 gap-x-4">
            <NumberField label="Default rate" value={d.draft.referralFeeBps} onChange={v => d.set({ referralFeeBps: v })} min={0} max={255} suffix="bps" />
            <OptionalNumberField label="Stocks" hint="When either side is a tokenized stock." value={d.draft.stocksFeeBps} onChange={v => d.set({ stocksFeeBps: v })} suffix="bps" placeholder="default" />
            <OptionalNumberField label="Stablecoin pairs" hint="Both sides are stablecoins." value={d.draft.stablesFeeBps} onChange={v => d.set({ stablesFeeBps: v })} suffix="bps" placeholder="default" />
          </div>
          <label className="block pt-1">
            <span className="text-xs font-medium text-zinc-200">Referral account</span>
            <span className="block mt-0.5 text-[11px] text-zinc-500">The Jupiter referral account fees are paid into. Empty uses the server env{referralAccount ? ` (${referralAccount.slice(0, 6)}…)` : ' (not set)'}.</span>
            <input value={d.draft.referralAccount} onChange={e => d.set({ referralAccount: e.target.value.trim() })} placeholder="Solana address" aria-label="Referral account"
              className="mt-1.5 w-full h-8 px-2.5 rounded-lg bg-white/[0.03] border border-white/10 text-xs text-white font-mono placeholder:text-zinc-600 focus:outline-none focus:border-emerald-400/50" />
          </label>
        </div>
        <div className="py-2.5 text-[11px] text-zinc-500">
          {saved.blockedMints.length} token(s) blocked. <Link to={swapUrl.tokens} className="text-zinc-300 hover:text-emerald-300">Manage blocked tokens →</Link>
        </div>
      </div>
      <SaveBar changed={d.changed as string[]} onSave={() => save.run(undefined)} onDiscard={d.reset} pending={save.isPending} />
    </Section>
  );
}

function BchSettingsCard({ saved }: { saved?: BchSettings }) {
  const { api } = useSwapAdmin();
  const defaultSaved: BchSettings = saved ?? {
    enabled: true,
    paused: false,
    pauseReason: '',
    feeBps: 25,
    feeRecipientNear: '',
    minSwapUsd: 1,
    maxSwapUsd: 100000,
  };
  const d = useDraft(defaultSaved);
  const save = useSwapAction(() => api.setSettings({ bch: d.patch }), { label: 'Save', success: r => (r.changed.length ? `Saved: ${r.changed.join(', ')}` : 'Nothing changed') });
  const reset = useSwapAction(() => api.resetSettings('bch'), { label: 'Reset', success: () => 'BCH settings reset' });
  return (
    <Section title="Bitcoin Cash" icon={<ArrowLeftRight className="w-4 h-4 text-emerald-300" aria-hidden />} description="NEAR Intents 1Click cross-chain swap settings."
      actions={<ConfirmAction label="Reset" icon={<RotateCcw className="w-3.5 h-3.5" />} title="Reset BCH settings?" description="Resets BCH settings to server defaults." confirmLabel="Reset" tone="warn" onConfirm={() => reset.run(undefined)} pending={reset.isPending} />}>
      <div className="divide-y divide-white/[0.05]">
        <SwitchRow label="Enable BCH Swaps" checked={d.draft.enabled} onChange={v => d.set({ enabled: v })} description="Allow quoting and swapping cross-chain tokens to and from Bitcoin Cash." />
        <SwitchRow label="Pause new swaps" danger checked={d.draft.paused} onChange={v => d.set({ paused: v })} description="Refuses new quotes and deposits. Existing pending deposits continue processing." />
        <div className="grid sm:grid-cols-3 gap-x-4">
          <NumberField label="Fee rate" hint="Basis points taken from each swap." value={d.draft.feeBps} onChange={v => d.set({ feeBps: v })} min={0} max={500} suffix="bps (25 = 0.25%)" />
          <NumberField label="Min swap USD" hint="Lower bound order size." value={d.draft.minSwapUsd} onChange={v => d.set({ minSwapUsd: v })} min={0.1} step={1} suffix="USD" />
          <NumberField label="Max swap USD" hint="Upper bound order size." value={d.draft.maxSwapUsd} onChange={v => d.set({ maxSwapUsd: v })} min={1} step={100} suffix="USD" />
        </div>
        <label className="block py-2.5">
          <span className="text-xs font-medium text-zinc-200">NEAR Fee Recipient Account</span>
          <span className="block mt-0.5 text-[11px] text-zinc-500">The NEAR account ID that protocol fees are credited to by NEAR Intents.</span>
          <input value={d.draft.feeRecipientNear} onChange={e => d.set({ feeRecipientNear: e.target.value.trim() })} placeholder="e.g. treasury.near" aria-label="Fee recipient"
            className="mt-1.5 w-full h-8 px-2.5 rounded-lg bg-white/[0.03] border border-white/10 text-xs text-white font-mono placeholder:text-zinc-600 focus:outline-none focus:border-emerald-400/50" />
        </label>
      </div>
      <SaveBar changed={d.changed as string[]} onSave={() => save.run(undefined)} onDiscard={d.reset} pending={save.isPending} />
    </Section>
  );
}

export function SwapSettingsPage() {
  const q = useSwapSettings();
  const sys = useSwapSystem();
  return (
    <>
      <PageHeader title="Swap server settings" icon={<Settings2 className="w-5 h-5 text-emerald-300" aria-hidden />} crumbs={[{ label: 'Swap server', to: swapUrl.home }, { label: 'Settings' }]}
        description="What can be changed while the server runs. Saved on the server and kept across restarts. Keys, RPC URLs and the referral account are set in the server's env, not here." />
      <QueryState q={q} rows={10}>{s => (
        <>
          <div className="grid gap-5 xl:grid-cols-3 items-start">
            <CctpSettingsCard saved={s.settings.cctp} chains={s.env.chains} />
            <SolanaSettingsCard saved={s.settings.solana} referralAccount={s.env.referralAccount} />
            <BchSettingsCard saved={s.settings.bch} />
          </div>
          <Section title="Setting changes" description="Who changed what, newest first."><SwapEventList events={s.history} empty="No setting has been changed yet" showSection={false} /></Section>
        </>
      )}</QueryState>
      <QueryState q={sys} rows={4}>{i => (
        <Section title="Server" icon={<Server className="w-4 h-4 text-emerald-300" aria-hidden />} description="Read-only: set in the server's env.">
          <div className="grid gap-6 md:grid-cols-3">
            <KeyValue rows={[['Uptime', `${Math.floor(i.uptimeSec / 3600)}h ${Math.floor((i.uptimeSec % 3600) / 60)}m`], ['Memory', `${i.memoryMb} MB`], ['Node', i.node], ['Port', i.port], ['Secrets loaded', i.secrets.join(', ') || 'none']]} />
            <KeyValue rows={[['CCTP network', i.cctp.network], ['Attestation API', i.cctp.irisBaseUrl.replace(/^https?:\/\//, '')], ['Poll interval', `${i.cctp.worker.pollIntervalMs} ms`], ['Burn expiry', `${i.cctp.limits.createdTtlMin} min`], ['Stuck after', `${i.cctp.watchdog.stuckMin} min`]]} />
            <KeyValue rows={[['Jupiter', i.solana.jupiter.baseUrl.replace(/^https?:\/\//, '')], ['API key', i.solana.jupiter.apiKey ? 'set' : 'not set'], ['Rate', `${i.solana.jupiter.rps} req/s`], ['Order expiry', `${i.solana.orderTtlSec} s`], ['Mainnet RPC', i.solana.rpcHost]]} />
          </div>
        </Section>
      )}</QueryState>
    </>
  );
}
