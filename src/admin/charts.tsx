/**
 * Small Recharts views for the console. Every chart has a legend and a
 * tooltip; series colours match the method / category badges.
 */
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis, Line, ComposedChart } from 'recharts';
import type { EventCategory, Overview } from './api';
import { CATEGORY, METHOD_META } from './kit';

const axis = { stroke: '#52525b', fontSize: 10, tickLine: false, axisLine: false } as const;
const tooltip = {
  contentStyle: { background: '#0b0d12', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, fontSize: 11 },
  labelStyle: { color: '#a1a1aa' }, itemStyle: { padding: 0 }, cursor: { fill: 'rgba(255,255,255,0.03)' },
};
const legend = { wrapperStyle: { fontSize: 11, color: '#a1a1aa', paddingTop: 6 }, iconSize: 8 } as const;
const day = (t: number) => new Date(t * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const hour = (t: number) => new Date(t * 1000).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

/** Daily fills stacked by method, with intents created and refunded as lines. */
export function DailyFlowChart({ daily, height = 220 }: { daily: Overview['series']['daily']; height?: number }) {
  return (
    <div style={{ height }} role="img" aria-label="Daily fills by method, intents created and refunded, last 14 days">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={daily} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
          <XAxis dataKey="t" tickFormatter={day} {...axis} />
          <YAxis allowDecimals={false} {...axis} />
          <Tooltip {...tooltip} labelFormatter={v => day(Number(v))} />
          <Legend {...legend} />
          {(Object.keys(METHOD_META) as Array<keyof typeof METHOD_META>).map(m => (
            <Bar key={m} dataKey={m} name={`${METHOD_META[m].label} fills`} stackId="f" fill={METHOD_META[m].color} radius={[2, 2, 0, 0]} maxBarSize={22} />
          ))}
          <Line type="monotone" dataKey="created" name="Created" stroke="#e4e4e7" strokeWidth={1.5} dot={false} />
          <Line type="monotone" dataKey="refunded" name="Refunded" stroke="#c084fc" strokeDasharray="4 3" strokeWidth={1.5} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Intents created / filled / refunded per hour. */
export function HourlyIntentChart({ hourly, height = 180 }: { hourly: Overview['series']['hourly']; height?: number }) {
  return (
    <div style={{ height }} role="img" aria-label="Intents created, filled and refunded per hour, last 24 hours">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={hourly} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
          <XAxis dataKey="t" tickFormatter={hour} {...axis} interval={3} />
          <YAxis allowDecimals={false} {...axis} />
          <Tooltip {...tooltip} labelFormatter={v => hour(Number(v))} />
          <Legend {...legend} />
          <Bar dataKey="created" name="Created" fill="#22d3ee" radius={[2, 2, 0, 0]} maxBarSize={10} />
          <Bar dataKey="filled" name="Filled" fill="#34d399" radius={[2, 2, 0, 0]} maxBarSize={10} />
          <Bar dataKey="refunded" name="Refunded" fill="#a78bfa" radius={[2, 2, 0, 0]} maxBarSize={10} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Events per hour stacked by category. */
export function HourlyEventsChart({ hourly, height = 180 }: { hourly: Overview['events']['hourly']; height?: number }) {
  const cats = (Object.keys(CATEGORY) as EventCategory[]).filter(c => hourly.some(h => (h[c] ?? 0) > 0));
  const data = hourly.map(h => ({ ...h, t: Math.floor(h.hour / 1000) }));
  return (
    <div style={{ height }} role="img" aria-label="Events per hour by category, last 24 hours">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
          <XAxis dataKey="t" tickFormatter={hour} {...axis} interval={3} />
          <YAxis allowDecimals={false} {...axis} />
          <Tooltip {...tooltip} labelFormatter={v => hour(Number(v))} />
          <Legend {...legend} />
          {cats.map(c => <Area key={c} type="monotone" dataKey={c} name={CATEGORY[c].label} stackId="e" stroke={CATEGORY[c].color} fill={CATEGORY[c].color} fillOpacity={0.18} strokeWidth={1.2} />)}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Daily volume / fees / fills for an LP or strategy. */
export function DailyPoolChart({ daily, height = 180 }: { daily: Array<{ day: number; volumeSats: string; feesSats: string; fills: number }>; height?: number }) {
  const data = daily.map(d => ({ t: d.day, fills: d.fills, volume: Number(d.volumeSats) / 1e8, fees: Number(d.feesSats) }));
  return (
    <div style={{ height }} role="img" aria-label="Daily fills and volume">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
          <XAxis dataKey="t" tickFormatter={day} {...axis} />
          <YAxis yAxisId="l" allowDecimals={false} {...axis} />
          <YAxis yAxisId="r" orientation="right" {...axis} />
          <Tooltip {...tooltip} labelFormatter={v => day(Number(v))} />
          <Legend {...legend} />
          <Bar yAxisId="l" dataKey="fills" name="Fills" fill="#34d399" radius={[2, 2, 0, 0]} maxBarSize={14} />
          <Line yAxisId="r" type="monotone" dataKey="volume" name="Volume (BCH)" stroke="#38bdf8" dot={false} strokeWidth={1.5} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
