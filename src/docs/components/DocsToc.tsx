import { useEffect, useState } from 'react';
import { ArrowUp, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DocPage } from '../lib/content';

/** "On this page" rail with scroll-spy over h2/h3. */
export function DocsToc({ page }: { page: DocPage }) {
    const items = page.headings.filter(h => h.depth <= 3);
    const [active, setActive] = useState<string | null>(items[0]?.id ?? null);

    useEffect(() => {
        const els = items.map(h => document.getElementById(h.id)).filter((e): e is HTMLElement => !!e);
        if (!els.length) return;
        const obs = new IntersectionObserver(
            entries => {
                const visible = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
                if (visible[0]) setActive(visible[0].target.id);
            },
            { rootMargin: '-88px 0px -65% 0px' },
        );
        els.forEach(el => obs.observe(el));
        return () => obs.disconnect();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page.slug]);

    return (
        <div className="space-y-8">
            {items.length > 0 && (
                <div>
                    <p className="mb-3 text-[11.5px] font-semibold uppercase tracking-[0.1em] text-zinc-500">On this page</p>
                    <ul className="space-y-0.5 border-l border-white/[0.06]">
                        {items.map(h => (
                            <li key={h.id}>
                                <a
                                    href={`#${h.id}`}
                                    className={cn(
                                        '-ml-px block border-l py-1 text-[13px] leading-5 transition-colors',
                                        h.depth === 3 ? 'pl-6' : 'pl-3',
                                        active === h.id ? 'border-emerald-400 text-emerald-300' : 'border-transparent text-zinc-500 hover:text-zinc-200',
                                    )}
                                >
                                    {h.text}
                                </a>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            {page.sources.length > 0 && (
                <div>
                    <p className="mb-3 text-[11.5px] font-semibold uppercase tracking-[0.1em] text-zinc-500">Written from</p>
                    <ul className="space-y-1.5">
                        {page.sources.map(s => (
                            <li key={s} className="flex gap-2 text-[12px] leading-5 text-zinc-500">
                                <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-600" />
                                <span className="break-all font-mono text-[11px]">{s}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            <button
                type="button"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="flex items-center gap-1.5 text-[12px] text-zinc-500 transition-colors hover:text-zinc-200"
            >
                <ArrowUp className="h-3.5 w-3.5" /> Back to top
            </button>
        </div>
    );
}
