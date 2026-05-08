import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu, Wallet, Search, ChevronDown, BookOpen } from 'lucide-react';

import { ConnectWalletButton } from '@/components/connect-wallet-button';
import { WalletPopup } from '@/components/wallet/WalletPopup';
import { TokenSearchModal } from '@/components/common/TokenSearchModal';
import { AnimatedTradeButton } from '@/components/ui/animated-trade-button';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useWallet } from '@/context/wallet-provider';
import { useWallet as useSolanaWallet } from '@solana/wallet-adapter-react';
import { useBCHWallet } from '@/context/BCHWalletProvider';

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

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


export function Header() {
    const [isOpen, setIsOpen] = useState(false);
    const [walletPopupOpen, setWalletPopupOpen] = useState(false);
    const location = useLocation();
    const { connected } = useWallet();
    const { connected: solConnected } = useSolanaWallet();
    const { connected: bchConnected } = useBCHWallet();

    const anyWalletConnected = connected || solConnected || bchConnected;

    // Determine if it's a marketing/landing page
    const isLandingPage = ['/', '/home', '/ecosystem', '/integrate'].includes(location.pathname);

    // Launch App Nav Items
    const appPrimaryNavItems = [
        { name: 'Trade', path: '/trade' },
        { name: 'Explore', path: '/explore' },
        { name: 'Portfolio', path: '/portfolio' },
    ];

    const appDropdownItems = [
        { name: 'Oracle', path: '/oracle' },
        { name: 'Knowledge Base', path: '/kb' },
    ];

    if (connected) {
        appDropdownItems.push({ name: 'Orders', path: '/orders' });
    }

    const tradeDropdownItems = [
        { name: 'Cash Token Swap', path: '/trade?type=market&sell=BCH&buy=BCH' },
        { name: 'Cross-chain', path: '/trade?type=market&sell=SOL&buy=BCH' },
        { name: 'Limit Order', path: '/trade?type=limit' },
    ];

    // Landing Page Nav Items
    const landingNavItems = [
        { name: 'Trade', path: '/trade' },
        { name: 'Ecosystem', path: '/ecosystem' },
        { name: 'Integrate', path: '/integrate' },
    ];

    return (
        <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#050505]/70 backdrop-blur-xl supports-[backdrop-filter]:bg-[#050505]/60 transition-all duration-300">
            {/* Conditional container class to distribute items depending on layout */}
            <div className={cn(
                "container mx-auto px-4 h-20 flex items-center",
                isLandingPage ? "justify-between" : "justify-between"
            )}>

                {/* Left Section: Logo (& Nav optionally for App) */}
                <div className="flex items-center gap-8 lg:gap-12 shrink-0">
                    {/* Logo - On landing pages it redirects to home, on app pages it redirects to trade or home, let's keep it to home */}
                    <Link to="/" className="flex items-center group shrink-0">
                        <img
                            src="/assets/bchintentslogo.png"
                            alt="BCH Intents Protocol Logo"
                            className="w-20 h-20 -ml-2 -mr-4 object-contain transition-transform group-hover:scale-110 duration-300"
                        />
                        <span className="font-heading font-black text-2xl tracking-tighter hidden sm:block text-white drop-shadow-sm group-hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.3)] transition-all">
                            <span className="text-emerald-500 group-hover:text-emerald-400 transition-colors">BCH </span>
                            <span>
                                Intents Protocol
                            </span>
                        </span>
                    </Link>

                    {/* App Desktop Nav (Only shown if NOT landing page) */}
                    {!isLandingPage && (
                        <nav className="hidden md:flex items-center gap-6 xl:gap-8">
                            {appPrimaryNavItems.map((item) => (
                                item.name === 'Trade' ? (
                                    <DropdownMenu key={item.path}>
                                        <DropdownMenuTrigger className="flex items-center gap-1 text-sm font-medium transition-all duration-200 hover:text-primary relative group py-2 text-primary focus:outline-none">
                                            {item.name} <ChevronDown className="h-4 w-4 transition-transform duration-200 data-[state=open]:rotate-180" />
                                            <span className="absolute bottom-0 left-0 w-full h-[2px] bg-primary scale-x-100 origin-left" />
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="start" className="bg-[#0A0A0A]/95 backdrop-blur-xl border-white/10 text-foreground">
                                            {tradeDropdownItems.map((dropdownItem) => (
                                                <DropdownMenuItem key={dropdownItem.path} asChild className="focus:bg-white/5 focus:text-primary cursor-pointer">
                                                    <Link to={dropdownItem.path} className="w-full">{dropdownItem.name}</Link>
                                                </DropdownMenuItem>
                                            ))}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                ) : (
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
                                )
                            ))}
                            <DropdownMenu>
                                <DropdownMenuTrigger className="flex items-center gap-1 text-sm font-medium text-muted-foreground/80 hover:text-primary transition-colors focus:outline-none data-[state=open]:text-primary">
                                    More <ChevronDown className="h-4 w-4 transition-transform duration-200 data-[state=open]:rotate-180" />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="bg-[#0A0A0A]/95 backdrop-blur-xl border-white/10 text-foreground">
                                    {appDropdownItems.map((item) => (
                                        <DropdownMenuItem key={item.path} asChild className="focus:bg-white/5 focus:text-primary cursor-pointer">
                                            <Link to={item.path} className="w-full">{item.name}</Link>
                                        </DropdownMenuItem>
                                    ))}
                                    <DropdownMenuItem asChild className="focus:bg-white/5 focus:text-primary cursor-pointer">
                                        <a href="https://docs.intentsprotocol.xyz/" target="_blank" rel="noopener noreferrer" className="w-full">Docs</a>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </nav>
                    )}
                </div>

                {/* Middle Section: Centered Nav for Landing OR Search Bar for App */}
                {isLandingPage ? (
                    <div className="hidden md:flex flex-1 justify-center px-4">
                        <nav className="flex items-center gap-6 xl:gap-8">
                            {landingNavItems.map((item) => (
                                item.name === 'Trade' ? (
                                    <AnimatedTradeButton key={item.path} />
                                ) : (
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
                                )
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
                    <div className="hidden md:flex flex-1 max-w-md justify-center px-4">
                        <TokenSearchModal>
                            <Button
                                variant="outline"
                                className="w-full bg-[#0A0A0A]/50 backdrop-blur-sm border-white/10 hover:bg-white/10 text-muted-foreground hover:text-primary h-10 px-4 flex items-center justify-between rounded-xl shadow-sm transition-all duration-300 hover:shadow-primary/5 hover:border-primary/30"
                            >
                                <div className="flex items-center gap-3">
                                    <Search className="h-4 w-4" />
                                    <span className="font-medium text-sm">Search tokens...</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <span className="text-[10px] font-semibold bg-white/[0.05] border border-white/10 px-1.5 py-0.5 rounded text-white/40">/</span>
                                </div>
                            </Button>
                        </TokenSearchModal>
                    </div>
                )}

                {/* Right Section: Social Icons for Landing OR Actions for App */}
                {isLandingPage ? (
                    <div className="hidden md:flex items-center gap-3 shrink-0">
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
                    <div className="hidden md:flex items-center gap-3 shrink-0">
                        <div className="relative group">
                            <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-purple-600 rounded-full blur opacity-30 group-hover:opacity-60 transition duration-500"></div>
                            <div className="relative">
                                <ConnectWalletButton />
                            </div>
                        </div>
                        {/* Wallet Popup Trigger with static blazing ring */}
                        <div className="relative group">
                            {/* Static conic-gradient ring (same palette as Trade button) */}
                            <div
                                className={cn(
                                    "absolute -inset-[2px] rounded-xl overflow-hidden transition-opacity duration-300",
                                    anyWalletConnected || walletPopupOpen ? "opacity-100" : "opacity-40 group-hover:opacity-80"
                                )}
                            >
                                <div
                                    style={{
                                        background: "conic-gradient(from 180deg, #10b981, #22c55e, #eab308, #f59e0b, #10b981)",
                                    }}
                                    className="absolute inset-0"
                                />
                                <div className="absolute inset-[2px] rounded-[10px] bg-[#050505]" />
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className={cn(
                                    "relative h-9 w-9 rounded-lg bg-transparent hover:bg-white/5 transition-all border-none",
                                    walletPopupOpen && "bg-white/5"
                                )}
                                onClick={() => setWalletPopupOpen(v => !v)}
                            >
                                <Wallet className={cn(
                                    "h-4 w-4 transition-colors duration-300",
                                    anyWalletConnected
                                        ? "text-emerald-400"
                                        : walletPopupOpen
                                            ? "text-emerald-400/80"
                                            : "text-muted-foreground group-hover:text-emerald-400/60"
                                )} />
                            </Button>
                        </div>
                    </div>
                )}

                {/* Wallet Popup Panel (Only if not landing page) */}
                {!isLandingPage && <WalletPopup open={walletPopupOpen} onClose={() => setWalletPopupOpen(false)} />}

                {/* Mobile Menu */}
                <Sheet open={isOpen} onOpenChange={setIsOpen}>
                    <SheetTrigger asChild>
                        <Button variant="ghost" size="icon" className="md:hidden hover:bg-white/5 shrink-0 ml-4">
                            <Menu className="h-6 w-6" />
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="right" className="w-[300px] sm:w-[400px] bg-[#050505]/95 backdrop-blur-xl border-l border-white/10">
                        <div className="flex flex-col gap-8 mt-12">
                            <nav className="flex flex-col gap-6">
                                {isLandingPage ? (
                                    <>
                                        {landingNavItems.map((item) => (
                                            item.name === 'Trade' ? (
                                                <AnimatedTradeButton key={item.path} onClick={() => setIsOpen(false)} />
                                            ) : (
                                                <Link
                                                    key={item.path}
                                                    to={item.path}
                                                    onClick={() => setIsOpen(false)}
                                                    className={cn(
                                                        "text-2xl font-bold transition-all hover:text-white hover:drop-shadow-[0_0_12px_rgba(255,255,255,0.4)] flex items-center justify-between group hover:translate-x-2",
                                                        location.pathname === item.path ? "text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.4)]" : "text-zinc-400"
                                                    )}
                                                >
                                                    {item.name}
                                                    <ChevronDown className="-rotate-90 h-6 w-6 opacity-0 group-hover:opacity-100 transition-all text-emerald-400 group-hover:translate-x-1" />
                                                </Link>
                                            )
                                        ))}
                                        <a
                                            href="https://docs.intentsprotocol.xyz/"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={() => setIsOpen(false)}
                                            className="text-2xl font-bold transition-all hover:text-white hover:drop-shadow-[0_0_12px_rgba(255,255,255,0.4)] flex items-center justify-between group text-zinc-400 hover:translate-x-2"
                                        >
                                            Docs
                                            <ChevronDown className="-rotate-90 h-6 w-6 opacity-0 group-hover:opacity-100 transition-all text-emerald-400 group-hover:translate-x-1" />
                                        </a>
                                    </>
                                ) : (
                                    <>
                                        {[...appPrimaryNavItems, ...appDropdownItems].map((item) => (
                                            item.name === 'Trade' ? (
                                                <div key={item.path} className="flex flex-col gap-2">
                                                    <div className="text-2xl font-bold text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.4)] flex items-center justify-between group">
                                                        {item.name}
                                                    </div>
                                                    <div className="flex flex-col gap-4 pl-4 border-l-2 border-emerald-500/30 mt-4">
                                                        {tradeDropdownItems.map((subItem) => (
                                                            <Link
                                                                key={subItem.path}
                                                                to={subItem.path}
                                                                onClick={() => setIsOpen(false)}
                                                                className="text-xl font-semibold text-zinc-400 hover:text-white hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.3)] transition-all hover:translate-x-1"
                                                            >
                                                                {subItem.name}
                                                            </Link>
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : (
                                                <Link
                                                    key={item.path}
                                                    to={item.path}
                                                    onClick={() => setIsOpen(false)}
                                                    className={cn(
                                                        "text-2xl font-bold transition-all hover:text-white hover:drop-shadow-[0_0_12px_rgba(255,255,255,0.4)] flex items-center justify-between group hover:translate-x-2",
                                                        location.pathname === item.path ? "text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.4)]" : "text-zinc-400"
                                                    )}
                                                >
                                                    {item.name}
                                                    <ChevronDown className="-rotate-90 h-6 w-6 opacity-0 group-hover:opacity-100 transition-all text-emerald-400 group-hover:translate-x-1" />
                                                </Link>
                                            )
                                        ))}
                                        <a
                                            href="https://docs.intentsprotocol.xyz/"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={() => setIsOpen(false)}
                                            className="text-2xl font-bold transition-all hover:text-white hover:drop-shadow-[0_0_12px_rgba(255,255,255,0.4)] flex items-center justify-between group text-zinc-400 hover:translate-x-2"
                                        >
                                            Docs
                                            <ChevronDown className="-rotate-90 h-6 w-6 opacity-0 group-hover:opacity-100 transition-all text-emerald-400 group-hover:translate-x-1" />
                                        </a>
                                    </>
                                )}
                            </nav>

                            {!isLandingPage && (
                                <div className="pt-8 border-t border-white/10 flex flex-col gap-4">
                                    <div className="flex gap-3 mt-2">
                                        <div className="flex-1">
                                            <ConnectWalletButton className="w-full h-12 text-lg rounded-xl" />
                                        </div>
                                        <div className="relative group">
                                            <div className="absolute -inset-[2px] rounded-xl overflow-hidden">
                                                <div
                                                    style={{
                                                        background: "conic-gradient(from 180deg, #10b981, #22c55e, #eab308, #f59e0b, #10b981)",
                                                    }}
                                                    className="absolute inset-0"
                                                />
                                                <div className="absolute inset-[2px] rounded-[10px] bg-[#050505]" />
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                className={cn(
                                                    "relative h-12 w-12 shrink-0 rounded-xl bg-transparent hover:bg-white/5 transition-all border-none",
                                                    walletPopupOpen && "bg-white/5"
                                                )}
                                                onClick={() => {
                                                    setIsOpen(false);
                                                    setWalletPopupOpen(true);
                                                }}
                                            >
                                                <Wallet className={cn(
                                                    "h-5 w-5 transition-colors duration-300",
                                                    anyWalletConnected ? "text-emerald-400" : "text-muted-foreground"
                                                )} />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {isLandingPage && (
                                <div className="pt-8 border-t border-white/10 flex gap-4 justify-center">
                                    <a href="https://x.com/bchintents" target="_blank" rel="noopener noreferrer" className="glass-subtle w-12 h-12 flex items-center justify-center rounded-2xl text-zinc-400 hover:text-emerald-400 border border-white/5 hover:border-emerald-500/50 hover:shadow-[0_0_15px_rgba(16,185,129,0.2)] transition-all duration-300 group hover:-translate-y-1">
                                        <XIcon />
                                    </a>
                                    <a href="https://docs.intentsprotocol.xyz/" target="_blank" rel="noopener noreferrer" className="glass-subtle w-12 h-12 flex items-center justify-center rounded-2xl text-zinc-400 hover:text-emerald-400 border border-white/5 hover:border-emerald-500/50 hover:shadow-[0_0_15px_rgba(16,185,129,0.2)] transition-all duration-300 group hover:-translate-y-1">
                                        <BookOpen className="w-5 h-5" />
                                    </a>
                                    <a href="https://medium.com/@bchintents" target="_blank" rel="noopener noreferrer" className="glass-subtle w-12 h-12 flex items-center justify-center rounded-2xl text-zinc-400 hover:text-emerald-400 border border-white/5 hover:border-emerald-500/50 hover:shadow-[0_0_15px_rgba(16,185,129,0.2)] transition-all duration-300 group hover:-translate-y-1">
                                        <MediumIcon />
                                    </a>
                                    <a href="#" target="_blank" rel="noopener noreferrer" className="glass-subtle w-12 h-12 flex items-center justify-center rounded-2xl text-zinc-400 hover:text-emerald-400 border border-white/5 hover:border-emerald-500/50 hover:shadow-[0_0_15px_rgba(16,185,129,0.2)] transition-all duration-300 group hover:-translate-y-1">
                                        <DiscordIcon />
                                    </a>
                                </div>
                            )}
                        </div>
                    </SheetContent>
                </Sheet>
            </div>
        </header>
    );
}

export default Header;
