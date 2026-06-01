import { useState } from 'react';
import {
    AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import { cn } from '@/lib/utils';
import { useTokenChart, type TimeRange } from '@/hooks/useTokenChart';

const RANGES: TimeRange[] = ['1H', '1D', '1W', '1M', '1Y', 'ALL'];

interface TokenChartProps {
    tokenId: string;
    isCashToken: boolean;
    isMainnet: boolean;
    currentPrice?: number;
}

function formatChartTime(ts: number, range: TimeRange): string {
    const d = new Date(ts);
    if (range === '1H' || range === '1D') {
        return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    }
    if (range === '1W' || range === '1M') {
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }
    return d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
}

function formatPrice(v: number): string {
    if (v >= 1000) return `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    if (v >= 1) return `$${v.toFixed(2)}`;
    if (v >= 0.01) return `$${v.toFixed(4)}`;
    return `$${v.toFixed(8)}`;
}

interface CustomTooltipProps {
    active?: boolean;
    payload?: Array<{ value: number }>;
    label?: number;
    range: TimeRange;
}

function CustomTooltip({ active, payload, label, range }: CustomTooltipProps) {
    if (!active || !payload?.length || label == null) return null;
    const price = payload[0].value;
    const d = new Date(label);
    const dateStr = range === '1H' || range === '1D'
        ? d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

    return (
        <div className="bg-[#0d0d0d]/95 border border-white/[0.08] rounded-xl px-3 py-2 shadow-lg text-xs">
            <p className="text-white font-semibold text-sm">{formatPrice(price)}</p>
            <p className="text-white/40 mt-0.5">{dateStr}</p>
        </div>
    );
}

export function TokenChart({ tokenId, isCashToken, isMainnet, currentPrice }: TokenChartProps) {
    const [range, setRange] = useState<TimeRange>('1D');
    const { data: chartData, isLoading } = useTokenChart(tokenId, isCashToken, range, isMainnet);

    const points = chartData ?? [];
    const hasData = points.length > 0;

    // Calculate price change for the selected range
    const rangeChange = hasData
        ? ((points[points.length - 1].price - points[0].price) / points[0].price) * 100
        : null;
    const isUp = rangeChange == null ? true : rangeChange >= 0;

    const strokeColor = isUp ? '#10b981' : '#f87171';
    const gradientId = `priceGrad-${tokenId.slice(0, 8)}`;

    return (
        <div className="w-full">
            {/* Range change indicator */}
            {rangeChange != null && (
                <p className={cn('text-sm font-semibold mb-3', isUp ? 'text-emerald-500' : 'text-rose-500')}>
                    {isUp ? '+' : ''}{rangeChange.toFixed(2)}% ({range})
                </p>
            )}

            {/* Chart */}
            <div className="h-[200px] w-full">
                {isLoading ? (
                    <div className="h-full w-full flex items-center justify-center">
                        <div className="h-32 w-full bg-white/[0.02] rounded-xl animate-pulse" />
                    </div>
                ) : !hasData ? (
                    <div className="h-full flex items-center justify-center text-white/20 text-xs">
                        No chart data available
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={points} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                            <defs>
                                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={strokeColor} stopOpacity={0.25} />
                                    <stop offset="95%" stopColor={strokeColor} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <XAxis
                                dataKey="time"
                                tickFormatter={ts => formatChartTime(ts, range)}
                                tickLine={false}
                                axisLine={false}
                                tick={{ fill: '#6b7280', fontSize: 10 }}
                                minTickGap={40}
                            />
                            <YAxis
                                domain={['auto', 'auto']}
                                tickFormatter={formatPrice}
                                tickLine={false}
                                axisLine={false}
                                tick={{ fill: '#6b7280', fontSize: 10 }}
                                width={60}
                                orientation="right"
                            />
                            <Tooltip
                                content={<CustomTooltip range={range} />}
                                cursor={{ stroke: '#ffffff20', strokeWidth: 1, strokeDasharray: '4 4' }}
                            />
                            <Area
                                type="monotone"
                                dataKey="price"
                                stroke={strokeColor}
                                strokeWidth={1.5}
                                fill={`url(#${gradientId})`}
                                dot={false}
                                activeDot={{ r: 3, fill: strokeColor, strokeWidth: 0 }}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                )}
            </div>

            {/* Range picker */}
            <div className="flex items-center gap-1 mt-3">
                {RANGES.map(r => (
                    <button
                        key={r}
                        onClick={() => setRange(r)}
                        className={cn(
                            'px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors',
                            r === range
                                ? 'bg-white/[0.08] text-white'
                                : 'text-white/40 hover:text-white hover:bg-white/[0.04]'
                        )}
                    >
                        {r}
                    </button>
                ))}
            </div>
        </div>
    );
}
