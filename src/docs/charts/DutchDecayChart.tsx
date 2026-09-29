import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AXIS_TEXT, ChartFrame, GRID, LegendItem, RangeControl, SERIES, TooltipBox } from './ChartFrame';

// Mirrors DutchAuctionSwapV2.fill():
//   dropAmount = ((startBuyAmount - endBuyAmount) * elapsed) / duration   (integer division)
//   currentBuyAmount = startBuyAmount - dropAmount

const MIN_COLOR = SERIES[0];
const ROUTE_COLOR = SERIES[1];

function minimumAt(start: number, end: number, duration: number, elapsed: number) {
    return start - Math.floor(((start - end) * elapsed) / duration);
}

export function DutchDecayChart() {
    // Defaults follow the live chipnet test F3 (Dutch 11,900 → 11,000).
    const [start, setStart] = useState(11_900);
    const [end, setEnd] = useState(11_000);
    const [minutes, setMinutes] = useState(60);
    const [route, setRoute] = useState(11_500);

    const lo = Math.min(start, end);
    const hi = Math.max(start, end);
    const duration = minutes * 60;

    const data = useMemo(() => {
        const pts = [];
        for (let m = 0; m <= minutes; m += Math.max(1, Math.round(minutes / 60))) {
            pts.push({ minute: m, minimum: minimumAt(hi, lo, duration, Math.min(m * 60, duration - 1)), route });
        }
        return pts;
    }, [hi, lo, minutes, duration, route]);

    // First second at which the route output clears the decaying minimum.
    const fillSec = useMemo(() => {
        if (route >= hi) return 0;
        if (route < lo) return null;
        for (let s = 0; s < duration; s += 1) if (minimumAt(hi, lo, duration, s) <= route) return s;
        return null;
    }, [hi, lo, duration, route]);

    const fillMin = fillSec === null ? null : fillSec / 60;

    return (
        <ChartFrame
            title="Dutch auction: when does an order fill?"
            subtitle="The covenant minimum decays linearly with tx.locktime. The order fills at the first moment any route's output clears it."
            controls={
                <>
                    <RangeControl label="Start buy amount" value={start} min={10_000} max={13_000} step={50} onChange={setStart} />
                    <RangeControl label="End buy amount" value={end} min={9_000} max={12_000} step={50} onChange={setEnd} />
                    <RangeControl label="Duration" value={minutes} min={10} max={240} step={5} onChange={setMinutes} format={v => `${v} min`} />
                    <RangeControl label="Best route output" value={route} min={9_000} max={13_000} step={25} onChange={setRoute} />
                </>
            }
            legend={
                <>
                    <LegendItem color={MIN_COLOR} label="Covenant minimum" line />
                    <LegendItem color={ROUTE_COLOR} label="Best route output" line />
                    <span className="ml-auto text-[12.5px] text-zinc-300">
                        {fillMin === null ? (
                            <span className="text-amber-300">Never clears → refunded after {minutes} min</span>
                        ) : (
                            <>Fills at <span className="font-mono text-white">{fillMin.toFixed(1)} min</span> for ≥ <span className="font-mono text-white">{route.toLocaleString()}</span></>
                        )}
                    </span>
                </>
            }
            footnote={<>Amounts are in the buy asset's base units. Chain time moves in block-sized steps (MTP), so real fills land within about one block of the crossing.</>}
        >
            <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
                        <CartesianGrid stroke={GRID} vertical={false} />
                        <XAxis
                            dataKey="minute" type="number" domain={[0, minutes]} tickLine={false} axisLine={{ stroke: GRID }}
                            tick={{ fill: AXIS_TEXT, fontSize: 11 }} tickFormatter={v => `${v}m`}
                        />
                        <YAxis
                            domain={[Math.min(lo, route) - 200, Math.max(hi, route) + 200]} tickLine={false} axisLine={false} width={56}
                            tick={{ fill: AXIS_TEXT, fontSize: 11 }} tickFormatter={v => Number(v).toLocaleString()}
                        />
                        <Tooltip
                            cursor={{ stroke: '#3f3f46', strokeWidth: 1 }}
                            content={({ active, payload, label }) =>
                                active && payload?.length ? (
                                    <TooltipBox
                                        title={`t = ${label} min`}
                                        rows={[
                                            { color: MIN_COLOR, label: 'Minimum', value: Number(payload[0]?.payload.minimum).toLocaleString() },
                                            { color: ROUTE_COLOR, label: 'Route', value: route.toLocaleString() },
                                        ]}
                                    />
                                ) : null
                            }
                        />
                        {fillMin !== null && <ReferenceLine x={fillMin} stroke="#3f3f46" />}
                        <Line type="linear" dataKey="route" stroke={ROUTE_COLOR} strokeWidth={2} dot={false} isAnimationActive={false} />
                        <Line type="stepAfter" dataKey="minimum" stroke={MIN_COLOR} strokeWidth={2} dot={false} isAnimationActive={false} />
                        {fillMin !== null && (
                            <ReferenceDot x={fillMin} y={route} r={5} fill={MIN_COLOR} stroke="#0c0c0e" strokeWidth={2} />
                        )}
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </ChartFrame>
    );
}
