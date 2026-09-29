import { CornerDownRight, RotateCw, Undo2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Figure, FlowArrow, Node, StepBadge, Tag, TONE, type Tone } from './primitives';

// ── Intent lifecycle ─────────────────────────────────────────────────────────

interface Step { n: number; title: string; actor: string; tone: Tone; body: string; tag: string }

const INTENT_STEPS: Step[] = [
    { n: 1, title: 'Create', actor: 'App → Server', tone: 'zinc', body: 'Server anchors covenant times to chain time and returns the covenant address and exact constructor args.', tag: 'POST /intent/create' },
    { n: 2, title: 'Fund', actor: 'User wallet', tone: 'emerald', body: 'User sends the full sell amount to the covenant. The scanner binds the outpoint only if it covers the order.', tag: 'awaiting_funding → active' },
    { n: 3, title: 'Match', actor: 'Solver', tone: 'violet', body: 'Each cycle the matcher prices every route at locktime MTP − 1 and picks the first that clears the covenant minimum.', tag: 'Mesh → Cauldron → inventory' },
    { n: 4, title: 'Fill', actor: 'BCH covenant', tone: 'emerald', body: 'One atomic transaction. The covenant pays the maker at its own output index or the whole tx is rejected.', tag: 'intent:filled' },
];

export function IntentLifecycle() {
    return (
        <Figure
            title="Intent lifecycle"
            caption="The happy path is four steps. If no route clears the minimum before the deadline, the refund engine returns everything the covenant holds to the maker."
        >
            <div className="flex flex-col gap-2 md:flex-row md:items-stretch">
                {INTENT_STEPS.map((s, i) => (
                    <div key={s.n} className="contents">
                        <Node tone={s.tone} className="flex flex-1 flex-col gap-2">
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <StepBadge n={s.n} tone={s.tone === 'zinc' ? 'emerald' : s.tone} />
                                    <span className="text-[14px] font-semibold text-zinc-100">{s.title}</span>
                                </div>
                                <span className="text-[10.5px] uppercase tracking-wide text-zinc-500">{s.actor}</span>
                            </div>
                            <p className="text-[12.5px] leading-5 text-zinc-400">{s.body}</p>
                            <div className="mt-auto pt-1"><Tag tone={s.tone}>{s.tag}</Tag></div>
                        </Node>
                        {i < INTENT_STEPS.length - 1 && <FlowArrow className="md:w-5" />}
                    </div>
                ))}
            </div>
            <div className="mt-3 flex items-start gap-3 rounded-lg border border-dashed border-amber-500/30 bg-amber-500/[0.03] px-3.5 py-3 md:ml-[25%]">
                <Undo2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                <p className="text-[12.5px] leading-5 text-zinc-400">
                    <span className="font-semibold text-amber-200">No route by the deadline</span> → <Tag tone="amber">intent:unfillable</Tag> → the
                    refund engine spends <Tag tone="amber">cancel()</Tag> and the maker receives every sat and token the covenant holds.
                </p>
            </div>
        </Figure>
    );
}

// ── Tri-route engine ─────────────────────────────────────────────────────────

const ROUTES = [
    { n: 1, name: 'Mesh pool', flag: 'meshEnabled', tone: 'emerald' as Tone, rule: 'Best StrategyCovenantV2 pool whose output ≥ the minimum and within its reserve.' },
    { n: 2, name: 'Cauldron', flag: 'cauldronEnabled', tone: 'blue' as Tone, rule: 'Live Cauldron V0 pools, verified on-chain, priced with @cashlab/cauldron.' },
    { n: 3, name: 'Solver inventory', flag: 'solverEnabled', tone: 'violet' as Tone, rule: 'Solver pays at reference − SOLVER_RFQ_SPREAD_BPS, capped by SOLVER_MAX_FILL_SATS.' },
];

export function TriRoute() {
    return (
        <Figure
            title="Tri-route matching"
            caption="Routes are tried in priority order and each can be paused independently. Pausing all three stops fills; refunds keep running."
        >
            <div className="grid gap-3 md:grid-cols-[1fr_auto_1.1fr_auto_1.6fr] md:items-center">
                <Node>
                    <p className="text-[13px] font-semibold text-zinc-100">Funded intent</p>
                    <p className="mt-1 text-[12px] leading-5 text-zinc-500">Limit, Dutch or TWAP slice with a bound funding outpoint.</p>
                </Node>
                <FlowArrow />
                <Node tone="violet">
                    <p className="text-[13px] font-semibold text-zinc-100">Matcher</p>
                    <p className="mt-1 text-[12px] leading-5 text-zinc-400">
                        Computes the covenant minimum at <Tag tone="violet">locktime = MTP − 1</Tag>, then asks each route for a quote.
                    </p>
                </Node>
                <FlowArrow />
                <div className="space-y-2">
                    {ROUTES.map(r => (
                        <div key={r.n} className={cn('rounded-lg border px-3 py-2.5', TONE[r.tone].border, TONE[r.tone].bg)}>
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <StepBadge n={r.n} tone={r.tone} />
                                    <span className="text-[13px] font-semibold text-zinc-100">{r.name}</span>
                                </div>
                                <span className="flex items-center gap-1.5 font-mono text-[10.5px] text-zinc-500">
                                    <span className={cn('h-1.5 w-1.5 rounded-full', TONE[r.tone].dot)} />
                                    {r.flag}
                                </span>
                            </div>
                            <p className="mt-1 text-[12px] leading-5 text-zinc-400">{r.rule}</p>
                        </div>
                    ))}
                    <div className="flex items-center gap-2 rounded-lg border border-dashed border-white/10 px-3 py-2 text-[12px] text-zinc-500">
                        <CornerDownRight className="h-3.5 w-3.5" />
                        None clears → <Tag tone="amber">intent:unfillable</Tag> with per-route reasons
                    </div>
                </div>
            </div>
        </Figure>
    );
}

// ── Mesh pool lifecycle ──────────────────────────────────────────────────────

const POOL_STEPS: Step[] = [
    { n: 1, title: 'Configure', actor: 'LP', tone: 'zinc', body: 'Pick pair, direction, price (num/den) and fee. The SDK derives the StrategyCovenantV2 P2SH32 address.', tag: 'priceNum · priceDen · feeBps' },
    { n: 2, title: 'Fund', actor: 'LP wallet', tone: 'emerald', body: 'Build the funding tx with TransactionBuilder against the raw locking bytecode, never wallet.send().', tag: 'P2SH32 output' },
    { n: 3, title: 'Register', actor: 'Server', tone: 'blue', body: 'Server recomputes the address from params and requires the outpoint to be unspent there.', tag: 'POST /positions' },
    { n: 4, title: 'Trade', actor: 'Anyone', tone: 'violet', body: 'Each fill recreates the pool at outputs[i]; the index follows the new outpoint.', tag: 'fill() ↺' },
    { n: 5, title: 'Dock', actor: 'LP', tone: 'amber', body: 'Owner signs dock() and takes back 100% of the UTXO. The server only confirms from chain.', tag: 'dock(pk, sig)' },
];

export function PoolLifecycle() {
    return (
        <Figure title="Mesh pool lifecycle" caption="A pool is one UTXO. Trading replaces it with a new UTXO at the same covenant address; docking ends it.">
            <div className="flex flex-col gap-2 md:flex-row md:items-stretch">
                {POOL_STEPS.map((s, i) => (
                    <div key={s.n} className="contents">
                        <Node tone={s.tone} className="relative flex flex-1 flex-col gap-2">
                            <div className="flex items-center gap-2">
                                <StepBadge n={s.n} tone={s.tone === 'zinc' ? 'emerald' : s.tone} />
                                <span className="text-[13.5px] font-semibold text-zinc-100">{s.title}</span>
                                {s.n === 4 && <RotateCw className="ml-auto h-3.5 w-3.5 text-violet-300" aria-label="repeats" />}
                            </div>
                            <span className="text-[10.5px] uppercase tracking-wide text-zinc-500">{s.actor}</span>
                            <p className="text-[12px] leading-5 text-zinc-400">{s.body}</p>
                            <div className="mt-auto pt-1"><Tag tone={s.tone}>{s.tag}</Tag></div>
                        </Node>
                        {i < POOL_STEPS.length - 1 && <FlowArrow className="md:w-4" />}
                    </div>
                ))}
            </div>
        </Figure>
    );
}
