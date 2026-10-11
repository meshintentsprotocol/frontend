import type { ReactNode } from 'react';
import { Chameleon, type ChamMood } from '@/components/wallet/Chameleon';
import { cn } from '@/lib/utils';

/** Nothing to show yet: Cham on its branch, a line saying what is missing and how it gets here. */
export function EmptyState({ title, hint, mood = 'idle', tone, size = 'md', action, className }: {
    title: string;
    hint?: string;
    mood?: ChamMood;
    /** Cham's colour; the brand emerald when left out. */
    tone?: string;
    size?: 'sm' | 'md';
    action?: ReactNode;
    className?: string;
}) {
    return (
        <div className={cn('flex flex-1 flex-col items-center justify-center px-4 text-center', size === 'sm' ? 'py-6' : 'py-10', className)}>
            <Chameleon size={size === 'sm' ? 88 : 124} mood={mood} tone={tone} className="text-white/30" />
            <h3 className="mt-3 text-sm font-semibold text-white/85">{title}</h3>
            {hint && <p className="mt-1 max-w-[280px] text-xs text-white/45">{hint}</p>}
            {action && <div className="mt-4">{action}</div>}
        </div>
    );
}
