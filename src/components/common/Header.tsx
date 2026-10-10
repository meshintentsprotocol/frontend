import { useState, useEffect } from 'react';

import { ConnectWalletButton } from '@/components/connect-wallet-button';
import { TokenSearchModal } from '@/components/common/TokenSearchModal';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useWDK } from '@/context/WDKProvider';

import { MeshNavDropdown } from '@/components/common/MeshNavDropdown';
import { TradeNavDropdown } from '@/components/common/TradeNavDropdown';
import { PortfolioNavDropdown } from '@/components/common/PortfolioNavDropdown';
import { LogoMenuDropdown } from '@/components/common/LogoMenuDropdown';
import { MobileNavMenu } from '@/components/common/MobileNavMenu';

export function Header() {
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
                        <MobileNavMenu />
                    </div>

                    {/* Desktop Nav — unified order: Trade, Explore, Pool, Portfolio, Knowledgehub */}
                    <nav className="hidden lg:flex items-center gap-6 xl:gap-8">
                        {/* 1. Trade Dropdown */}
                        <TradeNavDropdown />

                        {/* Borrow */}
                        <Link
                            to="/borrow"
                            className={cn(
                                "text-[15px] font-semibold transition-all duration-300 hover:text-white hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)] relative group py-2",
                                location.pathname.startsWith('/borrow')
                                    ? "text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]"
                                    : "text-zinc-300"
                            )}
                        >
                            Borrow
                            <span className={cn(
                                "absolute bottom-0 left-0 w-full h-[2px] bg-emerald-400 scale-x-0 transition-transform duration-300 group-hover:scale-x-100 origin-left",
                                location.pathname.startsWith('/borrow') && "scale-x-100"
                            )} />
                        </Link>

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

                        {/* 4. Portfolio Dropdown Menu */}
                        <PortfolioNavDropdown />

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
