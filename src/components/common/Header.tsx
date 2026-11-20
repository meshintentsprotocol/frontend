import { useState, useEffect } from 'react';

import { ConnectWalletButton } from '@/components/connect-wallet-button';
import { TokenSearchModal } from '@/components/common/TokenSearchModal';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

import { MeshNavDropdown } from '@/components/common/MeshNavDropdown';
import { TradeNavDropdown } from '@/components/common/TradeNavDropdown';
import { PortfolioNavDropdown } from '@/components/common/PortfolioNavDropdown';
import { LogoMenuDropdown } from '@/components/common/LogoMenuDropdown';
import { MobileNavMenu } from '@/components/common/MobileNavMenu';
import { BCHLogo } from '@/components/common/BCHLogo';

export function Header() {
    const [searchOpen, setSearchOpen] = useState(false);
    const location = useLocation();

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
                            <BCHLogo className="w-8 h-8 group-hover:scale-105 transition-transform" />
                        </Link>
                    </div>

                    {/* Mobile Menu Trigger */}
                    <div className="flex lg:hidden ml-1 z-10 relative">
                        <MobileNavMenu />
                    </div>

                    {/* Desktop Nav — unified order: Trade, Borrow, Explore, Pool, Portfolio, Knowledgehub */}
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

                {/* ── Right Section: wallet ── */}
                <div className="hidden lg:flex items-center gap-3 shrink-0">
                    {/* Programmatic modal for cross-component open-token-search event */}
                    <TokenSearchModal open={searchOpen} onOpenChange={setSearchOpen}>
                        <span />
                    </TokenSearchModal>

                    <ConnectWalletButton variant="header" />
                </div>

                {/* ── Mobile: right side (Connect Wallet only) ── */}
                <div className="flex lg:hidden items-center gap-2 ml-auto shrink-0">
                    <ConnectWalletButton variant="header" />
                </div>
            </div>
        </header>
    );
}

export default Header;
