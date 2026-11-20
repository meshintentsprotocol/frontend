import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Github, Menu, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import type { NavSection } from '../nav';
import { useDocs } from '../lib/store';
import { DocsSidebar } from './DocsSidebar';
import { BCHLogo } from '@/components/common/BCHLogo';

export function DocsHeader({ activeSection, activeSlug, onSearch }: { activeSection?: NavSection; activeSlug?: string; onSearch: () => void }) {
    const [mobileOpen, setMobileOpen] = useState(false);
    const { nav, firstPageOf } = useDocs();

    return (
        <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#050505]/80 backdrop-blur-xl supports-[backdrop-filter]:bg-[#050505]/65">
            <div className="mx-auto flex h-16 max-w-[1560px] items-center gap-4 px-4 lg:px-6">
                <button
                    type="button"
                    onClick={() => setMobileOpen(true)}
                    className="-ml-1 flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.06] text-zinc-400 hover:text-white lg:hidden"
                    aria-label="Open docs navigation"
                >
                    <Menu className="h-4 w-4" />
                </button>

                <Link to="/docs" className="group flex shrink-0 items-center gap-2">
                    <BCHLogo className="h-7 w-7 transition-transform group-hover:scale-105" />
                    <span className="flex items-baseline text-[17px] font-black tracking-tighter text-white">
                        BCH <span className="ml-1 text-emerald-500 transition-colors group-hover:text-emerald-400">Intents</span>
                    </span>
                    <span className="ml-2.5 rounded-md border border-white/10 bg-white/[0.03] px-1.5 py-0.5 text-[11px] font-semibold text-zinc-300">Docs</span>
                </Link>

                <nav className="ml-4 hidden h-16 items-stretch gap-1 lg:flex" aria-label="Docs sections">
                    {nav.map(s => {
                        const active = activeSection?.id === s.id;
                        return (
                            <Link
                                key={s.id}
                                to={`/docs/${firstPageOf(s).slug}`}
                                className={cn(
                                    'relative flex items-center px-3 text-[13.5px] font-medium transition-colors',
                                    active ? 'text-white' : 'text-zinc-400 hover:text-zinc-100',
                                )}
                            >
                                {s.title}
                                {active && <span className="absolute inset-x-3 bottom-0 h-[2px] rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]" />}
                            </Link>
                        );
                    })}
                </nav>

                <div className="ml-auto flex items-center gap-2">
                    <button
                        type="button"
                        onClick={onSearch}
                        className="flex h-9 items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 text-[13px] text-zinc-500 transition-colors hover:border-white/15 hover:text-zinc-300 md:w-56 xl:w-64"
                        aria-label="Search docs"
                    >
                        <Search className="h-3.5 w-3.5" />
                        <span className="hidden flex-1 text-left md:inline">Search docs…</span>
                        <kbd className="hidden rounded border border-white/10 px-1.5 font-mono text-[10px] text-zinc-500 md:inline">⌘K</kbd>
                    </button>
                    <a
                        href="https://github.com/Intents-Swaps"
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="GitHub"
                        className="hidden h-9 w-9 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-white/[0.04] hover:text-white sm:flex"
                    >
                        <Github className="h-4 w-4" />
                    </a>
                    <Link
                        to="/trade"
                        className="hidden h-9 items-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 text-[13px] font-semibold text-black shadow-[0_0_20px_-6px_rgba(16,185,129,0.8)] transition-colors hover:bg-emerald-400 sm:flex"
                    >
                        Launch app <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                </div>
            </div>

            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetContent side="left" className="w-[300px] overflow-y-auto border-white/[0.06] bg-[#070708] p-0">
                    <SheetTitle className="sr-only">Docs navigation</SheetTitle>
                    <div className="border-b border-white/[0.06] p-3">
                        <div className="grid grid-cols-2 gap-1">
                            {nav.map(s => (
                                <Link
                                    key={s.id}
                                    to={`/docs/${firstPageOf(s).slug}`}
                                    onClick={() => setMobileOpen(false)}
                                    className={cn(
                                        'flex items-center gap-2 rounded-md px-2.5 py-2 text-[13px]',
                                        activeSection?.id === s.id ? 'bg-emerald-500/10 text-emerald-300' : 'text-zinc-400 hover:bg-white/[0.03]',
                                    )}
                                >
                                    <s.icon className="h-3.5 w-3.5" /> {s.title}
                                </Link>
                            ))}
                        </div>
                    </div>
                    {activeSection && (
                        <div className="p-3 pt-5">
                            <DocsSidebar section={activeSection} activeSlug={activeSlug ?? ''} onNavigate={() => setMobileOpen(false)} />
                        </div>
                    )}
                </SheetContent>
            </Sheet>
        </header>
    );
}
