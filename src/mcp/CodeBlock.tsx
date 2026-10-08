import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';

/** A copyable block of code or a single value (a URL, a command). */
export function CodeBlock({ code, label, className }: { code: string; label?: string; className?: string }) {
    const [copied, setCopied] = useState(false);
    const copy = () => {
        void navigator.clipboard?.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };
    return (
        <div className={cn('overflow-hidden rounded-2xl border border-white/10 bg-[#0c0c0f]', className)}>
            <div className="flex items-center justify-between gap-3 border-b border-white/5 bg-white/[0.03] px-4 py-2">
                <span className="truncate font-mono text-xs text-zinc-500">{label ?? ' '}</span>
                <button
                    type="button"
                    onClick={copy}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/5 bg-white/5 px-2.5 py-1 text-xs font-medium text-zinc-300 transition-colors hover:bg-white/10"
                >
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 text-zinc-400" />}
                    <span className={copied ? 'text-emerald-400' : undefined}>{copied ? 'Copied' : 'Copy'}</span>
                </button>
            </div>
            <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed text-zinc-200 selection:bg-emerald-500/30 sm:text-sm">
                <code>{code}</code>
            </pre>
        </div>
    );
}
