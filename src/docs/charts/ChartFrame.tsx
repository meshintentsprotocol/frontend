import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

// Categorical slots, validated (dataviz validator) against the #0c0c0e docs
// surface: all adjacent pairs pass CVD ΔE ≥ 8 and normal-vision ΔE ≥ 15.
// Assign in this order; never cycle.
export const SERIES = ['#0e9f6e', '#3987e5', '#d95926', '#9085e9'] as const;

export const GRID = '#1f1f23';
export const AXIS_TEXT = '#71717a';

export function ChartFrame({ title, subtitle, controls, legend, footnote, children }: {
    title: string;
    subtitle?: ReactNode;
    controls?: ReactNode;
    legend?: ReactNode;
    footnote?: ReactNode;
    children: ReactNode;
}) {
    return (
        <figure className="not-prose my-8 overflow-hidden rounded-xl border border-white/[0.06] bg-[#0c0c0e]">
            <div className="border-b border-white/[0.05] px-5 py-4">
                <p className="text-[14px] font-semibold text-zinc-100">{title}</p>
                {subtitle && <p className="mt-0.5 text-[12.5px] leading-5 text-zinc-500">{subtitle}</p>}
            </div>
            {controls && <div className="flex flex-wrap items-end gap-x-6 gap-y-3 border-b border-white/[0.05] px-5 py-3.5">{controls}</div>}
            <div className="px-3 pb-2 pt-4 sm:px-5">{children}</div>
            {legend && <div className="flex flex-wrap gap-x-5 gap-y-2 px-5 pb-4">{legend}</div>}
            {footnote && <figcaption className="border-t border-white/[0.05] px-5 py-3 text-[12px] leading-5 text-zinc-500">{footnote}</figcaption>}
        </figure>
    );
}

export function LegendItem({ color, label, value, line }: { color: string; label: string; value?: ReactNode; line?: boolean }) {
    return (
        <span className="inline-flex items-center gap-2 text-[12.5px] text-zinc-400">
            <span className={cn(line ? 'h-[2px] w-4 rounded-full' : 'h-2.5 w-2.5 rounded-[3px]')} style={{ background: color }} />
            {label}
            {value !== undefined && <span className="font-mono text-zinc-200">{value}</span>}
        </span>
    );
}

export function RangeControl({ label, value, min, max, step = 1, onChange, format }: {
    label: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    onChange: (v: number) => void;
    format?: (v: number) => string;
}) {
    return (
        <label className="flex min-w-[150px] flex-1 flex-col gap-1.5">
            <span className="flex items-center justify-between text-[11.5px] text-zinc-500">
                {label}
                <span className="font-mono text-zinc-200">{format ? format(value) : value.toLocaleString()}</span>
            </span>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={e => onChange(Number(e.target.value))}
                className="h-1 w-full cursor-pointer appearance-none rounded-full bg-zinc-800 accent-emerald-500"
            />
        </label>
    );
}

export function TooltipBox({ title, rows }: { title: ReactNode; rows: { color: string; label: string; value: ReactNode }[] }) {
    return (
        <div className="rounded-lg border border-white/10 bg-[#141417]/95 px-3 py-2 shadow-xl backdrop-blur">
            <p className="mb-1 text-[11.5px] text-zinc-400">{title}</p>
            {rows.map(r => (
                <p key={r.label} className="flex items-center gap-2 text-[12px] text-zinc-300">
                    <span className="h-2 w-2 rounded-full" style={{ background: r.color }} />
                    {r.label}
                    <span className="ml-auto pl-3 font-mono text-zinc-100">{r.value}</span>
                </p>
            ))}
        </div>
    );
}
