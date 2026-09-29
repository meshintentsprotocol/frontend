import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AXIS_TEXT, ChartFrame, GRID, LegendItem, RangeControl, SERIES, TooltipBox } from './ChartFrame';

// Assumptions from MeshDocs/04-atomic-bulk-reconfiguration.md:
//   BCH: 11 inputs + 13 outputs ≈ 4.5 KB ≈ 4,500 sats at 1 sat/byte ≈ $0.013
//        → ~190 bytes per input/output plus fixed overhead.
//   EVM: 10 docks + 12 ships (22 state writes) ≈ $20 – $100+ in gas.

const BYTES_PER_IO = 190;
const OVERHEAD_BYTES = 60;
const EVM_LOW_PER_WRITE = 20 / 22;
const EVM_HIGH_PER_WRITE = 100 / 22;

const usd = (v: number) => (v < 1 ? `$${v.toFixed(3)}` : `$${v.toFixed(v < 100 ? 2 : 0)}`);

export function RebalanceCostChart() {
    const [bchPrice, setBchPrice] = useState(300);

    const data = useMemo(() => {
        const rows = [];
        for (let n = 1; n <= 30; n++) {
            // close n positions and open n positions (+1 wallet input, +1 change output)
            const bytes = OVERHEAD_BYTES + BYTES_PER_IO * (2 * n + 2);
            rows.push({
                n,
                bch: (bytes * 1e-8) * bchPrice,
                evmLow: 2 * n * EVM_LOW_PER_WRITE,
                evmHigh: 2 * n * EVM_HIGH_PER_WRITE,
            });
        }
        return rows;
    }, [bchPrice]);

    const at10 = data[9];

    return (
        <ChartFrame
            title="Cost to reconfigure N positions"
            subtitle="Close N positions and open N new ones. On BCH that is one transaction priced by bytes; on EVM each position change is a separate state write."
            controls={<RangeControl label="BCH price" value={bchPrice} min={100} max={1_000} step={10} onChange={setBchPrice} format={v => `$${v}`} />}
            legend={
                <>
                    <LegendItem color={SERIES[0]} label="BCHMesh, one bulk tx" value={usd(at10.bch)} line />
                    <LegendItem color={SERIES[1]} label="EVM, low estimate" value={usd(at10.evmLow)} line />
                    <LegendItem color={SERIES[2]} label="EVM, high estimate" value={usd(at10.evmHigh)} line />
                    <span className="ml-auto text-[12px] text-zinc-500">values at N = 10</span>
                </>
            }
            footnote={<>Log scale. BCH: ~190 bytes per input/output at 1 sat/byte (a 24-input/output tx ≈ 4.5 KB). EVM: $20–$100 per 22 state writes. Both from MeshDocs/04; real costs depend on gas price and script size.</>}
        >
            <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
                        <CartesianGrid stroke={GRID} vertical={false} />
                        <XAxis dataKey="n" tickLine={false} axisLine={{ stroke: GRID }} tick={{ fill: AXIS_TEXT, fontSize: 11 }} />
                        <YAxis
                            scale="log" domain={[0.001, 1000]} ticks={[0.001, 0.01, 0.1, 1, 10, 100, 1000]} allowDataOverflow
                            tickLine={false} axisLine={false} width={52} tick={{ fill: AXIS_TEXT, fontSize: 11 }}
                            tickFormatter={v => (v < 1 ? `$${v}` : `$${Number(v).toLocaleString()}`)}
                        />
                        <Tooltip
                            cursor={{ stroke: '#3f3f46', strokeWidth: 1 }}
                            content={({ active, payload, label }) => {
                                const row = payload?.[0]?.payload as (typeof data)[number] | undefined;
                                return active && row ? (
                                    <TooltipBox
                                        title={`N = ${label} positions`}
                                        rows={[
                                            { color: SERIES[0], label: 'BCHMesh', value: usd(row.bch) },
                                            { color: SERIES[1], label: 'EVM low', value: usd(row.evmLow) },
                                            { color: SERIES[2], label: 'EVM high', value: usd(row.evmHigh) },
                                        ]}
                                    />
                                ) : null;
                            }}
                        />
                        <Line dataKey="evmHigh" stroke={SERIES[2]} strokeWidth={2} dot={false} isAnimationActive={false} />
                        <Line dataKey="evmLow" stroke={SERIES[1]} strokeWidth={2} dot={false} isAnimationActive={false} />
                        <Line dataKey="bch" stroke={SERIES[0]} strokeWidth={2} dot={false} isAnimationActive={false} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </ChartFrame>
    );
}
