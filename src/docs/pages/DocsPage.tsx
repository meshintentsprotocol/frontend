import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ChevronRight, Clock, Construction, PencilLine } from 'lucide-react';
import { cn } from '@/lib/utils';
import { neighbours, type DocPage as Page } from '../lib/content';
import { DocsMarkdown } from '../components/DocsMarkdown';
import { DocsToc } from '../components/DocsToc';

function Breadcrumbs({ page }: { page: Page }) {
    const parts = [page.nav.section.title, ...page.nav.trail];
    return (
        <div className="mb-5 flex flex-wrap items-center gap-1.5 text-[12.5px] text-zinc-500">
            <Link to="/docs" className="hover:text-zinc-300">Docs</Link>
            {parts.map(p => (
                <span key={p} className="flex items-center gap-1.5">
                    <ChevronRight className="h-3 w-3 text-zinc-700" />
                    <span>{p}</span>
                </span>
            ))}
        </div>
    );
}

function StatusBanner({ page }: { page: Page }) {
    if (page.status === 'ready') return null;
    const planned = page.status === 'planned';
    return (
        <div className={cn(
            'mb-8 flex items-start gap-3 rounded-xl border px-4 py-3 text-[13.5px] leading-6',
            planned ? 'border-white/[0.08] bg-white/[0.02] text-zinc-400' : 'border-amber-500/25 bg-amber-500/[0.04] text-amber-100/80',
        )}>
            {planned ? <Construction className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" /> : <PencilLine className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />}
            <p>
                {planned
                    ? 'This page is planned. The outline below is what it will cover and the sources it will be written from.'
                    : 'Draft: the content is accurate to the sources listed but not yet fully reviewed. Expect additions.'}
            </p>
        </div>
    );
}

function Pager({ page }: { page: Page }) {
    const { prev, next } = neighbours(page.slug);
    const cls = 'group flex flex-1 flex-col rounded-xl border border-white/[0.06] px-4 py-3.5 transition-colors hover:border-emerald-500/30';
    return (
        <div className="mt-16 flex flex-col gap-3 sm:flex-row">
            {prev ? (
                <Link to={`/docs/${prev.slug}`} className={cls}>
                    <span className="flex items-center gap-1.5 text-[12px] text-zinc-500"><ArrowLeft className="h-3.5 w-3.5" /> Previous</span>
                    <span className="mt-1 text-[14.5px] font-medium text-zinc-200 group-hover:text-emerald-300">{prev.title}</span>
                </Link>
            ) : <span className="flex-1" />}
            {next ? (
                <Link to={`/docs/${next.slug}`} className={cn(cls, 'items-end text-right')}>
                    <span className="flex items-center gap-1.5 text-[12px] text-zinc-500">Next <ArrowRight className="h-3.5 w-3.5" /></span>
                    <span className="mt-1 text-[14.5px] font-medium text-zinc-200 group-hover:text-emerald-300">{next.title}</span>
                </Link>
            ) : <span className="flex-1" />}
        </div>
    );
}

export function DocsPage({ page }: { page: Page }) {
    const { hash } = useLocation();

    // Jump to #anchor once the markdown has rendered.
    useEffect(() => {
        if (!hash) return;
        const t = setTimeout(() => document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView(), 50);
        return () => clearTimeout(t);
    }, [page.slug, hash]);

    useEffect(() => {
        document.title = `${page.title} · BCH Intents Docs`;
    }, [page.title]);

    return (
        <div className="flex gap-12">
            <article className="min-w-0 max-w-[780px] flex-1 pb-24 pt-10">
                <Breadcrumbs page={page} />
                <h1 className="text-[34px] font-semibold leading-tight tracking-tight text-white sm:text-[40px]">{page.title}</h1>
                {page.description && <p className="mt-3 text-[17px] leading-7 text-zinc-400">{page.description}</p>}
                <div className="mb-8 mt-5 flex flex-wrap items-center gap-3 border-b border-white/[0.06] pb-6 text-[12px] text-zinc-500">
                    {page.updated && <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Updated {page.updated}</span>}
                    <span className="font-mono text-[11px] text-zinc-600">src/docs/content/{page.slug}.md</span>
                </div>
                <StatusBanner page={page} />
                {page.missing ? (
                    <p className="text-[15px] leading-7 text-zinc-500">
                        No content yet. Create <code className="rounded bg-white/[0.04] px-1.5 py-0.5 font-mono text-[13px] text-zinc-300">src/docs/content/{page.slug}.md</code> to publish this page.
                    </p>
                ) : (
                    <DocsMarkdown source={page.body} />
                )}
                <Pager page={page} />
            </article>
            <aside className="hidden w-56 shrink-0 xl:block">
                <div className="sticky top-16 max-h-[calc(100vh-4rem)] overflow-y-auto pb-10 pt-10 scrollbar-none">
                    <DocsToc page={page} />
                </div>
            </aside>
        </div>
    );
}
