import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Command } from 'cmdk';
import { CornerDownLeft, Hash, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { getPage, search, type DocPage } from '../lib/content';

const POPULAR = [
    'get-started/quickstart',
    'intents/lifecycle',
    'api/intents/create',
    'api/quote',
    'mesh/pools/strategy-pools',
    'solvers/matching',
];

function Row({ page, heading }: { page: DocPage; heading?: string }) {
    const Icon = page.nav.section.icon;
    return (
        <>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03] text-zinc-400 group-data-[selected=true]:border-emerald-500/30 group-data-[selected=true]:text-emerald-400">
                {heading ? <Hash className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
            </span>
            <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] text-zinc-200">{heading ?? page.title}</span>
                <span className="block truncate text-[11.5px] text-zinc-500">
                    {[page.nav.section.title, ...page.nav.trail, heading ? page.title : null].filter(Boolean).join(' › ')}
                </span>
            </span>
            {page.status !== 'ready' && (
                <span className="rounded border border-white/10 px-1.5 py-px text-[10px] uppercase tracking-wide text-zinc-500">{page.status}</span>
            )}
            <CornerDownLeft className="h-3.5 w-3.5 text-zinc-600 opacity-0 group-data-[selected=true]:opacity-100" />
        </>
    );
}

export function DocsSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
    const [query, setQuery] = useState('');
    const navigate = useNavigate();
    const hits = useMemo(() => search(query), [query]);

    useEffect(() => { if (!open) setQuery(''); }, [open]);

    const go = (slug: string, anchor?: string) => {
        onOpenChange(false);
        navigate(`/docs/${slug}${anchor ? `#${anchor}` : ''}`);
    };

    const itemCls = 'group flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 data-[selected=true]:bg-white/[0.04]';

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="top-[12%] max-w-[620px] translate-y-0 gap-0 overflow-hidden border-white/10 bg-[#0e0e10] p-0 shadow-2xl [&>button]:hidden">
                <DialogTitle className="sr-only">Search docs</DialogTitle>
                <Command shouldFilter={false} loop className="flex flex-col">
                    <div className="flex items-center gap-3 border-b border-white/[0.06] px-4">
                        <Search className="h-4 w-4 text-zinc-500" />
                        <Command.Input
                            value={query}
                            onValueChange={setQuery}
                            autoFocus
                            placeholder="Search intents, Mesh, contracts, SDK, API…"
                            className="h-14 flex-1 bg-transparent text-[15px] text-zinc-100 outline-none placeholder:text-zinc-600"
                        />
                        <kbd className="rounded border border-white/10 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">ESC</kbd>
                    </div>
                    <Command.List className="max-h-[420px] overflow-y-auto p-2">
                        <Command.Empty className="px-4 py-10 text-center text-sm text-zinc-500">No results for “{query}”.</Command.Empty>
                        {query ? (
                            hits.map(h => (
                                <Command.Item
                                    key={h.page.slug + (h.heading?.id ?? '')}
                                    value={h.page.slug + (h.heading?.id ?? '')}
                                    onSelect={() => go(h.page.slug, h.heading?.id)}
                                    className={itemCls}
                                >
                                    <Row page={h.page} heading={h.heading?.text} />
                                </Command.Item>
                            ))
                        ) : (
                            <Command.Group heading="Popular" className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:pt-1 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-zinc-500">
                                {POPULAR.map(slug => getPage(slug)).filter((p): p is DocPage => !!p).map(p => (
                                    <Command.Item key={p.slug} value={p.slug} onSelect={() => go(p.slug)} className={itemCls}>
                                        <Row page={p} />
                                    </Command.Item>
                                ))}
                            </Command.Group>
                        )}
                    </Command.List>
                    <div className="flex items-center gap-4 border-t border-white/[0.06] px-4 py-2.5 text-[11px] text-zinc-500">
                        <span><kbd className="font-mono">↑↓</kbd> navigate</span>
                        <span><kbd className="font-mono">↵</kbd> open</span>
                        <span className="ml-auto"><kbd className="font-mono">⌘K</kbd> anywhere in docs</span>
                    </div>
                </Command>
            </DialogContent>
        </Dialog>
    );
}
