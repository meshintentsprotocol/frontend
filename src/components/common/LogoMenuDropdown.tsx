import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, ChevronDown, Zap, Globe, Puzzle, Sparkles, FileText, ExternalLink, Wallet, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Social Icons ──────────────────────────────────────────────────────────────
const XIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" /></svg>
);
const MediumIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><path d="M13.54 12a6.8 6.8 0 01-6.77 6.82A6.8 6.8 0 010 12a6.8 6.8 0 016.77-6.82A6.8 6.8 0 0113.54 12zM20.96 12c0 3.54-1.51 6.42-3.38 6.42-1.87 0-3.39-2.88-3.39-6.42s1.52-6.42 3.39-6.42c1.87 0 3.38 2.88 3.38 6.42M24 12c0 3.17-.53 5.75-1.19 5.75-.66 0-1.19-2.58-1.19-5.75s.53-5.75 1.19-5.75C23.47 6.25 24 8.83 24 12z" /></svg>
);
const DiscordIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" /></svg>
);

// ── Menu data ─────────────────────────────────────────────────────────────────
interface ExploreItem {
    name: string;
    path: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
}

const EXPLORE_ITEMS: ExploreItem[] = [
    { name: 'Cham Wallet', path: '/wallet', description: 'Crosschain Mobile & Extension', icon: Wallet },
    { name: 'Features', path: '/features', description: 'Core protocol capabilities', icon: Zap },
    { name: 'Ecosystem', path: '/ecosystem', description: 'Partners & integrations', icon: Globe },
    { name: 'Integrate', path: '/integrate', description: 'Add BCH Intents to your app', icon: Puzzle },
    { name: 'MCP for AI Agents', path: '/mcp', description: 'Connect Claude, Cursor, ChatGPT', icon: Bot },
    { name: 'Pool Overview', path: '/mesh-landing', description: 'Curves & liquidity intro', icon: Sparkles },
];

const SOCIAL_LINKS = [
    { label: 'X', href: 'https://x.com/bchintents', icon: XIcon },
    { label: 'Medium', href: 'https://medium.com/@bchintents', icon: MediumIcon },
    { label: 'Discord', href: '#', icon: DiscordIcon },
];

// ── Component ─────────────────────────────────────────────────────────────────
export function LogoMenuDropdown() {
    const [isOpen, setIsOpen] = useState(false);
    const location = useLocation();
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const handleMouseEnter = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        setIsOpen(true);
    };

    const handleMouseLeave = () => {
        timeoutRef.current = setTimeout(() => {
            setIsOpen(false);
        }, 180);
    };

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    // Close on route change
    useEffect(() => {
        setIsOpen(false);
    }, [location.pathname]);

    return (
        <div
            className="relative inline-flex items-center"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {/* Whole Logo Header & Chevron trigger */}
            <div className="flex items-center group cursor-pointer">
                <Link
                    to="/"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center shrink-0"
                >
                    <img
                        src="/assets/bchintentslogo.png"
                        alt="BCH Intents Logo"
                        className="w-20 h-20 -ml-2 md:-ml-2 md:-mr-4 object-contain transition-transform group-hover:scale-105 duration-300"
                    />
                    <span className="font-heading font-black text-2xl tracking-tighter text-white drop-shadow-sm group-hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.3)] transition-all flex items-baseline">
                        BCH <span className="text-emerald-500 group-hover:text-emerald-400 transition-colors ml-1">Intents</span>
                        <span className="relative -top-2.5 ml-1 px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-[4px] shadow-[0_0_8px_rgba(16,185,129,0.2)] leading-none select-none">
                            BETA
                        </span>
                    </span>
                </Link>

                {/* Chevron icon button */}
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsOpen((v) => !v);
                    }}
                    className={cn(
                        'flex items-center justify-center w-6 h-6 ml-1 rounded-lg transition-all duration-200',
                        'hover:bg-white/[0.06] border border-transparent hover:border-white/10',
                        isOpen && 'bg-white/[0.06] border-white/10'
                    )}
                    aria-label="Explore menu"
                >
                    <ChevronDown
                        className={cn(
                            'w-3.5 h-3.5 text-zinc-400 group-hover:text-white transition-all duration-200',
                            isOpen && 'rotate-180 text-white'
                        )}
                    />
                </button>
            </div>

            {/* Dropdown Panel — displayed from where the logo starts (left-0) */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 6, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 4, scale: 0.98 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        className="absolute top-full left-0 pt-2.5 z-50 w-[380px] pointer-events-auto"
                    >
                        {/* Invisible hover bridge to prevent mouse-leave jitter */}
                        <div className="absolute -top-3 left-0 right-0 h-3" />

                        <div className="rounded-2xl border border-white/10 bg-[#0C0C0E]/95 backdrop-blur-2xl shadow-[0_16px_48px_rgba(0,0,0,0.8)] p-3 overflow-hidden">
                            {/* Header label */}
                            <div className="px-1.5 pb-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                                    Protocol & Ecosystem
                                </span>
                            </div>

                            {/* 2-Column Grid */}
                            <div className="grid grid-cols-2 gap-1.5">
                                {EXPLORE_ITEMS.map((item) => {
                                    const Icon = item.icon;
                                    const isActive = location.pathname === item.path;
                                    return (
                                        <Link
                                            key={item.path}
                                            to={item.path}
                                            onClick={() => setIsOpen(false)}
                                            className={cn(
                                                'flex flex-col p-2.5 rounded-xl transition-all duration-200 group/item border',
                                                isActive
                                                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                                    : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.06] hover:border-white/10 text-zinc-300 hover:text-white'
                                            )}
                                        >
                                            <div className="flex items-center gap-2 mb-1">
                                                <div
                                                    className={cn(
                                                        'flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors',
                                                        isActive
                                                            ? 'bg-emerald-500/20 text-emerald-400'
                                                            : 'bg-[#18181B] text-zinc-400 group-hover/item:text-emerald-400'
                                                    )}
                                                >
                                                    <Icon className="h-3.5 w-3.5" />
                                                </div>
                                                <span
                                                    className={cn(
                                                        'text-xs font-semibold tracking-tight transition-colors',
                                                        isActive ? 'text-emerald-400' : 'text-zinc-200 group-hover/item:text-white'
                                                    )}
                                                >
                                                    {item.name}
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-zinc-500 line-clamp-1 group-hover/item:text-zinc-400 pl-0.5">
                                                {item.description}
                                            </p>
                                        </Link>
                                    );
                                })}
                            </div>

                            {/* Divider */}
                            <div className="my-2 border-t border-white/[0.06]" />

                            {/* Bottom row: Docs Link + Socials */}
                            <div className="flex items-center justify-between px-1.5 pt-0.5">
                                <Link
                                    to="/docs"
                                    onClick={() => setIsOpen(false)}
                                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-zinc-400 hover:text-emerald-400 hover:bg-white/[0.04] transition-all group/doc"
                                >
                                    <FileText className="w-3.5 h-3.5 text-zinc-400 group-hover/doc:text-emerald-400" />
                                    <span>Documentation</span>
                                </Link>

                                <div className="flex items-center gap-1">
                                    {SOCIAL_LINKS.map((social) => {
                                        const SocialIcon = social.icon;
                                        return (
                                            <a
                                                key={social.label}
                                                href={social.href}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                aria-label={social.label}
                                                className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-400 hover:text-emerald-400 hover:bg-white/[0.06] border border-transparent hover:border-white/10 transition-all duration-200"
                                            >
                                                <SocialIcon />
                                            </a>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
