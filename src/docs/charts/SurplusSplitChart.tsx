import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChartFrame, LegendItem, RangeControl, SERIES } from './ChartFrame';

// Mirrors the matcher's surplus split (MeshDocs/BetaLaunch/03 §3.5):
//   surplus  = gross − covenant minimum
//   protocol = ½ surplus (treasury output, or kept by the solver if no treasury)
//   partner  = the other ½, split by userSurplusShareBps: user ← bps, frontend ← rest
//   a frontend share below dust (546 sats) rolls into the maker payout
//   (the protocol half is only dust-checked when a treasury output is configured)

const DUST = 546;

const PARTS = [
    { key: 'minimum', label: 'Maker minimum', color: SERIES[0] },
    { key: 'user', label: 'User surplus', color: SERIES[1] },
    { key: 'frontend', label: 'Frontend share', color: SERIES[2] },
    { key: 'protocol', label: 'Protocol share', color: SERIES[3] },
] as const;

type PartKey = (typeof PARTS)[number]['key'];

const MODES = [
    { name: 'A', bps: 10_000, hint: 'all to user' },
    { name: 'B', bps: 0, hint: 'all to frontend' },
    { name: 'C', bps: 5_000, hint: 'split' },
];

function split(minimum: number, gross: number, bps: number, hasFrontend: boolean) {
    const surplus = Math.max(0, gross - minimum);
    const protocol = Math.floor(surplus / 2);
    const partner = surplus - protocol;
    let user = Math.floor((partner * bps) / 10_000);
    let frontend = partner - user;
    if (!hasFrontend) { user += frontend; frontend = 0; }
    if (frontend > 0 && frontend < DUST) { user += frontend; frontend = 0; }
    return { surplus, parts: { minimum, user, frontend, protocol } as Record<PartKey, number> };
}

function Bar({ parts, keys, total }: { parts: Record<PartKey, number>; keys: PartKey[]; total: number }) {
    return (
        <div className="flex h-6 w-full gap-[2px]">
            {keys.map(k => {
                const v = parts[k];
                if (v <= 0 || total <= 0) return null;
                const p = PARTS.find(x => x.key === k)!;
                return (
                    <div
                        key={k}
                        title={`${p.label}: ${v.toLocaleString()} sats`}
                        className="h-full min-w-[3px] last:rounded-r-[4px] transition-[flex-grow] duration-300"
                        style={{ flexGrow: v, flexBasis: 0, background: p.color }}
                    />
                );
            })}
        </div>
    );
}

export function SurplusSplitChart() {
    // Defaults reproduce live chipnet fill F1: minimum 17,000, route 19,940, Mode A → maker 18,470.
    const [minimum, setMinimum] = useState(17_000);
    const [gross, setGross] = useState(19_940);
    const [bps, setBps] = useState(10_000);
    const [hasFrontend, setHasFrontend] = useState(true);

    const g = Math.max(gross, minimum);
    const { surplus, parts } = useMemo(() => split(minimum, g, bps, hasFrontend), [minimum, g, bps, hasFrontend]);
    const makerTotal = parts.minimum + parts.user;

    return (
        <ChartFrame
            title="Where the surplus goes"
            subtitle="A fill that beats the covenant minimum creates surplus. Half goes to the protocol; the partner half is split between the user and the integrating frontend."
            controls={
                <>
                    <RangeControl label="Covenant minimum" value={minimum} min={10_000} max={20_000} step={100} onChange={setMinimum} format={v => `${v.toLocaleString()} sats`} />
                    <RangeControl label="Gross route output" value={g} min={10_000} max={24_000} step={100} onChange={setGross} format={v => `${v.toLocaleString()} sats`} />
                    <RangeControl label="userSurplusShareBps" value={bps} min={0} max={10_000} step={250} onChange={setBps} />
                    <div className="flex items-center gap-1.5">
                        {MODES.map(m => (
                            <button
                                key={m.name}
                                type="button"
                                onClick={() => setBps(m.bps)}
                                title={`Mode ${m.name}: ${m.hint}`}
                                className={cn(
                                    'h-7 rounded-md border px-2.5 font-mono text-[11px] transition-colors',
                                    bps === m.bps ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200' : 'border-white/10 text-zinc-400 hover:text-zinc-200',
                                )}
                            >
                                Mode {m.name}
                            </button>
                        ))}
                        <label className="ml-2 flex cursor-pointer items-center gap-1.5 text-[11.5px] text-zinc-400">
                            <input type="checkbox" checked={hasFrontend} onChange={e => setHasFrontend(e.target.checked)} className="accent-emerald-500" />
                            frontendPkh set
                        </label>
                    </div>
                </>
            }
            footnote={<>A frontend share below dust (546 sats for BCH) rolls into the maker payout. Without a <code className="font-mono text-zinc-400">frontendPkh</code> the frontend share also goes to the user. If no treasury is configured the solver keeps the protocol half.</>}
        >
            <div className="space-y-5 px-1 pb-2">
                <div>
                    <div className="mb-2 flex items-baseline justify-between text-[12px]">
                        <span className="text-zinc-400">Gross route output</span>
                        <span className="font-mono text-zinc-200">{g.toLocaleString()} sats</span>
                    </div>
                    <Bar parts={parts} keys={['minimum', 'user', 'frontend', 'protocol']} total={g} />
                </div>
                <div>
                    <div className="mb-2 flex items-baseline justify-between text-[12px]">
                        <span className="text-zinc-400">Surplus, zoomed</span>
                        <span className="font-mono text-zinc-200">{surplus.toLocaleString()} sats</span>
                    </div>
                    {surplus > 0 ? (
                        <Bar parts={parts} keys={['user', 'frontend', 'protocol']} total={surplus} />
                    ) : (
                        <div className="flex h-6 items-center rounded-[4px] border border-dashed border-white/10 px-3 text-[11.5px] text-zinc-500">
                            No surplus: the route exactly meets the minimum
                        </div>
                    )}
                </div>
                <table className="w-full text-[12.5px]">
                    <caption className="sr-only">Payout breakdown</caption>
                    <tbody className="divide-y divide-white/[0.04]">
                        {PARTS.map(p => (
                            <tr key={p.key}>
                                <td className="py-1.5"><LegendItem color={p.color} label={p.label} /></td>
                                <td className="py-1.5 text-right font-mono text-zinc-200">{parts[p.key].toLocaleString()}</td>
                            </tr>
                        ))}
                        <tr>
                            <td className="py-1.5 font-medium text-zinc-300">Maker receives (output 0)</td>
                            <td className="py-1.5 text-right font-mono font-semibold text-white">{makerTotal.toLocaleString()}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </ChartFrame>
    );
}
