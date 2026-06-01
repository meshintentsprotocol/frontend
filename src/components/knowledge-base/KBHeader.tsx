import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Sparkles, BookOpen, Layers, Zap } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { kbService } from './kbService';

const POPULAR_SEARCHES = [
    'Cross-chain swaps',
    'Solver registration',
    'Dutch auctions',
    'Limit orders',
    'XMR adaptor',
];

export function KBHeader() {
    const [query, setQuery] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const navigate = useNavigate();

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
        <div className="relative text-center pt-24 pb-40 overflow-hidden">
            {/* Premium Mesh Background */}
            <div className="absolute inset-0 bg-zinc-50 dark:bg-zinc-950 grainy" />

            {/* Ambient Gradient Orbs */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[600px] bg-primary/10 dark:bg-primary/20 blur-[160px] rounded-full pointer-events-none animate-pulse-glow" />
            <div className="absolute top-0 right-0 w-[420px] h-[420px] bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[340px] h-[340px] bg-teal-500/10 blur-[100px] rounded-full pointer-events-none" />

            {/* Subtle grid overlay */}
            <div
                className="absolute inset-0 opacity-[0.04] dark:opacity-[0.08] pointer-events-none"
                style={{
                    backgroundImage:
                        'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
                    backgroundSize: '64px 64px',
                    maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
                    WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
                }}
            />

            <div className="relative z-10 px-4">
                {/* Badge */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="flex justify-center mb-8"
                >
                    <span className="tag-primary">
                        <Sparkles className="w-3 h-3" />
                        Knowledge Hub · Updated for the May 2026 BCH upgrade
                    </span>
                </motion.div>

                {/* Title */}
                <motion.h1
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    className="text-5xl md:text-7xl font-bold tracking-tight mb-6"
                >
                    <span className="text-foreground">The Intent Protocol </span>
                    <span className="text-gradient-primary">Knowledge Base</span>
                </motion.h1>

                {/* Subtitle */}
                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed"
                >
                    Field-tested guides for traders, solvers, and integrators building on Bitcoin Cash.
                </motion.p>

                {/* Search Bar */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                    className="max-w-2xl mx-auto relative"
                >
                    {/* Glow effect on focus */}
                    <div
                        className={cn(
                            'absolute -inset-1 bg-gradient-to-r from-primary/40 via-emerald-500/40 to-primary/40 rounded-2xl blur-xl transition-opacity duration-500',
                            isFocused ? 'opacity-100' : 'opacity-0'
                        )}
                    />

                    <div className="relative">
                        <div
                            className={cn(
                                'bento-card p-2 transition-all duration-300',
                                isFocused && 'border-primary/50'
                            )}
                        >
                            <div className="relative flex items-center">
                                <Search
                                    className={cn(
                                        'absolute left-4 h-5 w-5 transition-colors duration-300',
                                        isFocused ? 'text-primary' : 'text-muted-foreground'
                                    )}
                                />
                                <Input
                                    placeholder="Search for guides, integrations, or troubleshooting…"
                                    className="pl-12 pr-20 h-14 text-lg bg-transparent border-0 shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/60"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    onKeyDown={handleSearch}
                                    onFocus={() => setIsFocused(true)}
                                    onBlur={() => setIsFocused(false)}
                                />
                                <div className="absolute right-4 hidden md:flex items-center gap-1">
                                    <kbd className="px-2 py-1 text-xs font-medium bg-muted text-muted-foreground rounded-md border border-border">
                                        Enter ↵
                                    </kbd>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Popular searches */}
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.4 }}
                    className="max-w-2xl mx-auto mt-5 flex flex-wrap items-center justify-center gap-2 text-xs"
                >
                    <span className="text-muted-foreground/80 mr-1">Popular:</span>
                    {POPULAR_SEARCHES.map((p) => (
                        <button
                            key={p}
                            type="button"
                            onClick={() => submit(p)}
                            className={cn(
                                'px-3 py-1.5 rounded-full',
                                'bg-white/60 dark:bg-zinc-900/60 backdrop-blur-md',
                                'border border-zinc-200/70 dark:border-zinc-800/70',
                                'text-muted-foreground hover:text-foreground',
                                'hover:border-primary/40 hover:bg-primary/5',
                                'transition-all duration-200'
                            )}
                        >
                            {p}
                        </button>
                    ))}
                </motion.div>

                {/* Stats strip */}
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.5 }}
                    className="max-w-xl mx-auto mt-10 grid grid-cols-3 gap-4"
                >
                    <Stat icon={<BookOpen className="w-3.5 h-3.5" />} label="Articles" value={String(totalArticles)} />
                    <Stat icon={<Layers className="w-3.5 h-3.5" />} label="Categories" value={String(totalCategories)} />
                    <Stat icon={<Zap className="w-3.5 h-3.5" />} label="Avg read" value="4 min" />
                </motion.div>
            </div>
        </div>
    );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                <span className="text-primary">{icon}</span>
                {label}
            </div>
            <div className="text-xl font-bold tracking-tight tabular-nums">{value}</div>
        </div>
    );
}
