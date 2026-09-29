import { cn } from '@/lib/utils';
import { Figure, Tag, TONE, type Tone } from './primitives';

interface Row {
    index: string;
    tone: Tone;
    input: { title: string; lines: string[] };
    bind: string;
    output: { title: string; lines: string[] };
}

const ROWS: Row[] = [
    {
        index: '0',
        tone: 'emerald',
        input: { title: 'Intent covenant', lines: ['LimitOrderSwapV2 / DutchAuctionSwapV2', 'spends fill()'] },
        bind: 'outputs[activeInputIndex]',
        output: { title: 'Maker payout', lines: ['P2PKH(makerPkh)', '≥ covenant minimum at tx.locktime'] },
    },
    {
        index: '1…k',
        tone: 'blue',
        input: { title: 'Liquidity source', lines: ['Mesh pool → fill()', 'Cauldron pool(s) → no signature', 'Solver inventory → no source input'] },
        bind: 'recreated at same index',
        output: { title: 'Pools recreated', lines: ['Mesh: +amountIn, −gross out', 'Cauldron: K′ ≥ K'] },
    },
    {
        index: 'k+1…',
        tone: 'violet',
        input: { title: 'Solver P2PKH', lines: ['miner fee', '+ buy asset for inventory fills'] },
        bind: 'free-form tail',
        output: { title: 'Settlement tail', lines: ['treasury share · frontend share', 'leftover → maker', 'solver token + BCH change'] },
    },
];

function Cell({ tone, title, lines, side, index }: { tone: Tone; title: string; lines: string[]; side: 'IN' | 'OUT'; index: string }) {
    const t = TONE[tone];
    return (
        <div className={cn('rounded-lg border px-3.5 py-3', t.border, t.bg)}>
            <div className="flex items-center gap-2">
                <span className={cn('font-mono text-[10.5px] font-semibold', t.text)}>{side} [{index}]</span>
                <span className="text-[13px] font-semibold text-zinc-100">{title}</span>
            </div>
            <ul className="mt-1.5 space-y-0.5">
                {lines.map(l => <li key={l} className="font-mono text-[11.5px] leading-5 text-zinc-400">{l}</li>)}
            </ul>
        </div>
    );
}

export function FillTransaction() {
    return (
        <Figure
            title="Anatomy of an atomic fill"
            caption="Each covenant checks the output at its own input index, so the layout is enforced on-chain, not by convention. Two intents can never be paid by one output."
        >
            <div className="hidden grid-cols-[1fr_130px_1fr] gap-3 pb-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-zinc-500 md:grid">
                <span>Inputs</span>
                <span className="text-center">Binding</span>
                <span>Outputs</span>
            </div>
            <div className="space-y-3">
                {ROWS.map(r => (
                    <div key={r.index} className="grid gap-2 md:grid-cols-[1fr_130px_1fr] md:items-center md:gap-3">
                        <Cell tone={r.tone} side="IN" index={r.index} {...r.input} />
                        <div className="flex items-center gap-2 px-1 md:flex-col md:gap-1" aria-hidden={false}>
                            <span className={cn('hidden h-px w-full md:block', TONE[r.tone].dot, 'opacity-40')} />
                            <span className="font-mono text-[10px] leading-4 text-zinc-500 md:text-center">{r.bind}</span>
                            <span className={cn('hidden h-px w-full md:block', TONE[r.tone].dot, 'opacity-40')} />
                        </div>
                        <Cell tone={r.tone} side="OUT" index={r.index} {...r.output} />
                    </div>
                ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/[0.05] pt-4 text-[12.5px] text-zinc-400">
                <Tag tone="emerald">nLocktime = MTP − 1</Tag>
                <span>Final right now, and the exact time the intent covenant uses for expiry and Dutch decay.</span>
            </div>
        </Figure>
    );
}
