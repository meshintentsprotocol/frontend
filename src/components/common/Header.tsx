import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerTrigger } from '@/components/ui/drawer';
import { Menu, ChevronDown, BookOpen, ArrowLeftRight, ChevronRight, Compass, Wallet, Globe, Puzzle, FileText, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { ConnectWalletButton } from '@/components/connect-wallet-button';
import { TokenSearchModal } from '@/components/common/TokenSearchModal';
import { AnimatedTradeButton } from '@/components/ui/animated-trade-button';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useWDK } from '@/context/WDKProvider';

// Define Social Icons
const XIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" /></svg>
);
const DiscordIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" /></svg>
);
// Medium Icon
const MediumIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M13.54 12a6.8 6.8 0 01-6.77 6.82A6.8 6.8 0 010 12a6.8 6.8 0 016.77-6.82A6.8 6.8 0 0113.54 12zM20.96 12c0 3.54-1.51 6.42-3.38 6.42-1.87 0-3.39-2.88-3.39-6.42s1.52-6.42 3.39-6.42c1.87 0 3.38 2.88 3.38 6.42M24 12c0 3.17-.53 5.75-1.19 5.75-.66 0-1.19-2.58-1.19-5.75s.53-5.75 1.19-5.75C23.47 6.25 24 8.83 24 12z" /></svg>
);


const APP_VERSION = '0.1.0';

export function Header() {
    const [isOpen, setIsOpen] = useState(false);
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

    // Determine if it's a marketing/landing page
    const isLandingPage = ['/', '/home', '/ecosystem', '/integrate', '/features'].includes(location.pathname);

    // Launch App Nav Items
    const appPrimaryNavItems: { name: string; path: string; icon: LucideIcon }[] = [
        { name: 'Trade', path: '/trade', icon: ArrowLeftRight },
        { name: 'Explore', path: '/explore', icon: Compass },
        { name: 'Portfolio', path: '/portfolio', icon: Wallet },
        { name: 'Knowledge Base', path: '/kb', icon: BookOpen },
    ];


    const landingNavItems: { name: string; path: string; icon: LucideIcon }[] = [
        { name: 'Trade', path: '/trade', icon: ArrowLeftRight },
        { name: 'Features', path: '/features', icon: Zap },
        { name: 'Ecosystem', path: '/ecosystem', icon: Globe },
        { name: 'Integrate', path: '/integrate', icon: Puzzle },
    ];

    const renderMobileMenu = () => (
        <Drawer open={isOpen} onOpenChange={setIsOpen}>
            <DrawerTrigger asChild>
                <Button variant="ghost" size="icon" className="bg-white/[0.02] border border-white/5 backdrop-blur-md hover:bg-white/10 shrink-0 h-11 w-11 rounded-xl transition-all duration-300 group hover:scale-105 active:scale-95 relative overflow-hidden">
                    <Menu className="h-6 w-6 stroke-[2px] text-zinc-300 group-hover:text-emerald-400 transition-colors duration-300 relative z-10" />
                    <span className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent scale-0 group-hover:scale-100 transition-transform duration-300 rounded-xl origin-center" />
                </Button>
            </DrawerTrigger>
            <DrawerContent className="px-6 pb-6">
                <div className="flex flex-col gap-8 mt-2">
                    {/* Mobile menu logo header */}
                    <div className="flex items-center gap-2 pb-6 border-b border-white/10">
                        <img
                            src="/assets/bchintentslogo.png"
                            alt="BCH Intents"
                            className="w-14 h-14 object-contain -ml-1 shrink-0"
                        />
                        <span className="font-heading font-black text-xl tracking-tighter text-white leading-tight">
                            {isLandingPage ? (
                                <><span className="text-emerald-500">BCH </span>Intents Protocol</>
                            ) : (
                                <>BCH Intents <span className="text-emerald-500">Swap</span></>
                            )}
                        </span>
                    </div>

                    <nav className="flex flex-col gap-2.5">
                        {(isLandingPage ? landingNavItems : appPrimaryNavItems).map((item) => {
                            const isActive = location.pathname === item.path;
                            return (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    onClick={() => setIsOpen(false)}
                                    className={cn(
                                        "flex items-center gap-4 p-3 rounded-2xl transition-all duration-300 group hover:translate-x-1",
                                        isActive
                                            ? "bg-gradient-to-r from-emerald-500/10 to-transparent border border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.05)]"
                                            : "hover:bg-white/[0.03] border border-transparent hover:border-white/[0.05]"
                                    )}
                                >
                                    <span className={cn(
                                        "flex h-12 w-12 items-center justify-center rounded-xl transition-all duration-300 shrink-0",
                                        isActive
                                            ? "bg-emerald-500/20 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                                            : "bg-[#111] text-zinc-400 border border-white/5 group-hover:bg-[#151515] group-hover:text-emerald-400 group-hover:border-emerald-500/30"
                                    )}>
                                        <item.icon className={cn("h-5 w-5 transition-transform duration-300", isActive ? "scale-110" : "group-hover:scale-110")} />
                                    </span>
                                    <span className={cn(
                                        "flex-1 text-lg font-bold tracking-wide transition-colors",
                                        isActive ? "text-white" : "text-zinc-400 group-hover:text-zinc-200"
                                    )}>
                                        {item.name}
                                    </span>
                                    <ChevronRight className={cn(
                                        "h-5 w-5 transition-all duration-300",
                                        isActive ? "text-emerald-400 opacity-100 translate-x-0" : "text-zinc-600 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:text-emerald-400 group-hover:translate-x-0"
                                    )} />
                                </Link>
                            );
                        })}
                        {isLandingPage && (
                            <a
                                href="https://docs.intentsprotocol.xyz/"
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => setIsOpen(false)}
                                className="flex items-center gap-4 p-3 rounded-2xl transition-all duration-300 group hover:translate-x-1 hover:bg-white/[0.03] border border-transparent hover:border-white/[0.05]"
                            >
                                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#111] text-zinc-400 border border-white/5 group-hover:bg-[#151515] group-hover:text-emerald-400 group-hover:border-emerald-500/30 transition-all duration-300 shrink-0">
                                    <FileText className="h-5 w-5 transition-transform duration-300 group-hover:scale-110" />
                                </span>
                                <span className="flex-1 text-lg font-bold tracking-wide text-zinc-400 group-hover:text-zinc-200 transition-colors">Docs</span>
                                <ChevronRight className="h-5 w-5 text-zinc-600 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:text-emerald-400 group-hover:translate-x-0 transition-all duration-300" />
                            </a>
                        )}
                    </nav>

                    {!isLandingPage && (
                        <div className="pt-6 border-t border-white/10 flex flex-col gap-3">
                            {/* Mobile network segmented toggle */}
                            <div
                                role="tablist"
                                aria-label="Network"
                                className={cn(
                                    "relative flex h-12 items-center w-full rounded-xl p-1 bg-[#0A0A0A]/60 backdrop-blur-xl border transition-all duration-300",
                                    isMainnet
                                        ? "border-emerald-500/30 shadow-[0_0_0_1px_rgba(16,185,129,0.08)_inset,0_4px_20px_-8px_rgba(16,185,129,0.4)]"
                                        : "border-white/10"
                                )}
                            >
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
                                    onClick={() => { wdk.setBchNetwork('chipnet'); setIsOpen(false); }}
                                    className={cn(
                                        "relative z-10 flex-1 h-10 rounded-lg text-sm font-semibold transition-colors duration-200 active:scale-95",
                                        !isMainnet ? "text-white" : "text-zinc-500"
                                    )}
                                >
                                    Testnet
                                </button>
                                <button
                                    role="tab"
                                    aria-selected={isMainnet}
                                    onClick={() => { wdk.setBchNetwork('mainnet'); setIsOpen(false); }}
                                    className={cn(
                                        "relative z-10 flex-1 h-10 rounded-lg text-sm font-semibold transition-colors duration-200 active:scale-95 flex items-center justify-center gap-1.5",
                                        isMainnet ? "text-emerald-300" : "text-zinc-500"
                                    )}
                                >
                                    {isMainnet && (
                                        <span className="relative flex h-2 w-2">
                                            <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/70" />
                                            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                                        </span>
                                    )}
                                    Mainnet
                                </button>
                            </div>
                            <ConnectWalletButton className="w-full h-12 rounded-xl" />
                        </div>
                    )}

                    {/* ─── Footer: socials + version (both menus) ─── */}
                    <div className="pt-6 border-t border-white/10 flex flex-col items-center gap-4">
                        <div className="flex gap-3">
                            <a href="https://x.com/bchintents" target="_blank" rel="noopener noreferrer" aria-label="X" className="glass-subtle w-11 h-11 flex items-center justify-center rounded-2xl text-zinc-400 hover:text-emerald-400 border border-white/5 hover:border-emerald-500/50 hover:shadow-[0_0_15px_rgba(16,185,129,0.2)] transition-all duration-300 hover:-translate-y-1">
                                <XIcon />
                            </a>
                            <a href="https://docs.intentsprotocol.xyz/" target="_blank" rel="noopener noreferrer" aria-label="Docs" className="glass-subtle w-11 h-11 flex items-center justify-center rounded-2xl text-zinc-400 hover:text-emerald-400 border border-white/5 hover:border-emerald-500/50 hover:shadow-[0_0_15px_rgba(16,185,129,0.2)] transition-all duration-300 hover:-translate-y-1">
                                <BookOpen className="w-5 h-5" />
                            </a>
                            <a href="https://medium.com/@bchintents" target="_blank" rel="noopener noreferrer" aria-label="Medium" className="glass-subtle w-11 h-11 flex items-center justify-center rounded-2xl text-zinc-400 hover:text-emerald-400 border border-white/5 hover:border-emerald-500/50 hover:shadow-[0_0_15px_rgba(16,185,129,0.2)] transition-all duration-300 hover:-translate-y-1">
                                <MediumIcon />
                            </a>
                            <a href="#" target="_blank" rel="noopener noreferrer" aria-label="Discord" className="glass-subtle w-11 h-11 flex items-center justify-center rounded-2xl text-zinc-400 hover:text-emerald-400 border border-white/5 hover:border-emerald-500/50 hover:shadow-[0_0_15px_rgba(16,185,129,0.2)] transition-all duration-300 hover:-translate-y-1">
                                <DiscordIcon />
                            </a>
                        </div>
                        <div className="text-[11px] text-zinc-500 tracking-wide">
                            BCH Intents Swap <span className="text-emerald-400/80 font-semibold">v{APP_VERSION}</span>
                        </div>
                    </div>
                </div>
            </DrawerContent>
        </Drawer>
    );

    return (
        <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#050505]/70 backdrop-blur-xl supports-[backdrop-filter]:bg-[#050505]/60 transition-all duration-300">
            {/* Conditional container class to distribute items depending on layout */}
            <div className={cn(
                "container mx-auto px-4 h-20 flex items-center",
                isLandingPage ? "justify-between" : "justify-between"
            )}>

                {/* Left Section: Logo (& Nav optionally for App) */}
                <div className="flex items-center gap-0 md:gap-8 lg:gap-12 shrink-0">
                    {/* Logo - On landing pages it redirects to home, on app pages it redirects to trade or home, let's keep it to home */}
                    <Link to="/" className="flex items-center group shrink-0">
                        <img
                            src="/assets/bchintentslogo.png"
                            alt={isLandingPage ? "BCH Intents Protocol Logo" : "BCH Intents Swap Logo"}
                            className="w-20 h-20 -ml-2 md:-ml-2 md:-mr-4 object-contain transition-transform group-hover:scale-110 duration-300"
                        />
                        <span className="font-heading font-black text-2xl tracking-tighter hidden lg:block text-white drop-shadow-sm group-hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.3)] transition-all">
                            {isLandingPage ? (
                                <>
                                    <span className="text-emerald-500 group-hover:text-emerald-400 transition-colors">BCH </span>
                                    <span>Intents Protocol</span>
                                </>
                            ) : (
                                <>
                                    <span>BCH Intents </span>
                                    <span className="text-emerald-500 group-hover:text-emerald-400 transition-colors">Swap</span>
                                </>
                            )}
                        </span>
                    </Link>

                    {/* Mobile Menu Trigger (next to logo on DApp side) */}
                    {!isLandingPage && (
                        <div className="flex lg:hidden ml-[-4px] md:ml-[-24px] z-10 relative">
                            {renderMobileMenu()}
                        </div>
                    )}

                    {/* App Desktop Nav (Only shown if NOT landing page) */}
                    {!isLandingPage && (
                        <nav className="hidden lg:flex items-center gap-6 xl:gap-8">
                            {appPrimaryNavItems.map((item) => (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    className={cn(
                                        "text-[15px] font-semibold transition-all duration-300 hover:text-white hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)] relative group py-2",
                                        location.pathname === item.path ? "text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" : "text-zinc-300"
                                    )}
                                >
                                    {item.name}
                                    <span className={cn(
                                        "absolute bottom-0 left-0 w-full h-[2px] bg-emerald-400 scale-x-0 transition-transform duration-300 group-hover:scale-x-100 origin-left shadow-[0_0_8px_rgba(52,211,153,0.8)]",
                                        location.pathname === item.path && "scale-x-100"
                                    )} />
                                </Link>
                            ))}
                        </nav>
                    )}
                </div>

                {/* Middle Section: Centered Nav for Landing OR Search Bar for App */}
                {isLandingPage ? (
                    <div className="hidden lg:flex flex-1 justify-center px-4">
                        <nav className="flex items-center gap-6 xl:gap-8">
                            {landingNavItems.map((item) => (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    className={cn(
                                        "text-[15px] font-semibold transition-all duration-300 hover:text-white hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)] relative group py-2",
                                        location.pathname === item.path ? "text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" : "text-zinc-300"
                                    )}
                                >
                                    {item.name}
                                    <span className={cn(
                                        "absolute bottom-0 left-0 w-full h-[2px] bg-emerald-400 scale-x-0 transition-transform duration-300 group-hover:scale-x-100 origin-left shadow-[0_0_8px_rgba(52,211,153,0.8)]",
                                        location.pathname === item.path && "scale-x-100"
                                    )} />
                                </Link>
                            ))}
                            <a
                                href="https://docs.intentsprotocol.xyz/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[15px] font-semibold text-zinc-300 transition-all duration-300 hover:text-white hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)] relative group py-2"
                            >
                                Docs
                                <span className="absolute bottom-0 left-0 w-full h-[2px] bg-emerald-400 scale-x-0 transition-transform duration-300 group-hover:scale-x-100 origin-left shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                            </a>
                        </nav>
                    </div>
                ) : (
                    <div className="hidden lg:flex flex-1 max-w-md justify-center px-4">
                        {/* Search moved to right side */}
                    </div>
                )}

                {/* Right Section: Social Icons for Landing OR Actions for App */}
                {isLandingPage ? (
                    <div className="hidden lg:flex items-center gap-3 shrink-0">
                        <a href="https://x.com/bchintents" target="_blank" rel="noopener noreferrer" className="glass-subtle w-10 h-10 flex items-center justify-center rounded-2xl text-zinc-400 hover:text-emerald-400 border border-white/5 hover:border-emerald-500/50 hover:shadow-[0_0_15px_rgba(16,185,129,0.2)] transition-all duration-300 group hover:-translate-y-1">
                            <XIcon />
                        </a>
                        <a href="https://docs.intentsprotocol.xyz/" target="_blank" rel="noopener noreferrer" className="glass-subtle w-10 h-10 flex items-center justify-center rounded-2xl text-zinc-400 hover:text-emerald-400 border border-white/5 hover:border-emerald-500/50 hover:shadow-[0_0_15px_rgba(16,185,129,0.2)] transition-all duration-300 group hover:-translate-y-1">
                            <BookOpen className="w-4 h-4" />
                        </a>
                        <a href="https://medium.com/@bchintents" target="_blank" rel="noopener noreferrer" className="glass-subtle w-10 h-10 flex items-center justify-center rounded-2xl text-zinc-400 hover:text-emerald-400 border border-white/5 hover:border-emerald-500/50 hover:shadow-[0_0_15px_rgba(16,185,129,0.2)] transition-all duration-300 group hover:-translate-y-1">
                            <MediumIcon />
                        </a>
                        <a href="#" target="_blank" rel="noopener noreferrer" className="glass-subtle w-10 h-10 flex items-center justify-center rounded-2xl text-zinc-400 hover:text-emerald-400 border border-white/5 hover:border-emerald-500/50 hover:shadow-[0_0_15px_rgba(16,185,129,0.2)] transition-all duration-300 group hover:-translate-y-1">
                            <DiscordIcon />
                        </a>
                    </div>
                ) : (
                    <div className="hidden lg:flex items-center gap-3 shrink-0">
                        {/* Search is now embedded inside the ConnectWalletButton pill */}
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
                )}

                {/* Mobile: right side items */}
                <div className="flex lg:hidden items-center gap-2 ml-auto shrink-0">
                    {!isLandingPage ? (
                        <ConnectWalletButton />
                    ) : (
                        renderMobileMenu()
                    )}
                </div>
            </div>
        </header>
    );
}

export default Header;
