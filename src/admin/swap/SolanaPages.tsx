/**
 * Solana swaps (Jupiter): the swap list, one swap with its timeline, and the token page with the catalog,
 * tokenized stocks and the blocklist.
 */
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Coins, RefreshCw, ShieldBan, ShieldCheck, BadgeCheck, TriangleAlert, LineChart } from 'lucide-react';
import {
  ActionButton, ConfirmAction, DataTable, EmptyBlock, Hash, KeyValue, KpiTile, PageHeader, Pager, Pill, QueryState, SearchBox, Section, Segmented, SplitBar, TimeAgo, useUrlState,
  type Column,
} from '../kit';
import { Timeline } from '../EventFeed';
import { useBlockedTokens, useSolanaSwap, useSolanaSwaps, useSwapAction, useSwapAdmin, useSwapOverview, useTokenBrowser } from './SwapAdminContext';
import { PauseControl } from './SwapOverviewPages';
import { AlertList, HourlyBars, SwapEventList, SwapStatusBadge, SwitchRow, pct, secs, swapUrl, trimAmount, usd } from './swapKit';
import type { SolanaSwap, TokenView } from './swapApi';

const sym = (s: string | undefined, mint: string) => s ?? `${mint.slice(0, 4)}…`;
const solscanAccount = (a: string) => `https://solscan.io/account/${a}`;
const solscanToken = (m: string) => `https://solscan.io/token/${m}`;
const ROUTER_COLOR: Record<string, string> = { metis: '#34d399', jupiterz: '#38bdf8', dflow: '#a78bfa', okx: '#fbbf24' };

function Pair({ s }: { s: Pick<SolanaSwap, 'inSymbol' | 'outSymbol' | 'inputMint' | 'outputMint'> }) {
  return <span className="text-xs text-zinc-100 whitespace-nowrap">{sym(s.inSymbol, s.inputMint)} <span className="text-zinc-500">→</span> {sym(s.outSymbol, s.outputMint)}</span>;
}

export function SolanaSwapsPage() {
  const [f, setF] = useUrlState({ status: '', stocks: '', q: '', offset: '0' });
  const limit = 50;
  const q = useSolanaSwaps({ status: f.status, stocks: f.stocks, q: f.q, limit, offset: f.offset });
  const o = useSwapOverview();
  const nav = useNavigate();
  const stats = o.data?.solana.stats;
  const jup = o.data?.solana.jupiter;
  const by = q.data?.byStatus ?? {};

  const columns: Column<SolanaSwap>[] = [
    { key: 'when', header: 'Created', cell: s => <TimeAgo at={s.createdAt} unit="ms" /> },
    { key: 'pair', header: 'Pair', cell: s => <Pair s={s} /> },
    { key: 'in', header: 'Sold', align: 'right', cell: s => <span className="font-mono text-xs tabular-nums text-zinc-100">{s.display.inAmount ? trimAmount(s.display.inAmount) : s.inAmount}</span> },
    { key: 'out', header: 'Received', align: 'right', cell: s => (
      <span className="font-mono text-xs tabular-nums" title={s.outAmount ? 'Delivered' : 'Quoted'}>
        {s.display.outAmount ? <span className="text-emerald-300">{trimAmount(s.display.outAmount)}</span> : <span className="text-zinc-500">~{s.display.quotedOutAmount ? trimAmount(s.display.quotedOutAmount) : s.quotedOutAmount}</span>}
      </span>
    ) },
    { key: 'usd', header: 'Value', align: 'right', hideBelow: 'md', cell: s => <span className="font-mono text-xs tabular-nums text-zinc-400">{usd(s.inUsdValue)}</span> },
    { key: 'status', header: 'Status', cell: s => <SwapStatusBadge status={s.status} /> },
    { key: 'router', header: 'Router', hideBelow: 'md', cell: s => <span className="text-xs text-zinc-400">{s.router}{s.gasless ? ' · gasless' : ''}</span> },
    { key: 'took', header: 'Landed in', align: 'right', hideBelow: 'lg', cell: s => <span className="font-mono text-xs tabular-nums text-zinc-400">{s.completedAt && s.submittedAt ? secs((s.completedAt - s.submittedAt) / 1000) : '—'}</span> },
    { key: 'taker', header: 'Wallet', hideBelow: 'lg', cell: s => <Hash value={s.taker} head={5} tail={4} href={solscanAccount(s.taker)} copy={false} /> },
    { key: 'tx', header: 'Tx', hideBelow: 'xl', cell: s => <Hash value={s.signature} head={6} tail={4} href={s.links.tx} copy={false} /> },
  ];

  return (
    <>
      <PageHeader title="Solana swaps" icon={<Coins className="w-5 h-5 text-emerald-300" aria-hidden />} crumbs={[{ label: 'Swap server', to: swapUrl.home }, { label: 'Solana swaps' }]}
        description="Token-to-token swaps on Solana mainnet through Jupiter. The user signs; Jupiter lands the transaction; this server records the swap and holds no key."
        actions={o.data && <PauseControl section="solana" paused={o.data.solana.settings.paused} />} />
      {o.data && <AlertList alerts={o.data.alerts} section="solana" />}
      {stats && jup && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5">
          <KpiTile label="Swaps, 24h" value={stats.last24h.created} sub={`${stats.total} all time`} />
          <KpiTile label="Volume, 24h" value={usd(stats.last24h.volumeUsd)} sub={`${usd(stats.volumeUsd)} all time`} />
          <KpiTile label="Success rate" value={pct(stats.successRate)} sub={`${stats.completed} completed · ${stats.failed} failed`} tone={stats.successRate !== null && stats.successRate < 0.9 ? 'amber' : undefined} />
          <KpiTile label="Median to land" value={secs(stats.medianLandSec)} sub={`${stats.gasless} gasless`} />
          <KpiTile label="Jupiter API" value={`${jup.requests - jup.errors}/${jup.requests}`} tone={jup.rateLimited ? 'amber' : undefined}
            sub={`${jup.apiKey ? 'key set' : 'no key'} · ${jup.rps} req/s · ${jup.rateLimited} rate-limited`} />
        </div>
      )}
      {stats && (
        <div className="grid gap-5 lg:grid-cols-3">
          <Section title="Last 24 hours"><HourlyBars hourly={stats.hourly} /></Section>
          <Section title="Top pairs">
            {stats.byPair.length === 0 ? <EmptyBlock title="No swaps yet" /> : (
              <DataTable rowKey={p => p.pair} rows={stats.byPair.slice(0, 6)} columns={[
                { key: 'p', header: 'Pair', cell: p => <Pair s={p} /> },
                { key: 'n', header: 'Done / all', align: 'right', cell: p => <span className="font-mono text-xs tabular-nums">{p.completed}/{p.count}</span> },
                { key: 'v', header: 'Volume', align: 'right', cell: p => <span className="font-mono text-xs tabular-nums">{usd(p.volumeUsd)}</span> },
              ]} />
            )}
          </Section>
          <Section title="Routers and failures">
            <SplitBar parts={Object.entries(stats.byRouter).map(([label, value]) => ({ label, value, color: ROUTER_COLOR[label] ?? '#71717a' }))} />
            {stats.failReasons.length > 0 && (
              <ul className="mt-4 space-y-1.5">
                {stats.failReasons.slice(0, 5).map(r => (
                  <li key={r.reason} className="flex items-start justify-between gap-3 text-[11px]">
                    <span className="text-zinc-400 break-words min-w-0">{r.reason}</span><span className="font-mono tabular-nums text-rose-300 shrink-0">{r.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      )}
      <Section actions={<>
        <Segmented label="Status" value={f.status} onChange={v => setF({ status: v })} options={[
          { value: '', label: 'All' }, { value: 'active', label: 'Open' }, { value: 'COMPLETED', label: 'Completed', count: by.COMPLETED },
          { value: 'FAILED', label: 'Failed', count: by.FAILED }, { value: 'EXPIRED', label: 'Expired', count: by.EXPIRED },
        ]} />
        <Segmented label="Tokens" value={f.stocks} onChange={v => setF({ stocks: v })} options={[{ value: '', label: 'All tokens' }, { value: '1', label: 'Stocks only' }]} />
        <SearchBox value={f.q} onChange={v => setF({ q: v })} placeholder="Wallet, symbol, mint or signature" className="w-56" />
      </>}>
        <QueryState q={q}>{d => (
          <>
            <DataTable columns={columns} rows={d.swaps} rowKey={s => s.id} onRowClick={s => nav(swapUrl.swap(s.id))}
              empty={<EmptyBlock title="No swaps match">Change the filters, or run a swap through the API.</EmptyBlock>} />
            <Pager offset={d.offset} limit={limit} total={d.total} onChange={o2 => setF({ offset: String(o2) })} />
          </>
        )}</QueryState>
      </Section>
    </>
  );
}

// ── one swap ─────────────────────────────────────────────────────────────────

function TokenCard({ label, t, mint }: { label: string; t: TokenView | null; mint: string }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.015] p-3.5">
      <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="mt-1.5 flex items-center gap-2">
        {t?.icon && <img src={t.icon} alt="" className="w-6 h-6 rounded-full bg-white/5" loading="lazy" />}
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white truncate">{t?.symbol ?? 'Unknown token'}</div>
          <div className="text-[11px] text-zinc-500 truncate">{t?.name ?? 'Not on the verified list'}</div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {t ? <Pill tone="emerald">verified</Pill> : <Pill tone="amber">unverified</Pill>}
        {t?.isStock && <Pill tone="violet">stock · {t.stockIssuer}</Pill>}
        {t?.suspicious && <Pill tone="rose">suspicious</Pill>}
      </div>
      <div className="mt-2"><Hash value={mint} href={solscanToken(mint)} head={8} tail={6} /></div>
    </div>
  );
}

export function SolanaSwapDetailPage() {
  const { id = '' } = useParams();
  const q = useSolanaSwap(id);
  const { api } = useSwapAdmin();
  const recheck = useSwapAction(() => api.recheckSwap(id), { label: 'Recheck', success: r => `Swap is ${r.status}` });
  return (
    <QueryState q={q} rows={8}>{({ swap: s, tokens, events }) => (
      <>
        <PageHeader title={<><span>{sym(s.inSymbol, s.inputMint)} → {sym(s.outSymbol, s.outputMint)}</span><SwapStatusBadge status={s.status} /></>}
          crumbs={[{ label: 'Swap server', to: swapUrl.home }, { label: 'Solana swaps', to: swapUrl.swaps }, { label: s.id.slice(0, 8) }]}
          description={s.failReason ? `Failed: ${s.failReason}${s.jupiterCode !== undefined ? ` (Jupiter code ${s.jupiterCode})` : ''}` : undefined}
          actions={!s.terminal && <ActionButton icon={<RefreshCw className="w-3.5 h-3.5" />} onClick={() => recheck.run(undefined)} pending={recheck.isPending} title="Look the transaction up on chain and settle the swap now">Recheck on chain</ActionButton>} />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          <KpiTile label="Sold" value={`${s.display.inAmount ? trimAmount(s.display.inAmount, 8) : s.inAmount} ${s.display.inSymbol ?? ''}`} sub={usd(s.inUsdValue)} />
          <KpiTile label={s.outAmount ? 'Received' : 'Quoted'} tone={s.outAmount ? 'emerald' : undefined}
            value={`${s.display.outAmount ? trimAmount(s.display.outAmount, 8) : s.display.quotedOutAmount ? trimAmount(s.display.quotedOutAmount, 8) : s.quotedOutAmount} ${s.display.outSymbol ?? ''}`}
            sub={`minimum ${s.display.minOutAmount ? trimAmount(s.display.minOutAmount, 8) : s.minOutAmount}`} />
          <KpiTile label="Fee and slippage" value={`${s.feeBps} bps`} sub={`slippage ${s.slippageBps} bps`} />
          <KpiTile label="Landed in" value={s.completedAt && s.submittedAt ? secs((s.completedAt - s.submittedAt) / 1000) : '—'} sub={`${s.router}${s.gasless ? ' · gasless' : ''}`} />
        </div>
        <div className="grid gap-5 lg:grid-cols-2 items-start">
          <Section title="Timeline">
            <Timeline items={[
              { at: Math.floor(s.createdAt / 1000), label: 'Order built, unsigned transaction returned', tone: 'zinc' },
              { at: s.submittedAt ? Math.floor(s.submittedAt / 1000) : null, label: 'Signed transaction passed to Jupiter', tone: 'sky' },
              { at: s.completedAt ? Math.floor(s.completedAt / 1000) : null, label: s.outAmount ? 'Landed, confirmed by Jupiter' : 'Landed, confirmed from the chain', tone: 'emerald' },
              ...(s.status === 'FAILED' || s.status === 'EXPIRED' ? [{ at: Math.floor(s.updatedAt / 1000), label: s.status === 'EXPIRED' ? 'Expired unsigned' : 'Failed', detail: s.failReason, tone: 'rose' as const }] : []),
            ]} />
          </Section>
          <Section title="Details">
            <KeyValue rows={[
              ['Swap id', <Hash key="id" value={s.id} head={36} tail={0} />],
              ['Wallet', <Hash key="t" value={s.taker} href={solscanAccount(s.taker)} head={10} tail={8} />],
              s.receiver ? ['Receiver', <Hash key="r" value={s.receiver} href={solscanAccount(s.receiver)} head={10} tail={8} />] : null,
              ['Transaction', <Hash key="sig" value={s.signature} href={s.links.tx} head={10} tail={8} />],
              ['Jupiter request', <Hash key="req" value={s.requestId} head={36} tail={0} />],
              s.feeMint ? ['Fee taken in', <Hash key="fm" value={s.feeMint} href={solscanToken(s.feeMint)} head={8} tail={6} />] : null,
              s.inAmountSpent ? ['Total spent', `${s.inAmountSpent} base units`] : null,
            ]} />
          </Section>
        </div>
        <div className="grid gap-2.5 sm:grid-cols-2">
          <TokenCard label="Sold" t={tokens.input} mint={s.inputMint} />
          <TokenCard label="Bought" t={tokens.output} mint={s.outputMint} />
        </div>
        <Section title="Events for this swap"><SwapEventList events={events} showSection={false} /></Section>
      </>
    )}</QueryState>
  );
}

// ── tokens, stocks, blocklist ────────────────────────────────────────────────

export function SolanaTokensPage() {
  const [f, setF] = useUrlState({ view: 'tokens', issuer: '', q: '', offset: '0' });
  const limit = 50;
  const mode = f.view === 'stocks' ? 'stocks' : 'tokens';
  const o = useSwapOverview();
  const settings = o.data?.solana.settings;
  const stocksOff = settings ? !settings.stocksEnabled : false;
  const list = useTokenBrowser(mode, mode === 'stocks' ? { issuer: f.issuer, q: f.q, limit, offset: f.offset } : { q: f.q, sort: 'liquidity', limit, offset: f.offset });
  const blocked = useBlockedTokens();
  const { api } = useSwapAdmin();
  const [mint, setMint] = useState('');
  const block = useSwapAction((a: { mint: string; blocked: boolean }) => api.blockToken(a.mint, a.blocked), { label: 'Blocklist', success: (_, a) => (a.blocked ? 'Token blocked' : 'Token unblocked') });
  const refresh = useSwapAction(() => api.refreshTokens(), { label: 'Refresh', success: r => `Token list refreshed: ${r.tokens.toLocaleString()} tokens` });
  const setFlag = useSwapAction((p: { stocksEnabled?: boolean; allowUnverified?: boolean }) => api.setSettings({ solana: p }), { label: 'Setting', success: r => `Saved: ${r.changed.join(', ') || 'nothing changed'}` });
  const blockedSet = new Set(settings?.blockedMints ?? []);
  const cat = o.data?.solana.catalog;

  const columns: Column<TokenView>[] = [
    { key: 'token', header: 'Token', cell: t => (
      <div className="flex items-center gap-2 min-w-0">
        {t.icon ? <img src={t.icon} alt="" className="w-5 h-5 rounded-full bg-white/5 shrink-0" loading="lazy" /> : <span className="w-5 h-5 rounded-full bg-white/5 shrink-0" />}
        <div className="min-w-0"><div className="text-xs font-medium text-zinc-100 truncate">{t.symbol}</div><div className="text-[10px] text-zinc-600 truncate max-w-[180px]">{t.name}</div></div>
      </div>
    ) },
    { key: 'kind', header: 'Kind', hideBelow: 'md', cell: t => <span className="inline-flex gap-1">{t.isStock ? <Pill tone="violet">{t.stockIssuer}</Pill> : t.tags.includes('stable') ? <Pill tone="sky">stable</Pill> : t.tags.includes('lst') ? <Pill tone="cyan">lst</Pill> : null}{t.suspicious && <Pill tone="rose">suspicious</Pill>}</span> },
    { key: 'price', header: 'Price', align: 'right', cell: t => <span className="font-mono text-xs tabular-nums text-zinc-100">{t.usdPrice === undefined ? '—' : t.usdPrice < 0.01 ? `$${t.usdPrice.toPrecision(3)}` : usd(t.usdPrice)}</span> },
    { key: 'chg', header: '24h', align: 'right', hideBelow: 'md', cell: t => <span className={t.priceChange24h === undefined ? 'text-xs text-zinc-600' : t.priceChange24h >= 0 ? 'font-mono text-xs tabular-nums text-emerald-300' : 'font-mono text-xs tabular-nums text-rose-300'}>{t.priceChange24h === undefined ? '—' : `${t.priceChange24h >= 0 ? '+' : ''}${t.priceChange24h.toFixed(2)}%`}</span> },
    { key: 'liq', header: 'Liquidity', align: 'right', cell: t => <span className={(t.liquidity ?? 0) < 100_000 ? 'font-mono text-xs tabular-nums text-amber-300' : 'font-mono text-xs tabular-nums text-zinc-300'}>{usd(t.liquidity, true)}</span> },
    { key: 'vol', header: 'Volume 24h', align: 'right', hideBelow: 'lg', cell: t => <span className="font-mono text-xs tabular-nums text-zinc-400">{usd(t.volume24h, true)}</span> },
    { key: 'mint', header: 'Mint', hideBelow: 'lg', cell: t => <Hash value={t.mint} href={solscanToken(t.mint)} head={5} tail={4} /> },
    { key: 'act', header: '', align: 'right', cell: t => (
      <ActionButton tone={blockedSet.has(t.mint) ? 'primary' : 'default'} pending={block.isPending && block.variables?.mint === t.mint} onClick={() => block.run({ mint: t.mint, blocked: !blockedSet.has(t.mint) })}>
        {blockedSet.has(t.mint) ? 'Unblock' : 'Block'}
      </ActionButton>
    ) },
  ];

  return (
    <>
      <PageHeader title="Tokens and stocks" icon={<LineChart className="w-5 h-5 text-emerald-300" aria-hidden />} crumbs={[{ label: 'Swap server', to: swapUrl.home }, { label: 'Solana swaps', to: swapUrl.swaps }, { label: 'Tokens' }]}
        description="What users can swap. The default list is Jupiter's verified tokens; anything else is reachable by search and marked unverified. Tokenized stocks are verified tokens with an issuer."
        actions={<ActionButton icon={<RefreshCw className="w-3.5 h-3.5" />} onClick={() => refresh.run(undefined)} pending={refresh.isPending}>Refresh token list</ActionButton>} />
      {cat && settings && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          <KpiTile label="Verified tokens" value={cat.tokens.toLocaleString()} sub={cat.ageSec !== undefined ? `list refreshed ${Math.round(cat.ageSec / 60)} min ago` : 'not loaded'} icon={<BadgeCheck className="w-4 h-4" />} tone={cat.ready ? undefined : 'rose'} />
          <KpiTile label="Stock tokens" value={cat.stocks.toLocaleString()} sub={Object.entries(cat.issuers).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} ${v}`).join(' · ')} tone={settings.stocksEnabled ? undefined : 'amber'} />
          <KpiTile label="Blocked" value={settings.blockedMints.length} icon={<ShieldBan className="w-4 h-4" />} tone={settings.blockedMints.length ? 'amber' : undefined} sub="hidden and not swappable" />
          <KpiTile label="Unverified tokens" value={settings.allowUnverified ? 'Allowed' : 'Refused'} icon={settings.allowUnverified ? <TriangleAlert className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />} tone={settings.allowUnverified ? 'amber' : 'emerald'} sub="reached through search" />
        </div>
      )}
      {settings && (
        <div className="grid gap-5 lg:grid-cols-2 items-start">
          <Section title="What is listed">
            <div className="divide-y divide-white/[0.05]">
              <SwitchRow label="Tokenized stocks" checked={settings.stocksEnabled} disabled={setFlag.isPending} onChange={v => setFlag.run({ stocksEnabled: v })}
                description="Off: stock tokens leave every list and cannot be quoted or swapped. Issuers do not offer them to US persons; listing them is a legal decision." />
              <SwitchRow label="Unverified tokens" checked={settings.allowUnverified} disabled={setFlag.isPending} onChange={v => setFlag.run({ allowUnverified: v })}
                description="Off: only Jupiter-verified tokens can be swapped. On: any mint with liquidity can, with a warning shown to the user." />
            </div>
            <div className="pt-2 text-[11px] text-zinc-500">The stock liquidity floor and the swap size limit are on the <Link to={swapUrl.settings} className="text-zinc-300 hover:text-emerald-300">settings page</Link>.</div>
          </Section>
          <Section title="Blocked tokens" description="A blocked token is removed from every list and refused in quotes and swaps, as input or output.">
            <form onSubmit={e => { e.preventDefault(); if (mint.trim()) { block.run({ mint: mint.trim(), blocked: true }); setMint(''); } }} className="flex items-center gap-2">
              <input value={mint} onChange={e => setMint(e.target.value)} placeholder="Mint address to block" aria-label="Mint address to block"
                className="flex-1 h-8 px-2.5 rounded-lg bg-white/[0.03] border border-white/10 text-xs text-white font-mono placeholder:text-zinc-600 focus:outline-none focus:border-emerald-400/50" />
              <ConfirmAction label="Block" tone="warn" icon={<ShieldBan className="w-3.5 h-3.5" />} disabled={!mint.trim()} title="Block this token?" confirmLabel="Block"
                description="Users will no longer see it or be able to swap it here. Swaps already signed are not affected." onConfirm={() => { block.run({ mint: mint.trim(), blocked: true }); setMint(''); }} />
            </form>
            <QueryState q={blocked} rows={2}>{b => b.blockedMints.length === 0 ? <div className="pt-3 text-xs text-zinc-600">No token is blocked.</div> : (
              <ul className="mt-3 divide-y divide-white/[0.04]">
                {b.blockedMints.map(t => (
                  <li key={t.mint} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0 flex items-center gap-2"><span className="text-xs font-medium text-zinc-100">{t.symbol ?? 'Unverified token'}</span><Hash value={t.mint} href={solscanToken(t.mint)} head={6} tail={4} /></span>
                    <ActionButton onClick={() => block.run({ mint: t.mint, blocked: false })} pending={block.isPending && block.variables?.mint === t.mint}>Unblock</ActionButton>
                  </li>
                ))}
              </ul>
            )}</QueryState>
          </Section>
        </div>
      )}
      <Section title="Catalog" description="The lists the public API serves right now, after the switches and the blocklist above."
        actions={<>
          <Segmented label="List" value={mode} onChange={v => setF({ view: v, issuer: '' })} options={[{ value: 'tokens', label: 'All verified' }, { value: 'stocks', label: 'Stocks' }]} />
          {mode === 'stocks' && cat && (
            <Segmented label="Issuer" value={f.issuer} onChange={v => setF({ issuer: v })} options={[{ value: '', label: 'Any issuer' }, ...Object.entries(cat.issuers).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ value: k, label: k, count: v }))]} />
          )}
          <SearchBox value={f.q} onChange={v => setF({ q: v })} placeholder="Symbol, name or mint" className="w-48" />
        </>}>
        {mode === 'stocks' && stocksOff
          ? <EmptyBlock title="Tokenized stocks are switched off">Turn them on above to list them again.</EmptyBlock>
          : <QueryState q={list}>{d => (
            <>
              <DataTable columns={columns} rows={d.tokens} rowKey={t => t.mint} empty={<EmptyBlock title="No token matches" />} />
              <Pager offset={d.offset} limit={limit} total={d.total} onChange={o2 => setF({ offset: String(o2) })} />
            </>
          )}</QueryState>}
      </Section>
    </>
  );
}
