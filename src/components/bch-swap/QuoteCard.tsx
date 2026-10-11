/**
 * The quote card under the swap form: a badge saying what kind of trade this is, who
 * carries it out and on which network, how long it takes, then the lines of the quote.
 *
 * The display the USDC bridge introduced (swap-server/SwapServerCardParts), here for
 * CashToken swaps, limit orders and TWAP, so every pair reads the same way.
 */

import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type QuoteTone = 'emerald' | 'violet' | 'teal' | 'amber' | 'indigo';

const TONE: Record<QuoteTone, string> = {
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    violet: 'text-violet-300 bg-violet-500/10 border-violet-500/20',
    teal: 'text-teal-300 bg-teal-500/10 border-teal-500/20',
    amber: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
    indigo: 'text-indigo-300 bg-indigo-500/10 border-indigo-500/20',
};

export function QuoteCard({ icon, label, tone = 'emerald', provider, aside, children, className }: {
    icon: ReactNode;
    /** What kind of trade: "CashToken swap", "Limit order", "TWAP". */
    label: string;
    tone?: QuoteTone;
    /** Who carries it out, and where: "Dutch auction · Chipnet". */
    provider: string;
    /** How long it takes, on the right. */
    aside?: ReactNode;
    /** QuoteRow and QuoteWarning lines; the card is just its header without them. */
    children?: ReactNode;
    className?: string;
}) {
    return (
        <div className={cn('overflow-hidden rounded-2xl border border-white/[0.05] bg-white/[0.02]', className)} data-quote-card>
            <div className="flex items-center justify-between gap-2 px-4 py-3 text-xs">
                <div className="flex min-w-0 items-center gap-2">
                    <Badge variant="outline" className={cn('h-4 shrink-0 gap-1 border px-1.5 text-[10px]', TONE[tone])}>
                        {icon}{label}
                    </Badge>
                    <span className="truncate text-white/50">{provider}</span>
                </div>
                {aside && <span className="shrink-0 text-white/50">{aside}</span>}
            </div>
            {children && <div className="space-y-1.5 border-t border-white/[0.04] px-4 pb-3 pt-2 text-sm">{children}</div>}
        </div>
    );
}

export function QuoteRow({ label, value, strong, hint }: { label: string; value: ReactNode; strong?: boolean; hint?: string }) {
    return (
        <div className="flex justify-between gap-3 text-white/50">
            <span className="shrink-0">{label}{hint && <span className="text-white/30"> · {hint}</span>}</span>
            <span className={cn('min-w-0 text-right', strong ? 'font-semibold text-white' : 'text-white/80')}>{value}</span>
        </div>
    );
}

export function QuoteWarning({ children }: { children: ReactNode }) {
    return (
        <div className="flex items-start gap-1.5 pt-1 text-xs text-yellow-400/80">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
            <span>{children}</span>
        </div>
    );
}
