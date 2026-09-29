import type { ReactNode } from 'react';
import { ArrowDown, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export type Tone = 'emerald' | 'blue' | 'violet' | 'amber' | 'zinc' | 'rose';

export const TONE: Record<Tone, { border: string; bg: string; text: string; dot: string }> = {
    emerald: { border: 'border-emerald-500/30', bg: 'bg-emerald-500/[0.06]', text: 'text-emerald-300', dot: 'bg-emerald-400' },
    blue: { border: 'border-sky-500/30', bg: 'bg-sky-500/[0.06]', text: 'text-sky-300', dot: 'bg-sky-400' },
    violet: { border: 'border-violet-500/30', bg: 'bg-violet-500/[0.06]', text: 'text-violet-300', dot: 'bg-violet-400' },
    amber: { border: 'border-amber-500/30', bg: 'bg-amber-500/[0.06]', text: 'text-amber-300', dot: 'bg-amber-400' },
    rose: { border: 'border-rose-500/30', bg: 'bg-rose-500/[0.06]', text: 'text-rose-300', dot: 'bg-rose-400' },
    zinc: { border: 'border-white/[0.08]', bg: 'bg-white/[0.02]', text: 'text-zinc-300', dot: 'bg-zinc-400' },
};

/** Outer frame shared by every diagram: surface, title row, caption. */
export function Figure({ title, caption, children, className }: { title?: string; caption?: ReactNode; children: ReactNode; className?: string }) {
    return (
        <figure className="not-prose my-8">
            <div className={cn('relative overflow-hidden rounded-xl border border-white/[0.06] bg-[#0b0b0d] p-5 sm:p-6', className)}>
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.035)_1px,transparent_0)] [background-size:20px_20px]" aria-hidden />
                {title && <p className="relative mb-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{title}</p>}
                <div className="relative">{children}</div>
            </div>
            {caption && <figcaption className="mt-3 text-center text-[13px] leading-6 text-zinc-500">{caption}</figcaption>}
        </figure>
    );
}

export function Node({ tone = 'zinc', className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
    const t = TONE[tone];
    return <div className={cn('rounded-lg border px-3.5 py-3', t.border, t.bg, className)}>{children}</div>;
}

export function Tag({ children, tone = 'zinc' }: { children: ReactNode; tone?: Tone }) {
    return (
        <code className={cn('inline-block rounded border px-1.5 py-px font-mono text-[10.5px] leading-4', TONE[tone].border, TONE[tone].text, 'bg-black/30')}>
            {children}
        </code>
    );
}

/** Arrow that points right on wide screens and down when the flow stacks. */
export function FlowArrow({ className }: { className?: string }) {
    return (
        <div className={cn('flex items-center justify-center text-zinc-600', className)} aria-hidden>
            <ArrowRight className="hidden h-4 w-4 md:block" />
            <ArrowDown className="h-4 w-4 md:hidden" />
        </div>
    );
}

export function StepBadge({ n, tone = 'emerald' }: { n: ReactNode; tone?: Tone }) {
    return (
        <span className={cn('inline-flex h-5 min-w-5 items-center justify-center rounded-full border px-1 font-mono text-[10px] font-semibold', TONE[tone].border, TONE[tone].text)}>
            {n}
        </span>
    );
}
