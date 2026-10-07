import { Link } from 'react-router-dom';
import { ArrowRight, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { docsHomeSeo } from '@/shared/seo';
import { useSeo } from '@/lib/useSeo';
import { useDocs, useDocsSite } from '../lib/store';
import { ProtocolStack } from '../diagrams/ProtocolStack';
import { Cards } from '../components/Cards';
import { Screenshot } from '../components/Screenshot';

const PATHS = [
    { title: 'Create your first intent', description: 'Quote, create, fund and watch a limit order fill on chipnet in five minutes.', href: 'get-started/quickstart', icon: 'rocket' },
    { title: 'Integrate swaps into your app', description: 'Use the Intents SDK or the REST API, and earn surplus with frontend fees.', href: 'sdk/intents/overview', icon: 'package' },
    { title: 'Provide liquidity with Mesh', description: 'Deploy a StrategyCovenantV2 pool, register it and dock when you are done.', href: 'mesh/pools/strategy-pools', icon: 'network' },
    { title: 'Run a solver', description: 'Match intents against Mesh, Cauldron and your own inventory for surplus.', href: 'solvers/overview', icon: 'bot' },
];

type Status = 'live' | 'beta' | 'testnet' | 'planned' | 'research';

const STATUS: { area: string; detail: string; status: Status; label: string; href: string }[] = [
    { area: 'Same-chain CashToken swaps', detail: 'Limit & Dutch intents via the relayer', status: 'live', label: 'Mainnet validated', href: 'intents/overview' },
    { area: 'V2 intent covenants + Mesh pools', detail: 'Tri-route fills, surplus modes, auto-refunds', status: 'beta', label: 'Chipnet beta', href: 'mesh/overview' },
    { area: 'TWAP orders', detail: 'N Dutch slices funded in one tx', status: 'beta', label: 'Chipnet beta', href: 'intents/order-types/twap' },
    { area: 'SOL ↔ BCH, BSC ↔ BCH', detail: 'ZK-STARK (FRI) settlement', status: 'testnet', label: 'Testnet only', href: 'intents/cross-chain/zk-stark' },
    { area: 'Intents SDK', detail: '@bch-intents/sdk v0.2 on npm', status: 'live', label: 'Published', href: 'sdk/intents/overview' },
    { area: 'Mesh SDK · Solver SDK', detail: 'Typed clients for LPs and solvers', status: 'planned', label: 'Planned', href: 'sdk/mesh/overview' },
    { area: 'Monero adaptor swaps', detail: 'BCH ↔ XMR without a bridge', status: 'research', label: 'Research', href: 'intents/cross-chain/xmr' },
];

const STATUS_STYLE: Record<Status, string> = {
    live: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    beta: 'border-violet-500/30 bg-violet-500/10 text-violet-300',
    testnet: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    planned: 'border-white/10 bg-white/[0.03] text-zinc-400',
    research: 'border-white/10 bg-white/[0.03] text-zinc-500',
};

const SHOTS = [
    { src: '/docs/screenshots/trade-swap.png', url: '/trade', caption: 'Trade: swap, limit and TWAP intents' },
    { src: '/docs/screenshots/mesh-pools.png', url: '/mesh', caption: 'Mesh: strategy pools and LP positions' },
    { src: '/docs/screenshots/orderbook.png', url: '/orderbook', caption: 'Orderbook: live Mesh depth' },
];

export function DocsHome({ onSearch }: { onSearch: () => void }) {
    const { nav, firstPageOf, sectionStats } = useDocs();
    useSeo(docsHomeSeo(useDocsSite()));

    return (
        <div className="pb-24">
            {/* Hero */}
            <section className="relative overflow-hidden border-b border-white/[0.05]">
                <div className="pointer-events-none absolute left-1/2 top-[-240px] h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-emerald-500/[0.09] blur-[120px]" aria-hidden />
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.04)_1px,transparent_0)] [background-size:24px_24px] [mask-image:linear-gradient(to_bottom,black,transparent)]" aria-hidden />
                <div className="relative mx-auto max-w-[1180px] px-4 pb-16 pt-16 lg:px-6 lg:pt-24">
                    <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/[0.06] px-3 py-1 text-[12px] font-medium text-emerald-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Developer documentation
                    </span>
                    <h1 className="mt-6 max-w-3xl text-[40px] font-semibold leading-[1.08] tracking-tight text-white sm:text-[56px]">
                        Build on <span className="text-emerald-400">BCH Intents</span>
                    </h1>
                    <p className="mt-5 max-w-2xl text-[17px] leading-8 text-zinc-400">
                        Intent-based swaps settled by Bitcoin Cash covenants, filled by solvers from Mesh pools, Cauldron and inventory.
                        Everything from signing an intent to running liquidity and solvers.
                    </p>
                    <div className="mt-8 flex flex-wrap items-center gap-3">
                        <Link to="/docs/get-started/quickstart" className="flex h-11 items-center gap-2 rounded-xl bg-emerald-500 px-5 text-[14px] font-semibold text-black shadow-[0_0_28px_-8px_rgba(16,185,129,0.9)] transition-colors hover:bg-emerald-400">
                            Quickstart <ArrowRight className="h-4 w-4" />
                        </Link>
                        <button type="button" onClick={onSearch} className="flex h-11 w-full items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 text-[14px] text-zinc-500 transition-colors hover:border-white/15 hover:text-zinc-300 sm:w-80">
                            <Search className="h-4 w-4" /> <span className="flex-1 text-left">Search the docs</span>
                            <kbd className="rounded border border-white/10 px-1.5 font-mono text-[10px]">⌘K</kbd>
                        </button>
                    </div>
                </div>
            </section>

            <div className="mx-auto max-w-[1180px] px-4 lg:px-6">
                {/* Sections */}
                <section className="pt-14">
                    <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Explore the protocol</h2>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {nav.map(s => {
                            const st = sectionStats(s.id);
                            return (
                                <Link key={s.id} to={`/docs/${firstPageOf(s).slug}`} className="group flex flex-col rounded-xl border border-white/[0.06] bg-white/[0.015] p-5 transition-all hover:border-emerald-500/25 hover:bg-emerald-500/[0.03]">
                                    <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03] text-zinc-400 transition-colors group-hover:border-emerald-500/30 group-hover:text-emerald-400">
                                        <s.icon className="h-[18px] w-[18px]" />
                                    </span>
                                    <p className="mt-4 flex items-center gap-2 text-[16px] font-semibold text-white">
                                        {s.title}
                                        <ArrowRight className="h-3.5 w-3.5 -translate-x-1 text-emerald-400 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                                    </p>
                                    <p className="mt-1.5 flex-1 text-[13.5px] leading-6 text-zinc-500">{s.tagline}</p>
                                    <div className="mt-4 flex items-center gap-2" title={`${st.ready} ready · ${st.draft} draft · ${st.planned} planned`}>
                                        <div className="flex h-1 flex-1 gap-[2px] overflow-hidden rounded-full">
                                            <span className="bg-emerald-400/80" style={{ flexGrow: st.ready }} />
                                            <span className="bg-amber-400/60" style={{ flexGrow: st.draft }} />
                                            <span className="bg-zinc-700" style={{ flexGrow: st.planned }} />
                                        </div>
                                        <span className="font-mono text-[11px] text-zinc-500">{st.ready}/{st.total}</span>
                                    </div>
                                </Link>
                            );
                        })}
                        <div className="flex flex-col justify-center rounded-xl border border-dashed border-white/[0.07] p-5 text-[12.5px] leading-6 text-zinc-500">
                            <p className="font-medium text-zinc-400">Coverage</p>
                            <p className="mt-2 flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-400/80" /> Ready</p>
                            <p className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-amber-400/60" /> Draft</p>
                            <p className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-zinc-700" /> Planned</p>
                        </div>
                    </div>
                </section>

                {/* Paths */}
                <section className="pt-14">
                    <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Start building</h2>
                    <Cards items={PATHS} cols={2} />
                </section>

                {/* Architecture */}
                <section className="grid gap-10 pt-10 lg:grid-cols-[1fr_1.35fr] lg:items-center">
                    <div>
                        <h2 className="text-[28px] font-semibold tracking-tight text-white">One settlement layer, many ways in</h2>
                        <p className="mt-4 text-[15.5px] leading-7 text-zinc-400">
                            Apps, wallets and agents create intents through the SDK or the Mesh Server API. Solvers source liquidity
                            from Mesh pools, Cauldron or their own inventory. Covenants on Bitcoin Cash decide whether a fill is valid,
                            so nothing above the trust boundary can move user funds.
                        </p>
                        <Link to="/docs/get-started/architecture" className="mt-6 inline-flex items-center gap-1.5 text-[14px] font-medium text-emerald-400 hover:text-emerald-300">
                            Read the architecture <ArrowRight className="h-4 w-4" />
                        </Link>
                    </div>
                    <ProtocolStack />
                </section>

                {/* Status */}
                <section className="pt-14">
                    <div className="flex items-end justify-between gap-4">
                        <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-zinc-500">What's live</h2>
                        <Link to="/docs/get-started/status" className="text-[13px] text-zinc-500 hover:text-zinc-300">Status & roadmap →</Link>
                    </div>
                    <div className="mt-5 overflow-hidden rounded-xl border border-white/[0.06]">
                        {STATUS.map((r, i) => (
                            <Link key={r.area} to={`/docs/${r.href}`} className={cn('flex flex-wrap items-center gap-3 px-5 py-3.5 transition-colors hover:bg-white/[0.02]', i > 0 && 'border-t border-white/[0.04]')}>
                                <span className="min-w-[220px] flex-1 text-[14px] font-medium text-zinc-200">{r.area}</span>
                                <span className="hidden flex-1 text-[13px] text-zinc-500 md:block">{r.detail}</span>
                                <span className={cn('rounded-full border px-2.5 py-0.5 text-[11px] font-semibold', STATUS_STYLE[r.status])}>{r.label}</span>
                            </Link>
                        ))}
                    </div>
                </section>

                {/* Screens */}
                <section className="pt-14">
                    <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-zinc-500">See it in the app</h2>
                    <div className="grid gap-x-6 md:grid-cols-3">
                        {SHOTS.map(s => <Screenshot key={s.src} {...s} />)}
                    </div>
                </section>
            </div>
        </div>
    );
}
