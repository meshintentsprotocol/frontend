import { useState } from 'react';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer, YAxis } from 'recharts';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/marketData';

interface PortfolioChartProps {
    data: { time: string; value: number }[];
    totalValue: number;
    changePercentage24h?: number;
}

export function PortfolioChart({ data, totalValue, changePercentage24h = 1.04 }: PortfolioChartProps) {
    const [activeRange, setActiveRange] = useState<'1D' | '1W' | '1M' | '1Y'>('1D');

    // Determine color based on profitability (green if positive, pink/red if negative)
    const isPositive = changePercentage24h >= 0;
    const chartColor = isPositive ? '#10B981' : '#F43F5E'; // emerald-500 or rose-500

    const changeAbsolute = totalValue * (Math.abs(changePercentage24h) / 100);

    return (
        <div className="flex flex-col w-full">
            {/* Header info */}
            <div className="mb-8">
                <h1 className="text-4xl sm:text-5xl font-semibold text-foreground tracking-tight">
                    {formatCurrency(totalValue)}
                </h1>
                <div className={cn(
                    "flex items-center gap-1.5 mt-2 font-medium text-lg",
                    isPositive ? "text-emerald-500" : "text-rose-500"
                )}>
                    <span>{isPositive ? '▲' : '▼'}</span>
                    <span>{formatCurrency(changeAbsolute)} ({Math.abs(changePercentage24h).toFixed(2)}%)</span>
                </div>
            </div>

            {/* Chart Area */}
            <div className="h-[240px] sm:h-[300px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data}>
                        <defs>
                            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={chartColor} stopOpacity={0.3} />
                                <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <XAxis
                            dataKey="time"
                            hide
                        />
                        <YAxis
                            domain={['dataMin - 10', 'dataMax + 10']}
                            hide
                        />
                        <Tooltip
                            content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                    const val = payload[0].value as number;
                                    const timeStr = new Date(payload[0].payload.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                    return (
                                        <div className="bg-[#121212] border border-white/10 p-3 rounded-lg shadow-xl shadow-black/50">
                                            <p className="text-foreground font-semibold">{formatCurrency(val)}</p>
                                            <p className="text-xs text-muted-foreground mt-1">{timeStr}</p>
                                        </div>
                                    );
                                }
                                return null;
                            }}
                            cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1, strokeDasharray: '4 4' }}
                        />
                        <Area
                            type="monotone"
                            dataKey="value"
                            stroke={chartColor}
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#colorValue)"
                            animationDuration={1000}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            {/* Timeframe Controls */}
            <div className="flex items-center gap-2 mt-6">
                {['1D', '1W', '1M', '1Y'].map((range) => (
                    <button
                        key={range}
                        onClick={() => setActiveRange(range as any)}
                        className={cn(
                            "px-3 py-1 text-sm font-medium rounded-full transition-colors",
                            activeRange === range
                                ? "bg-white/10 text-foreground"
                                : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                        )}
                    >
                        {range}
                    </button>
                ))}
            </div>
        </div>
    );
}
