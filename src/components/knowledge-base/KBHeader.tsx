import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, BookOpen, Layers, Zap } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useKb } from './kbService';

const POPULAR_SEARCHES = [
    'BCHMesh LP',
    'V3 vs V4',
    'Auto-Recycling',
    'XMR Atomic Swaps',
    'Limit Orders',
];

export function KBHeader() {
    const [query, setQuery] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const navigate = useNavigate();

    const kbService = useKb();
    const totalArticles = kbService.getAllArticles().length;
    const totalCategories = kbService.getCategories().length;

    const submit = (q: string) => {
        const trimmed = q.trim();
        if (trimmed) navigate(`/kb/search?q=${encodeURIComponent(trimmed)}`);
    };

    const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') submit(query);
    };

    return (
        <div className="relative text-center pt-16 md:pt-20 pb-32 md:pb-36 overflow-hidden">
            {/* Background & Subtle Grids */}
            <div className="absolute inset-0 bg-zinc-50 dark:bg-zinc-950 grainy" />

            {/* Ambient Gradient Orbs */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-primary/10 dark:bg-primary/15 blur-[140px] rounded-full pointer-events-none" />
            <div className="absolute top-0 right-0 w-[360px] h-[360px] bg-emerald-500/10 blur-[100px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-teal-500/10 blur-[90px] rounded-full pointer-events-none" />

            {/* Grid overlay */}
            <div
                className="absolute inset-0 opacity-[0.03] dark:opacity-[0.06] pointer-events-none"
                style={{
                    backgroundImage:
                        'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
                    backgroundSize: '48px 48px',
                    maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
                    WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
                }}
            />

            <div className="relative z-10 px-4 max-w-5xl mx-auto">
                {/* Title */}
                <motion.h1
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.08 }}
                    className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight mb-4"
                >
                    <span className="text-foreground">Intent Protocol </span>
                    <span className="text-gradient-primary">Knowledge Hub</span>
                </motion.h1>

                {/* Subtitle */}
                <motion.p
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.15 }}
                    className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-8 leading-relaxed"
                >
                    Production manuals for liquidity providers, cross-chain solvers, and developers building on Bitcoin Cash.
                </motion.p>

                {/* Search Bar (Sharp developer-grade box) */}
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.22 }}
                    className="max-w-2xl mx-auto relative mb-5"
                >
                    <div
                        className={cn(
                            'absolute -inset-1 bg-gradient-to-r from-primary/30 via-emerald-500/30 to-primary/30 rounded-xl blur-lg transition-opacity duration-300',
                            isFocused ? 'opacity-100' : 'opacity-0'
                        )}
                    />

                    <div className="relative">
                        <div
                            className={cn(
                                'flex items-center rounded-xl p-1.5 transition-all duration-200',
                                'bg-card/90 dark:bg-zinc-900/90 backdrop-blur-xl',
                                'border border-zinc-200/90 dark:border-zinc-800/90 shadow-lg shadow-black/5',
                                isFocused && 'border-primary ring-2 ring-primary/20'
                            )}
                        >
                            <Search
                                className={cn(
                                    'ml-3.5 h-5 w-5 transition-colors duration-200 flex-shrink-0',
                                    isFocused ? 'text-primary' : 'text-muted-foreground'
                                )}
                            />
                            <Input
                                placeholder="Search guides, strategies, covenant specs, or error codes…"
                                className="pl-3 pr-20 h-11 text-base bg-transparent border-0 shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/60"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={handleSearch}
                                onFocus={() => setIsFocused(true)}
                                onBlur={() => setIsFocused(false)}
                            />
                            <div className="mr-2 hidden sm:flex items-center">
                                <kbd className="px-2 py-1 text-[11px] font-mono font-medium bg-muted text-muted-foreground rounded border border-border/80">
                                    Enter ↵
                                </kbd>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Popular Search Pills */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.3 }}
                    className="max-w-2xl mx-auto flex flex-wrap items-center justify-center gap-1.5 text-xs mb-8"
                >
                    <span className="text-muted-foreground/80 mr-1 font-mono text-[11px]">Popular:</span>
                    {POPULAR_SEARCHES.map((p) => (
                        <button
                            key={p}
                            type="button"
                            onClick={() => submit(p)}
                            className={cn(
                                'px-2.5 py-1 rounded-md text-[11px] font-medium',
                                'bg-card/70 dark:bg-zinc-900/70 backdrop-blur-md',
                                'border border-zinc-200/70 dark:border-zinc-800/70',
                                'text-muted-foreground hover:text-foreground',
                                'hover:border-primary/50 hover:bg-primary/5',
                                'transition-all duration-150'
                            )}
                        >
                            {p}
                        </button>
                    ))}
                </motion.div>

                {/* Compact Stats Strip */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.35 }}
                    className="max-w-lg mx-auto flex items-center justify-center gap-6 sm:gap-10 text-xs text-muted-foreground pt-2 border-t border-border/40"
                >
                    <Stat icon={<BookOpen className="w-3.5 h-3.5 text-primary" />} label="Guides" value={String(totalArticles)} />
                    <span className="w-1 h-1 rounded-full bg-border" />
                    <Stat icon={<Layers className="w-3.5 h-3.5 text-primary" />} label="Tracks" value={String(totalCategories)} />
                    <span className="w-1 h-1 rounded-full bg-border" />
                    <Stat icon={<Zap className="w-3.5 h-3.5 text-emerald-500" />} label="Avg Read" value="5 min" />
                </motion.div>
            </div>
        </div>
    );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <div className="flex items-center gap-2">
            {icon}
            <span className="font-bold text-foreground tabular-nums">{value}</span>
            <span className="text-muted-foreground">{label}</span>
        </div>
    );
}

export default KBHeader;
