import type { ReactNode } from 'react';
import { AlertTriangle, Info, Lightbulb, OctagonAlert, StickyNote } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CalloutType } from '../lib/remark';

const STYLES: Record<CalloutType, { icon: typeof Info; label: string; box: string; icon_: string }> = {
    note: { icon: StickyNote, label: 'Note', box: 'border-zinc-700/60 bg-zinc-900/40', icon_: 'text-zinc-300' },
    info: { icon: Info, label: 'Info', box: 'border-sky-500/25 bg-sky-500/[0.05]', icon_: 'text-sky-300' },
    tip: { icon: Lightbulb, label: 'Tip', box: 'border-emerald-500/25 bg-emerald-500/[0.05]', icon_: 'text-emerald-300' },
    warning: { icon: AlertTriangle, label: 'Warning', box: 'border-amber-500/25 bg-amber-500/[0.05]', icon_: 'text-amber-300' },
    danger: { icon: OctagonAlert, label: 'Danger', box: 'border-rose-500/30 bg-rose-500/[0.05]', icon_: 'text-rose-300' },
};

export function Callout({ type = 'note', title, children }: { type?: CalloutType; title?: string; children: ReactNode }) {
    const s = STYLES[type] ?? STYLES.note;
    const Icon = s.icon;
    return (
        <aside className={cn('my-6 flex gap-3 rounded-xl border px-4 py-3.5', s.box)}>
            <Icon className={cn('mt-[3px] h-4 w-4 shrink-0', s.icon_)} aria-hidden />
            <div className="min-w-0 flex-1 text-[14.5px] leading-7 text-zinc-300 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_p:empty]:hidden [&_p]:my-2">
                <p className="!mb-1 !mt-0 text-sm font-semibold text-zinc-100">{title || s.label}</p>
                {children}
            </div>
        </aside>
    );
}
