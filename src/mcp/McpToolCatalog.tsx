/**
 * The MCP server's tools, grouped, with each tool's parameters on demand.
 * Rendered from the bundled manifest, on the /mcp page and in the docs.
 */
import { useMemo, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MANIFEST, type ManifestTool, type ToolKind } from './manifest';

export const KIND: Record<ToolKind, { label: string; cls: string; hint: string }> = {
    read: { label: 'Read-only', cls: 'border-white/10 text-zinc-400', hint: 'Only reads. Changes nothing.' },
    prepare: { label: 'You sign', cls: 'border-amber-500/40 text-amber-300', hint: 'Returns an order or a plan. Nothing moves until you fund or sign it in your own wallet.' },
    write: { label: 'Server action', cls: 'border-sky-500/40 text-sky-300', hint: 'Asks the Mesh Server to act (a refund to the maker, indexing a deployment). It cannot move your funds.' },
};

function KindBadge({ kind }: { kind: ToolKind }) {
    return (
        <span title={KIND[kind].hint} className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold', KIND[kind].cls)}>
            {KIND[kind].label}
        </span>
    );
}

function ToolRow({ tool }: { tool: ManifestTool }) {
    const [open, setOpen] = useState(false);
    const id = `mcp-tool-${tool.name}`;
    return (
        <li className="border-t border-white/5 first:border-t-0">
            <button
                type="button"
                aria-expanded={open}
                aria-controls={id}
                onClick={() => setOpen(v => !v)}
                className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.03] sm:px-5"
            >
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                        <code className="break-all font-mono text-sm font-semibold text-white">{tool.name}</code>
                        <KindBadge kind={tool.kind} />
                    </div>
                    <p className={cn('mt-1.5 text-sm leading-relaxed text-zinc-400', !open && 'line-clamp-2')}>{tool.description}</p>
                </div>
                <ChevronDown className={cn('mt-1 h-4 w-4 shrink-0 text-zinc-500 transition-transform', open && 'rotate-180')} />
            </button>
            {open && (
                <div id={id} className="px-4 pb-4 sm:px-5">
                    {tool.params.length === 0 ? (
                        <p className="text-xs text-zinc-500">Takes no parameters.</p>
                    ) : (
                        <dl className="divide-y divide-white/5 rounded-xl border border-white/5 bg-black/30">
                            {tool.params.map(p => (
                                <div key={p.name} className="px-3.5 py-2.5">
                                    <dt className="flex flex-wrap items-center gap-2">
                                        <code className="font-mono text-xs font-semibold text-emerald-300">{p.name}</code>
                                        <span className="font-mono text-[11px] text-zinc-500">{p.options ? p.options.join(' | ') : p.type}</span>
                                        {p.required && <span className="text-[11px] font-semibold text-amber-300">required</span>}
                                    </dt>
                                    <dd className="mt-1 text-xs leading-relaxed text-zinc-400">{p.description}</dd>
                                </div>
                            ))}
                        </dl>
                    )}
                </div>
            )}
        </li>
    );
}

export function McpToolCatalog({ search = true }: { search?: boolean }) {
    const [q, setQ] = useState('');
    const groups = useMemo(() => {
        const needle = q.trim().toLowerCase();
        const match = (t: ManifestTool) => !needle || t.name.includes(needle) || t.title.toLowerCase().includes(needle) || t.description.toLowerCase().includes(needle);
        return MANIFEST.groups
            .map(g => ({ ...g, tools: MANIFEST.tools.filter(t => t.group === g.id && match(t)) }))
            .filter(g => g.tools.length > 0);
    }, [q]);

    return (
        <div className="not-prose space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                {search && (
                    <label className="relative block sm:w-72">
                        <span className="sr-only">Filter tools</span>
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                        <input
                            value={q}
                            onChange={e => setQ(e.target.value)}
                            placeholder={`Filter ${MANIFEST.tools.length} tools`}
                            className="h-10 w-full rounded-xl border border-white/10 bg-white/[0.03] pl-9 pr-3 text-sm text-white placeholder:text-zinc-500 focus:border-emerald-500/50 focus:outline-none"
                        />
                    </label>
                )}
                <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-zinc-500">
                    {(Object.keys(KIND) as ToolKind[]).map(k => (
                        <li key={k} className="flex items-center gap-1.5" title={KIND[k].hint}>
                            <KindBadge kind={k} />
                            <span>{MANIFEST.tools.filter(t => t.kind === k).length}</span>
                        </li>
                    ))}
                </ul>
            </div>

            {groups.length === 0 && <p className="py-6 text-center text-sm text-zinc-500">No tool matches “{q}”.</p>}

            {groups.map(g => (
                <section key={g.id}>
                    <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                        <h3 className="text-sm font-bold text-white">{g.id}</h3>
                        <p className="text-xs text-zinc-500">{g.blurb}</p>
                    </div>
                    <ul className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
                        {g.tools.map(t => <ToolRow key={t.name} tool={t} />)}
                    </ul>
                </section>
            ))}
        </div>
    );
}

export default McpToolCatalog;
