import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isGroup, type NavGroup, type NavLeaf, type NavNode, type NavSection } from '../nav';
import { getPage } from '../lib/content';
import { MethodPill } from './ApiEndpoint';

const containsSlug = (nodes: NavNode[], slug: string): boolean =>
    nodes.some(n => (isGroup(n) ? containsSlug(n.items, slug) : n.slug === slug));

function Leaf({ leaf, active, onNavigate }: { leaf: NavLeaf; active: boolean; onNavigate?: () => void }) {
    const status = getPage(leaf.slug)?.status ?? 'planned';
    const muted = status === 'planned';
    return (
        <Link
            to={`/docs/${leaf.slug}`}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cn(
                'relative flex items-center gap-2 rounded-md py-[7px] pl-3 pr-2 text-[13.5px] transition-colors',
                active
                    ? 'bg-emerald-500/[0.07] font-medium text-emerald-300'
                    : muted
                        ? 'text-zinc-600 hover:bg-white/[0.02] hover:text-zinc-400'
                        : 'text-zinc-400 hover:bg-white/[0.03] hover:text-zinc-100',
            )}
        >
            {active && <span className="absolute -left-px bottom-1.5 top-1.5 w-[2px] rounded-full bg-emerald-400" />}
            {leaf.method && <MethodPill method={leaf.method} size="sm" />}
            <span className="min-w-0 flex-1 truncate">{leaf.title}</span>
            {leaf.badge === 'beta' && <span className="rounded border border-violet-500/30 px-1 text-[9px] font-semibold uppercase tracking-wide text-violet-300">beta</span>}
            {leaf.badge === 'new' && <span className="rounded border border-emerald-500/30 px-1 text-[9px] font-semibold uppercase tracking-wide text-emerald-300">new</span>}
            {(leaf.badge === 'soon' || (muted && !leaf.badge)) && <span className="text-[9.5px] uppercase tracking-wide text-zinc-600">soon</span>}
            {status === 'draft' && !leaf.badge && <span className="h-1.5 w-1.5 rounded-full bg-amber-400/70" title="Draft" />}
        </Link>
    );
}

function Group({ group, activeSlug, depth, onNavigate }: { group: NavGroup; activeSlug: string; depth: number; onNavigate?: () => void }) {
    const hasActive = containsSlug(group.items, activeSlug);
    const [open, setOpen] = useState(!group.collapsed || hasActive);
    const isOpen = open || hasActive;

    return (
        <div className={depth === 0 ? 'mb-5' : 'mt-0.5'}>
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                aria-expanded={isOpen}
                className={cn(
                    'flex w-full items-center gap-1.5 text-left transition-colors',
                    depth === 0
                        ? 'mb-1.5 px-3 text-[11.5px] font-semibold uppercase tracking-[0.1em] text-zinc-500 hover:text-zinc-300'
                        : 'rounded-md py-[7px] pl-3 pr-2 text-[13.5px] text-zinc-400 hover:bg-white/[0.03] hover:text-zinc-100',
                )}
            >
                <span className="flex-1">{group.title}</span>
                <ChevronRight className={cn('h-3.5 w-3.5 text-zinc-600 transition-transform', isOpen && 'rotate-90')} />
            </button>
            {isOpen && (
                <div className={cn('space-y-px', depth > 0 && 'ml-3 border-l border-white/[0.06] pl-1')}>
                    {group.items.map(n =>
                        isGroup(n) ? (
                            <Group key={n.title} group={n} activeSlug={activeSlug} depth={depth + 1} onNavigate={onNavigate} />
                        ) : (
                            <Leaf key={n.slug} leaf={n} active={n.slug === activeSlug} onNavigate={onNavigate} />
                        ),
                    )}
                </div>
            )}
        </div>
    );
}

export function DocsSidebar({ section, activeSlug, onNavigate }: { section: NavSection; activeSlug: string; onNavigate?: () => void }) {
    const Icon = section.icon;
    return (
        <nav aria-label={`${section.title} navigation`}>
            <div className="mb-6 flex items-start gap-3 px-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-500/25 bg-emerald-500/[0.07] text-emerald-400">
                    <Icon className="h-4 w-4" />
                </span>
                <div>
                    <p className="text-[14px] font-semibold text-white">{section.title}</p>
                    <p className="mt-0.5 text-[12px] leading-5 text-zinc-500">{section.tagline}</p>
                </div>
            </div>
            {section.groups.map(g => (
                <Group key={g.title} group={g} activeSlug={activeSlug} depth={0} onNavigate={onNavigate} />
            ))}
        </nav>
    );
}
