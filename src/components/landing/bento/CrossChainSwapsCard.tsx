/**
 * CrossChainSwapsCard - Card 1 in the bento grid
 * 
 * Features:
 * - Cross-chain Swaps header with swap icon
 * - "Cross-Chain Execution" tagline
 * - Live token prices from Pyth Oracle with auto-scroll animation
 * - Triggered on hover (desktop) or scroll in-view (mobile)
 * - "Explore chains" CTA links to Live on Network section
 */

import { useEffect, useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { ArrowRight, ArrowLeftRight, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TokenDisplay } from '@/components/common/TokenDisplay';
import { PriceService } from '@/lib/pyth';
import { PriceData } from '@/types';
import { useBentoAnimationTrigger } from './useBentoAnimationTrigger';

// Token assets configuration
const DISPLAY_TOKENS = [
    {
        symbol: 'BCH',
        name: 'Bitcoin Cash',
        priceKey: 'BCH',
        icon: 'https://bitcoincash.org/img/green/bitcoin-cash-circle.svg',
        chainIcon: 'https://bitcoincash.org/img/green/bitcoin-cash-circle.svg'
    },
    {
        symbol: 'XMR',
        name: 'Monero',
        priceKey: 'XMR',
        icon: '/logos/monero.svg',
        chainIcon: '/logos/monero.svg'
    },
    {
        symbol: 'ETH',
        name: 'Ethereum',
        priceKey: 'ETH',
        icon: '/logos/ethereum-eth-logo.svg',
        chainIcon: '/logos/ethereum-eth-logo.svg'
    },
    {
        symbol: 'SOL',
        name: 'Solana',
        priceKey: 'SOL',
        icon: '/assets/solanaLogo.png',
        chainIcon: '/assets/solanaLogo.png'
    },
    {
        symbol: 'MOVE',
        name: 'Movement',
        priceKey: 'MOVE',
        icon: 'https://raw.githubusercontent.com/kitelabs-io/mvmt-tokens/main/logos/MOVE.png',
        chainIcon: 'https://raw.githubusercontent.com/kitelabs-io/mvmt-tokens/main/logos/MOVE.png'
    },
    {
        symbol: 'USDC',
        name: 'USD Coin',
        priceKey: 'USDC',
        icon: '/logos/usd-coin-usdc-logo.svg',
        chainIcon: '/logos/usd-coin-usdc-logo.svg'
    },
];

interface CrossChainSwapsCardProps {
    className?: string;
}

export function CrossChainSwapsCard({ className }: CrossChainSwapsCardProps) {
    const { cardRef, isActive, isMobile, onMouseEnter, onMouseLeave } = useBentoAnimationTrigger();
    const [prices, setPrices] = useState<Record<string, PriceData>>({});
    const [loading, setLoading] = useState(true);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchPrices = async () => {
            setLoading(true);
            const data = await PriceService.getLatestPrices();
            setPrices(data);
            setLoading(false);
        };

        fetchPrices();
        const interval = setInterval(fetchPrices, 30000); // Refresh every 30s
        return () => clearInterval(interval);
    }, []);

    // Auto-scroll animation for token list — runs when active
    useEffect(() => {
        const el = scrollRef.current;
        if (!el || !isActive) return;

        let animationId: number;
        const scrollSpeed = 0.65; // pixels per frame

        const scroll = () => {
            if (el.scrollHeight > el.clientHeight) {
                el.scrollTop += scrollSpeed;
                // Reset to top when scrolled past halfway (seamless loop)
                if (el.scrollTop >= el.scrollHeight / 2) {
                    el.scrollTop = 0;
                }
            }
            animationId = requestAnimationFrame(scroll);
        };

        animationId = requestAnimationFrame(scroll);

        return () => {
            cancelAnimationFrame(animationId);
        };
    }, [isActive, loading]);

    const handleExploreChains = () => {
        const el = document.getElementById('live-on-network');
        if (el) {
            el.scrollIntoView({ behavior: 'smooth' });
        }
    };

    // Duplicate tokens for seamless scrolling loop
    const scrollTokens = [...DISPLAY_TOKENS, ...DISPLAY_TOKENS];

    return (
        <div
            ref={cardRef}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            className={cn(
                'bento-card h-full min-h-[420px] flex flex-col transition-all duration-300 cursor-pointer',
                'grainy',
                isActive && 'ring-1 ring-emerald-500/30',
                className
            )}
        >
            {/* Card Header */}
            <div className="flex items-center gap-2 mb-4">
                <div className={cn(
                    "icon-box-primary transition-colors duration-300",
                    isActive && "bg-emerald-500/20 shadow-sm shadow-emerald-500/20"
                )}>
                    <ArrowLeftRight className="w-5 h-5" />
                </div>
                <span className="tag-primary">
                    <Globe className="w-3 h-3" />
                    Cross-chain Swaps
                </span>
            </div>

            {/* Tagline */}
            <h3 className="text-2xl md:text-3xl font-bold mb-2">
                <span className="text-primary">Cross-Chain</span>{' '}
                <span className="text-foreground">Execution</span>
            </h3>

            {/* Description */}
            <p className="text-muted-foreground mb-2 leading-relaxed">
                Atomic swaps between BCH, Solana, and EVM chains and more via HTLCs.
            </p>
            <p className="text-foreground font-medium text-sm mb-4">
                No wrapped tokens. No custodians. Native assets only.
            </p>

            {/* CTA Button */}
            <Button variant="outline" className="rounded-full gap-2 mb-6 group self-start" onClick={handleExploreChains}>
                Explore chains
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Button>

            {/* Token Prices List - Auto-scrolling */}
            <div
                ref={scrollRef}
                className={cn(
                    "mt-auto bg-muted/30 dark:bg-zinc-800/30 rounded-2xl p-3 overflow-hidden max-h-[220px] transition-all duration-300",
                    isActive && "border border-emerald-500/20"
                )}
            >
                <div className="space-y-1">
                    {scrollTokens.map((token, index) => {
                        const priceData = prices[token.priceKey];
                        const price = PriceService.formatPrice(priceData);
                        // Mock price change for demo
                        const priceChange = ((index % 3 === 0 ? 1 : -1) * (1.2 + (index * 0.4)));

                        return (
                            <div
                                key={`${token.symbol}-${index}`}
                                className={cn(
                                    'flex items-center justify-between py-2.5 px-3 rounded-xl',
                                    'hover:bg-muted/50 dark:hover:bg-zinc-700/30 transition-colors',
                                    index < scrollTokens.length - 1 && 'border-b border-border/30'
                                )}
                            >
                                <TokenDisplay
                                    tokenIcon={token.icon}
                                    chainIcon={token.chainIcon}
                                    name={token.name}
                                    ticker={token.symbol}
                                    size="md"
                                    showChainBadge={false}
                                />

                                <div className="flex items-center gap-3 text-right">
                                    {loading ? (
                                        <div className="h-5 w-20 bg-muted animate-pulse rounded" />
                                    ) : (
                                        <>
                                            <span className="font-semibold">
                                                ${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                            <span
                                                className={cn(
                                                    'text-sm font-medium',
                                                    priceChange >= 0 ? 'text-green-500' : 'text-red-500'
                                                )}
                                            >
                                                {priceChange >= 0 ? '↑' : '↓'} {Math.abs(priceChange).toFixed(2)}%
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

export default CrossChainSwapsCard;
