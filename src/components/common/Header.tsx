import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerTrigger, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import { Menu, ChevronDown, BookOpen, ArrowLeftRight, ChevronRight, Compass, Wallet, Globe, Puzzle, FileText, Zap, Sparkles } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { ConnectWalletButton } from '@/components/connect-wallet-button';
import { TokenSearchModal } from '@/components/common/TokenSearchModal';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useWDK } from '@/context/WDKProvider';

import { MeshNavDropdown, MESH_PAGES } from '@/components/common/MeshNavDropdown';
import { TradeNavDropdown } from '@/components/common/TradeNavDropdown';
import { LogoMenuDropdown } from '@/components/common/LogoMenuDropdown';

// ── Social Icons (used in mobile drawer footer) ───────────────────────────────
const XIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" /></svg>
);
const DiscordIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" /></svg>
);
const MediumIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M13.54 12a6.8 6.8 0 01-6.77 6.82A6.8 6.8 0 010 12a6.8 6.8 0 016.77-6.82A6.8 6.8 0 0113.54 12zM20.96 12c0 3.54-1.51 6.42-3.38 6.42-1.87 0-3.39-2.88-3.39-6.42s1.52-6.42 3.39-6.42c1.87 0 3.38 2.88 3.38 6.42M24 12c0 3.17-.53 5.75-1.19 5.75-.66 0-1.19-2.58-1.19-5.75s.53-5.75 1.19-5.75C23.47 6.25 24 8.83 24 12z" /></svg>
);

const APP_VERSION = '0.1.0';

// ── Mobile drawer: "Explore" section (marketing pages) ────────────────────────
const MOBILE_EXPLORE_ITEMS: { name: string; path: string; icon: LucideIcon }[] = [
    { name: 'Admin Analytics', path: '/admin', icon: Zap },
    { name: 'Intent Wallet', path: '/wallet', icon: Wallet },
    { name: 'Features', path: '/features', icon: Zap },
    { name: 'Ecosystem', path: '/ecosystem', icon: Globe },
    { name: 'Integrate', path: '/integrate', icon: Puzzle },
    { name: 'Pool Overview', path: '/mesh-landing', icon: Sparkles },
];

export function Header() {
    const [isOpen, setIsOpen] = useState(false);
    const [meshMobileOpen, setMeshMobileOpen] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const location = useLocation();
    const wdk = useWDK();
    const isMainnet = wdk.bchNetwork === 'mainnet';

    // Listen for search open events dispatched from the wallet pill
    useEffect(() => {
        const handler = () => setSearchOpen(true);
        document.addEventListener('open-token-search', handler);
        return () => document.removeEventListener('open-token-search', handler);
    }, []);

    // Auto-close mobile drawer when resizing to desktop viewport (>= 1024px)
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth >= 1024) {
                setIsOpen(false);
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // ── Mobile Drawer ─────────────────────────────────────────────────────────
    const renderMobileMenu = () => (
        <Drawer open={isOpen} onOpenChange={setIsOpen} shouldScaleBackground={false}>
            <DrawerTrigger asChild>
                <Button variant="ghost" size="icon" className="bg-white/[0.02] border border-white/5 backdrop-blur-md hover:bg-white/10 shrink-0 h-11 w-11 rounded-xl transition-all duration-300 group hover:scale-105 active:scale-95 relative overflow-hidden">
                    <Menu className="h-6 w-6 stroke-[2px] text-zinc-300 group-hover:text-emerald-400 transition-colors duration-300 relative z-10" />
                    <span className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent scale-0 group-hover:scale-100 transition-transform duration-300 rounded-xl origin-center" />
                </Button>
            </DrawerTrigger>
            <DrawerContent className="max-h-[85vh] flex flex-col p-0 overflow-hidden">
                {/* Screen-reader accessibility labels required by Radix Dialog */}
                <DrawerTitle className="sr-only">Navigation Menu</DrawerTitle>
                <DrawerDescription className="sr-only">Mobile navigation menu for BCH Intents</DrawerDescription>
                <div className="flex flex-col gap-4 overflow-y-auto px-5 pb-5 pt-1 flex-1">
                    {/* Mobile menu logo header */}
                    <div className="flex items-center gap-2 pb-3 border-b border-white/10">
                        <img
                            src="/assets/bchintentslogo.png"
                            alt="BCH Intents"
                            className="w-10 h-10 object-contain -ml-1 shrink-0"
                        />
                        <span className="font-heading font-black text-base tracking-tighter text-white leading-tight flex items-center">
                            BCH <span className="text-emerald-500 ml-1">Intents</span>
                            <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 ml-2">
                                Beta
                            </span>
                        </span>
                    </div>

                    {/* ─── Section: APP (Order: Trade, Explore, Pool, Portfolio, Knowledgehub) ─── */}
                    <nav className="flex flex-col gap-1">
                        <div className="px-3 pb-1">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">App</span>
                        </div>

                        {/* 1. Trade link */}
                        <Link
                            to="/trade"
                            onClick={() => setIsOpen(false)}
                            className={cn(
                                "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 group hover:translate-x-1",
                                location.pathname === '/trade'
                                    ? "bg-gradient-to-r from-emerald-500/10 to-transparent border border-emerald-500/20"
                                    : "hover:bg-white/[0.03] border border-transparent hover:border-white/[0.05]"
                            )}
                        >
                            <span className={cn(
                                "flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-300 shrink-0",
                                location.pathname === '/trade'
                                    ? "bg-emerald-500/20 text-emerald-400"
                                    : "bg-[#111] text-zinc-400 border border-white/5 group-hover:text-emerald-400 group-hover:border-emerald-500/30"
                            )}>
                                <ArrowLeftRight className="h-4 w-4" />
                            </span>
                            <span className={cn(
                                "flex-1 text-sm font-semibold tracking-wide transition-colors",
                                location.pathname === '/trade' ? "text-white" : "text-zinc-400 group-hover:text-zinc-200"
                            )}>
                                Trade
                            </span>
                            <ChevronRight className={cn(
                                "h-4 w-4 transition-all duration-300",
                                location.pathname === '/trade' ? "text-emerald-400 opacity-100" : "text-zinc-600 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:text-emerald-400 group-hover:translate-x-0"
                            )} />
                        </Link>

                        {/* 2. Explore link */}
                        <Link
                            to="/explore"
                            onClick={() => setIsOpen(false)}
                            className={cn(
                                "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 group hover:translate-x-1",
                                location.pathname === '/explore' || location.pathname.startsWith('/explore/')
                                    ? "bg-gradient-to-r from-emerald-500/10 to-transparent border border-emerald-500/20"
                                    : "hover:bg-white/[0.03] border border-transparent hover:border-white/[0.05]"
                            )}
                        >
                            <span className={cn(
                                "flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-300 shrink-0",
                                location.pathname === '/explore' || location.pathname.startsWith('/explore/')
                                    ? "bg-emerald-500/20 text-emerald-400"
                                    : "bg-[#111] text-zinc-400 border border-white/5 group-hover:text-emerald-400 group-hover:border-emerald-500/30"
                            )}>
                                <Compass className="h-4 w-4" />
                            </span>
                            <span className={cn(
                                "flex-1 text-sm font-semibold tracking-wide transition-colors",
                                location.pathname === '/explore' || location.pathname.startsWith('/explore/') ? "text-white" : "text-zinc-400 group-hover:text-zinc-200"
                            )}>
                                Explore
                            </span>
                            <ChevronRight className={cn(
                                "h-4 w-4 transition-all duration-300",
                                location.pathname === '/explore' || location.pathname.startsWith('/explore/') ? "text-emerald-400 opacity-100" : "text-zinc-600 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:text-emerald-400 group-hover:translate-x-0"
                            )} />
                        </Link>

                        {/* 3. Pool expandable group */}
                        <div className="flex flex-col">
                            <button
                                type="button"
                                onClick={() => setMeshMobileOpen(!meshMobileOpen)}
                                className={cn(
                                    "flex items-center justify-between w-full px-3 py-2.5 rounded-xl transition-all duration-300 group hover:translate-x-1",
                                    location.pathname.startsWith('/mesh') || location.pathname === '/orderbook'
                                        ? "bg-gradient-to-r from-emerald-500/10 to-transparent border border-emerald-500/20"
                                        : "hover:bg-white/[0.03] border border-transparent hover:border-white/[0.05]"
                                )}
                            >
                                <div className="flex items-center gap-3">
                                    <span className={cn(
                                        "flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-300 shrink-0",
                                        location.pathname.startsWith('/mesh') || location.pathname === '/orderbook'
                                            ? "bg-emerald-500/20 text-emerald-400"
                                            : "bg-[#111] text-zinc-400 border border-white/5 group-hover:text-emerald-400 group-hover:border-emerald-500/30"
                                    )}>
                                        <Zap className="h-4 w-4" />
                                    </span>
                                    <span className={cn(
                                        "text-sm font-semibold tracking-wide transition-colors",
                                        location.pathname.startsWith('/mesh') || location.pathname === '/orderbook' ? "text-white" : "text-zinc-400 group-hover:text-zinc-200"
                                    )}>
                                        Pool
                                    </span>
                                </div>
                                <ChevronDown className={cn(
                                    "h-4 w-4 text-zinc-500 transition-transform duration-200",
                                    meshMobileOpen && "rotate-180 text-emerald-400"
                                )} />
                            </button>

                            {meshMobileOpen && (
                                <div className="flex flex-col gap-1 pl-6 mt-1 mb-1 border-l border-white/10 ml-6">
                                    {MESH_PAGES.map((page) => {
                                        const Icon = page.icon;
                                        const currentUrl = location.pathname + location.search;
                                        const isActive =
                                            currentUrl === page.path ||
                                            (page.path === '/mesh?tab=positions' && location.pathname === '/mesh' && (!location.search || currentUrl.startsWith('/mesh?tab=positions&'))) ||
                                            (page.path === location.pathname);
                                        return (
                                            <Link
                                                key={page.path}
                                                to={page.path}
                                                onClick={() => setIsOpen(false)}
                                                className={cn(
                                                    "flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200",
                                                    isActive
                                                        ? "text-emerald-400 bg-emerald-500/10"
                                                        : "text-zinc-400 hover:text-white hover:bg-white/[0.03]"
                                                )}
                                            >
                                                <Icon className="h-3.5 w-3.5 shrink-0" />
                                                <span>{page.name}</span>
                                            </Link>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* 4. Portfolio link */}
                        <Link
                            to="/portfolio"
                            onClick={() => setIsOpen(false)}
                            className={cn(
                                "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 group hover:translate-x-1",
                                location.pathname === '/portfolio' || location.pathname.startsWith('/portfolio/')
                                    ? "bg-gradient-to-r from-emerald-500/10 to-transparent border border-emerald-500/20"
                                    : "hover:bg-white/[0.03] border border-transparent hover:border-white/[0.05]"
                            )}
                        >
                            <span className={cn(
                                "flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-300 shrink-0",
                                location.pathname === '/portfolio' || location.pathname.startsWith('/portfolio/')
                                    ? "bg-emerald-500/20 text-emerald-400"
                                    : "bg-[#111] text-zinc-400 border border-white/5 group-hover:text-emerald-400 group-hover:border-emerald-500/30"
                            )}>
                                <Wallet className="h-4 w-4" />
                            </span>
                            <span className={cn(
                                "flex-1 text-sm font-semibold tracking-wide transition-colors",
                                location.pathname === '/portfolio' || location.pathname.startsWith('/portfolio/') ? "text-white" : "text-zinc-400 group-hover:text-zinc-200"
                            )}>
                                Portfolio
                            </span>
                            <ChevronRight className={cn(
                                "h-4 w-4 transition-all duration-300",
                                location.pathname === '/portfolio' || location.pathname.startsWith('/portfolio/') ? "text-emerald-400 opacity-100" : "text-zinc-600 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:text-emerald-400 group-hover:translate-x-0"
                            )} />
                        </Link>

                        {/* 5. Knowledgehub link */}
                        <Link
                            to="/kb"
                            onClick={() => setIsOpen(false)}
                            className={cn(
                                "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 group hover:translate-x-1",
                                location.pathname === '/kb' || location.pathname.startsWith('/kb/')
                                    ? "bg-gradient-to-r from-emerald-500/10 to-transparent border border-emerald-500/20"
                                    : "hover:bg-white/[0.03] border border-transparent hover:border-white/[0.05]"
                            )}
                        >
                            <span className={cn(
                                "flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-300 shrink-0",
                                location.pathname === '/kb' || location.pathname.startsWith('/kb/')
                                    ? "bg-emerald-500/20 text-emerald-400"
                                    : "bg-[#111] text-zinc-400 border border-white/5 group-hover:text-emerald-400 group-hover:border-emerald-500/30"
                            )}>
                                <BookOpen className="h-4 w-4" />
                            </span>
                            <span className={cn(
                                "flex-1 text-sm font-semibold tracking-wide transition-colors",
                                location.pathname === '/kb' || location.pathname.startsWith('/kb/') ? "text-white" : "text-zinc-400 group-hover:text-zinc-200"
                            )}>
                                Knowledgehub
                            </span>
                            <ChevronRight className={cn(
                                "h-4 w-4 transition-all duration-300",
                                location.pathname === '/kb' || location.pathname.startsWith('/kb/') ? "text-emerald-400 opacity-100" : "text-zinc-600 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:text-emerald-400 group-hover:translate-x-0"
                            )} />
                        </Link>
                    </nav>

                    {/* ─── Section: EXPLORE (marketing pages) ─── */}
                    <div className="pt-2 border-t border-white/10">
                        <div className="px-3 pb-1">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Explore</span>
                        </div>
                        <nav className="flex flex-col gap-1">
                            {MOBILE_EXPLORE_ITEMS.map((item) => {
                                const isActive = location.pathname === item.path;
                                return (
                                    <Link
                                        key={item.path}
                                        to={item.path}
                                        onClick={() => setIsOpen(false)}
                                        className={cn(
                                            "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 group hover:translate-x-1",
                                            isActive
                                                ? "bg-gradient-to-r from-emerald-500/10 to-transparent border border-emerald-500/20"
                                                : "hover:bg-white/[0.03] border border-transparent hover:border-white/[0.05]"
                                        )}
                                    >
                                        <span className={cn(
                                            "flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-300 shrink-0",
                                            isActive
                                                ? "bg-emerald-500/20 text-emerald-400"
                                                : "bg-[#111] text-zinc-400 border border-white/5 group-hover:text-emerald-400 group-hover:border-emerald-500/30"
                                        )}>
                                            <item.icon className="h-4 w-4" />
                                        </span>
                                        <span className={cn(
                                            "flex-1 text-sm font-semibold tracking-wide transition-colors",
                                            isActive ? "text-white" : "text-zinc-400 group-hover:text-zinc-200"
                                        )}>
                                            {item.name}
                                        </span>
                                        <ChevronRight className={cn(
                                            "h-4 w-4 transition-all duration-300",
                                            isActive ? "text-emerald-400 opacity-100" : "text-zinc-600 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:text-emerald-400 group-hover:translate-x-0"
                                        )} />
                                    </Link>
                                );
                            })}
                        </nav>
                    </div>

                    {/* ─── Section: RESOURCES ─── */}
                    <div className="pt-2 border-t border-white/10">
                        <div className="px-3 pb-1">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Resources</span>
                        </div>
                        <nav className="flex flex-col gap-1">
                            <a
                                href="https://docs.intentsprotocol.xyz/"
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => setIsOpen(false)}
                                className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 group hover:translate-x-1 hover:bg-white/[0.03] border border-transparent hover:border-white/[0.05]"
                            >
                                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#111] text-zinc-400 border border-white/5 group-hover:text-emerald-400 group-hover:border-emerald-500/30 transition-all duration-300 shrink-0">
                                    <FileText className="h-4 w-4" />
                                </span>
                                <span className="flex-1 text-sm font-semibold tracking-wide text-zinc-400 group-hover:text-zinc-200 transition-colors">Docs</span>
                                <ChevronRight className="h-4 w-4 text-zinc-600 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:text-emerald-400 group-hover:translate-x-0 transition-all duration-300" />
                            </a>
                        </nav>
                    </div>

                    {/* ─── Footer: socials + version ─── */}
                    <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                        <div className="flex gap-2">
                            <a href="https://x.com/bchintents" target="_blank" rel="noopener noreferrer" aria-label="X" className="w-9 h-9 flex items-center justify-center rounded-xl text-zinc-400 hover:text-emerald-400 border border-white/5 hover:border-emerald-500/50 transition-all duration-300">
                                <XIcon />
                            </a>
                            <a href="https://docs.intentsprotocol.xyz/" target="_blank" rel="noopener noreferrer" aria-label="Docs" className="w-9 h-9 flex items-center justify-center rounded-xl text-zinc-400 hover:text-emerald-400 border border-white/5 hover:border-emerald-500/50 transition-all duration-300">
                                <BookOpen className="w-4 h-4" />
                            </a>
                            <a href="https://medium.com/@bchintents" target="_blank" rel="noopener noreferrer" aria-label="Medium" className="w-9 h-9 flex items-center justify-center rounded-xl text-zinc-400 hover:text-emerald-400 border border-white/5 hover:border-emerald-500/50 transition-all duration-300">
                                <MediumIcon />
                            </a>
                            <a href="#" target="_blank" rel="noopener noreferrer" aria-label="Discord" className="w-9 h-9 flex items-center justify-center rounded-xl text-zinc-400 hover:text-emerald-400 border border-white/5 hover:border-emerald-500/50 transition-all duration-300">
                                <DiscordIcon />
                            </a>
                        </div>
                        <div className="text-[11px] text-zinc-500 tracking-wide">
                            v<span className="text-emerald-400/80 font-semibold">{APP_VERSION}</span>
                        </div>
                    </div>
                </div>
            </DrawerContent>
        </Drawer>
    );

    return (
        <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#050505]/70 backdrop-blur-xl supports-[backdrop-filter]:bg-[#050505]/60 transition-all duration-300">
            <div className="container mx-auto px-4 h-20 flex items-center justify-between">

                {/* ── Left Section: Logo + Desktop Nav ── */}
                <div className="flex items-center gap-0 md:gap-8 lg:gap-12 shrink-0">
                    {/* Desktop: Full Logo with hoverable popup menu starting from left-0 */}
                    <div className="hidden lg:flex items-center">
                        <LogoMenuDropdown />
                    </div>

                    {/* Mobile: Logo image only without text or dropdown */}
                    <div className="flex lg:hidden items-center">
                        <Link to="/" className="flex items-center group shrink-0">
                            <img
                                src="/assets/bchintentslogo.png"
                                alt="BCH Intents Logo"
                                className="w-16 h-16 -ml-2 object-contain"
                            />
                        </Link>
                    </div>

                    {/* Mobile Menu Trigger */}
                    <div className="flex lg:hidden ml-1 z-10 relative">
                        {renderMobileMenu()}
                    </div>

                    {/* Desktop Nav — unified order: Trade, Explore, Pool, Portfolio, Knowledgehub */}
                    <nav className="hidden lg:flex items-center gap-6 xl:gap-8">
                        {/* 1. Trade Dropdown */}
                        <TradeNavDropdown />

                        {/* 2. Explore */}
                        <Link
                            to="/explore"
                            className={cn(
                                "text-[15px] font-semibold transition-all duration-300 hover:text-white hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)] relative group py-2",
                                (location.pathname === '/explore' || location.pathname.startsWith('/explore/'))
                                    ? "text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]"
                                    : "text-zinc-300"
                            )}
                        >
                            Explore
                            <span className={cn(
                                "absolute bottom-0 left-0 w-full h-[2px] bg-emerald-400 scale-x-0 transition-transform duration-300 group-hover:scale-x-100 origin-left shadow-[0_0_8px_rgba(52,211,153,0.8)]",
                                (location.pathname === '/explore' || location.pathname.startsWith('/explore/')) && "scale-x-100"
                            )} />
                        </Link>

                        {/* 3. Pool Dropdown Menu */}
                        <MeshNavDropdown />

                        {/* 4. Portfolio */}
                        <Link
                            to="/portfolio"
                            className={cn(
                                "text-[15px] font-semibold transition-all duration-300 hover:text-white hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)] relative group py-2",
                                (location.pathname === '/portfolio' || location.pathname.startsWith('/portfolio/'))
                                    ? "text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]"
                                    : "text-zinc-300"
                            )}
                        >
                            Portfolio
                            <span className={cn(
                                "absolute bottom-0 left-0 w-full h-[2px] bg-emerald-400 scale-x-0 transition-transform duration-300 group-hover:scale-x-100 origin-left shadow-[0_0_8px_rgba(52,211,153,0.8)]",
                                (location.pathname === '/portfolio' || location.pathname.startsWith('/portfolio/')) && "scale-x-100"
                            )} />
                        </Link>

                        {/* 5. Knowledgehub */}
                        <Link
                            to="/kb"
                            className={cn(
                                "text-[15px] font-semibold transition-all duration-300 hover:text-white hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)] relative group py-2",
                                (location.pathname === '/kb' || location.pathname.startsWith('/kb/'))
                                    ? "text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]"
                                    : "text-zinc-300"
                            )}
                        >
                            Knowledgehub
                            <span className={cn(
                                "absolute bottom-0 left-0 w-full h-[2px] bg-emerald-400 scale-x-0 transition-transform duration-300 group-hover:scale-x-100 origin-left shadow-[0_0_8px_rgba(52,211,153,0.8)]",
                                (location.pathname === '/kb' || location.pathname.startsWith('/kb/')) && "scale-x-100"
                            )} />
                        </Link>
                    </nav>
                </div>

                {/* ── Right Section: Search + Network toggle + Connect Wallet ── */}
                <div className="hidden lg:flex items-center gap-3 shrink-0">
                    {/* Programmatic modal for cross-component open-token-search event */}
                    <TokenSearchModal open={searchOpen} onOpenChange={setSearchOpen}>
                        <span />
                    </TokenSearchModal>
                    {/* Network segmented toggle — sliding indicator */}
                    <div
                        role="tablist"
                        aria-label="Network"
                        className={cn(
                            "relative flex h-10 w-[176px] items-center rounded-xl p-1 bg-[#0A0A0A]/60 backdrop-blur-xl border transition-all duration-300",
                            isMainnet
                                ? "border-emerald-500/30 shadow-[0_0_0_1px_rgba(16,185,129,0.08)_inset,0_4px_20px_-8px_rgba(16,185,129,0.4)]"
                                : "border-white/10 shadow-[0_0_0_1px_rgba(255,255,255,0.04)_inset]"
                        )}
                    >
                        {/* Sliding indicator — spring-eased switch */}
                        <span
                            aria-hidden
                            className={cn(
                                "absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-lg",
                                "transition-[left,background-color,box-shadow] duration-300 ease-[cubic-bezier(0.34,1.4,0.64,1)]",
                                isMainnet
                                    ? "left-[calc(50%+0px)] bg-gradient-to-br from-emerald-500/30 to-emerald-600/20 border border-emerald-400/40 shadow-[0_0_12px_rgba(16,185,129,0.4)]"
                                    : "left-1 bg-white/[0.08] border border-white/10"
                            )}
                        />

                        <button
                            role="tab"
                            aria-selected={!isMainnet}
                            onClick={() => wdk.setBchNetwork('chipnet')}
                            className={cn(
                                "relative z-10 flex-1 h-8 rounded-lg text-xs font-semibold transition-colors duration-200 active:scale-95",
                                !isMainnet ? "text-white" : "text-zinc-500 hover:text-zinc-300"
                            )}
                        >
                            Testnet
                        </button>
                        <button
                            role="tab"
                            aria-selected={isMainnet}
                            onClick={() => wdk.setBchNetwork('mainnet')}
                            className={cn(
                                "relative z-10 flex-1 h-8 rounded-lg text-xs font-semibold transition-colors duration-200 active:scale-95 flex items-center justify-center gap-1",
                                isMainnet ? "text-emerald-300" : "text-zinc-500 hover:text-zinc-300"
                            )}
                        >
                            {isMainnet && (
                                <span className="relative flex h-1.5 w-1.5">
                                    <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/70" />
                                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                </span>
                            )}
                            Mainnet
                        </button>
                    </div>

                    <ConnectWalletButton />
                </div>

                {/* ── Mobile: right side (Connect Wallet only) ── */}
                <div className="flex lg:hidden items-center gap-2 ml-auto shrink-0">
                    <ConnectWalletButton />
                </div>
            </div>
        </header>
    );
}

export default Header;
