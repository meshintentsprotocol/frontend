import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, ArrowLeftRight, ExternalLink, Layers } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useWDK } from '@/context/WDKProvider';
import { useTokenDetail } from '@/hooks/useTokenDetail';
import { TokenChart } from '@/components/explore/TokenChart';
import { TokenStats } from '@/components/explore/TokenStats';
import { TokenAbout } from '@/components/explore/TokenAbout';
import { TokenProtocolTransactions } from '@/components/explore/TokenProtocolTransactions';
import { BCHSwapCard } from '@/components/bch-swap/BCHSwapCard';
import type { BCHOrderType, Token } from '@/types';
import { Drawer, DrawerContent, DrawerTrigger } from '@/components/ui/drawer';
import { TokenChainIcon } from '@/components/common/TokenChainIcon';

// URL scheme:
//   Cross-chain:  /explore/tokens/BCH   → tokenId = "BCH"
//   CashToken:    /explore/tokens/ct-<full64hex>  → tokenId = slug.slice(3)

function parseSlug(slug: string): { tokenId: string; isCashToken: boolean } {
    if (slug.startsWith('ct-')) return { tokenId: slug.slice(3), isCashToken: true };
    return { tokenId: slug.toUpperCase(), isCashToken: false };
}

function formatPrice(v: number): string {
    if (v >= 1000) return `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    if (v >= 1) return `$${v.toFixed(2)}`;
    if (v >= 0.01) return `$${v.toFixed(4)}`;
    return `$${v.toFixed(8)}`;
}

// DeFi-style swap card skeleton — shown while anchor token data loads or on navigation
function SwapCardSkeleton() {
    return (
        <div className="space-y-3 px-1 animate-in fade-in duration-200">
            {/* Tab strip */}
            <div className="flex gap-2">
                <div className="h-8 w-16 bg-white/[0.05] rounded-full animate-pulse" />
                <div className="h-8 w-16 bg-white/[0.04] rounded-full animate-pulse" />
            </div>
            {/* Sell input block */}
            <div className="rounded-2xl bg-white/[0.03] p-4 space-y-3 animate-pulse">
                <div className="flex justify-between">
                    <div className="h-3 w-16 bg-white/[0.06] rounded" />
                    <div className="h-3 w-20 bg-white/[0.04] rounded" />
                </div>
                <div className="flex justify-between items-center">
                    <div className="h-8 w-28 bg-white/[0.06] rounded-xl" />
                    <div className="h-6 w-24 bg-white/[0.04] rounded" />
                </div>
            </div>
            {/* Swap arrow */}
            <div className="flex justify-center">
                <div className="h-9 w-9 rounded-xl bg-white/[0.04] animate-pulse" />
            </div>
            {/* Buy input block */}
            <div className="rounded-2xl bg-white/[0.03] p-4 space-y-3 animate-pulse">
                <div className="flex justify-between">
                    <div className="h-3 w-16 bg-white/[0.06] rounded" />
                    <div className="h-3 w-20 bg-white/[0.04] rounded" />
                </div>
                <div className="flex justify-between items-center">
                    <div className="h-8 w-28 bg-white/[0.06] rounded-xl" />
                    <div className="h-6 w-24 bg-white/[0.04] rounded" />
                </div>
            </div>
            {/* Route preview line */}
            <div className="h-3 w-40 bg-white/[0.03] rounded animate-pulse mx-auto" />
            {/* CTA button */}
            <div className="h-12 rounded-2xl bg-white/[0.05] animate-pulse" />
        </div>
    );
}

const METADATA_SOURCE_LABELS: Record<string, string> = { 'bcmr-indexer': 'BCMR indexer', cauldron: 'Cauldron registry', embedded: 'Embedded registry' };

export function TokenDetailPage() {
    const { id: slug = '' } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { bchNetwork } = useWDK();
    const isMainnet = bchNetwork === 'mainnet';

    const { tokenId, isCashToken } = parseSlug(slug);
    const { data: detail, isLoading } = useTokenDetail(tokenId, isCashToken, isMainnet);

    const [orderType, setOrderType] = useState<BCHOrderType>('market');
    const [mobileSwapOpen, setMobileSwapOpen] = useState(false);

    // Track the tokenId for which we last "committed" the swap card.
    // When it differs from the current tokenId we show the skeleton until
    // anchorToken for the new token is ready.
    const committedTokenId = useRef<string | null>(null);
    const [swapReady, setSwapReady] = useState(false);

    // Build Token object for BCHSwapCard anchor
    const anchorToken: Token | undefined = detail ? {
        symbol: detail.symbol,
        name: detail.name,
        icon: detail.icon,
        decimals: detail.decimals ?? (isCashToken ? 0 : 8),
        type: isCashToken ? 'cashtoken' : 'native',
        chain: isCashToken ? 'bch'
            : detail.chain === 'Solana' ? 'solana'
            : detail.chain === 'Monero' ? 'xmr'
            : detail.chain === 'Bitcoin Cash' ? 'bch'
            : detail.chain === 'Movement' ? 'movement'
            : 'ethereum',
        categoryId: isCashToken ? tokenId : undefined,
        priceUsd: detail.priceUsd,
        priceSats: detail.priceSats,
    } : undefined;

    const anchorSide: 'sell' | 'buy' = tokenId.toUpperCase() === 'BCH' ? 'sell' : 'buy';

    // Reset skeleton when navigating to a new token
    useEffect(() => {
        if (committedTokenId.current !== tokenId) {
            setSwapReady(false);
            committedTokenId.current = tokenId;
        }
    }, [tokenId]);

    // Commit once the anchor token for the current tokenId is ready,
    // or stop the skeleton if data loaded but no token was found.
    useEffect(() => {
        if (anchorToken) {
            setSwapReady(true);
        } else if (!isLoading) {
            // Token not found — clear skeleton so it doesn't spin forever
            setSwapReady(false);
        }
    }, [anchorToken, isLoading]);

    const handleAnchorTokenChange = (token: Token) => {
        // A CashToken is identified by a categoryId OR by a 64-char hex `type`
        // (mapToTokens sets type = token_id; TokenDetailPage sets type = 'cashtoken')
        const ctId = token.categoryId ?? (token.type?.length === 64 ? token.type : undefined);
        if (ctId) {
            navigate(`/explore/tokens/ct-${ctId}`);
        } else {
            navigate(`/explore/tokens/${token.symbol}`);
        }
    };

    const changePositive = detail?.change24h != null ? detail.change24h >= 0 : true;

    return (
        <div className="mx-auto px-4 md:px-8 w-full min-w-0 max-w-[1200px] py-6 pb-28 lg:pb-6 relative">

            {/* Back nav */}
            <Link
                to="/explore"
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
            >
                <ArrowLeft className="h-4 w-4" />
                Explore
            </Link>

            {/* Main grid */}
            <div className="grid min-w-0 grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-6 lg:gap-8">

                {/* ── Left column (2/3) ─────────────────────────────────── */}
                <div className="min-w-0 flex flex-col space-y-8">

                    {/* Token header */}
                    {isLoading ? (
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-full bg-white/[0.04] animate-pulse flex-shrink-0" />
                            <div className="space-y-2">
                                <div className="h-5 w-40 bg-white/[0.04] rounded animate-pulse" />
                                <div className="h-3.5 w-24 bg-white/[0.03] rounded animate-pulse" />
                            </div>
                        </div>
                    ) : detail ? (
                        <div className="flex min-w-0 items-start gap-3 sm:gap-4">
                            {/* Same resolver as the list rows: IPFS gateway fallbacks, then identicon */}
                            <TokenChainIcon
                                tokenIcon={detail.icon}
                                tokenName={detail.symbol}
                                chain={isCashToken ? 'bitcoin-cash' : detail.chain}
                                size="lg"
                                className="mt-1"
                            />
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                    <h1 className="max-w-full break-words text-xl sm:text-2xl font-semibold text-foreground [overflow-wrap:anywhere]" title={detail.name}>{detail.name}</h1>
                                    <span className="max-w-full truncate text-sm text-muted-foreground font-mono uppercase tracking-wide">{detail.symbol}</span>
                                    {isCashToken ? (
                                        <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-emerald-500/20 text-emerald-400">
                                            <Layers className="h-2.5 w-2.5 mr-1 inline" />CashToken
                                        </Badge>
                                    ) : (
                                        <Badge variant="outline" className={cn(
                                            'text-[9px] h-4 px-1.5 border-white/10',
                                            detail.chain === 'Solana' && 'text-indigo-300',
                                            detail.chain === 'Bitcoin Cash' && 'text-emerald-400',
                                            detail.chain === 'Movement' && 'text-primary',
                                            detail.chain === 'Monero' && 'text-orange-400',
                                            detail.chain === 'EVM' && 'text-yellow-300',
                                        )}>
                                            {detail.chain}
                                        </Badge>
                                    )}
                                </div>

                                <div className="flex flex-wrap items-baseline gap-3">
                                    <span className="max-w-full break-words text-2xl sm:text-3xl font-bold text-foreground [overflow-wrap:anywhere]">
                                        {formatPrice(detail.priceUsd)}
                                    </span>
                                    {detail.change24h != null && (
                                        <span className={cn(
                                            'text-sm font-semibold',
                                            changePositive ? 'text-emerald-500' : 'text-rose-500'
                                        )}>
                                            {changePositive ? '+' : ''}{detail.change24h.toFixed(2)}% (24h)
                                        </span>
                                    )}
                                    {detail.priceSats != null && (
                                        <span className="text-sm text-muted-foreground font-mono">
                                            {detail.priceSats.toFixed(2)} sats
                                        </span>
                                    )}
                                </div>

                                {isCashToken && detail.metadataStatus && (
                                    <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
                                        {detail.metadataStatus === 'available'
                                            ? 'Metadata: ' + (METADATA_SOURCE_LABELS[detail.metadataSource ?? ''] ?? 'Published registry')
                                            : detail.metadataStatus === 'unavailable' ? 'Metadata temporarily unavailable' : 'No published metadata found'}
                                    </p>
                                )}
                                {detail.migratedTo && (
                                    <Link className="mt-2 block text-xs text-primary underline" to={'/explore/tokens/ct-' + detail.migratedTo}>
                                        This category has migrated. View the current category.
                                    </Link>
                                )}

                                {isCashToken && (
                                    <div className="mt-1.5 flex items-center gap-1.5">
                                        <span className="text-[10px] font-mono text-muted-foreground/50">
                                            {tokenId.slice(0, 12)}…{tokenId.slice(-8)}
                                        </span>
                                        <a
                                            href={detail.explorerLinks[0]}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                                        >
                                            <ExternalLink className="h-3 w-3" />
                                        </a>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <p className="text-muted-foreground text-sm">Token not found.</p>
                    )}

                    {/* Chart */}
                    <TokenChart
                        tokenId={tokenId}
                        isCashToken={isCashToken}
                        isMainnet={isMainnet}
                        currentPrice={detail?.priceUsd}
                    />

                    {/* Stats grid */}
                    {detail && <TokenStats detail={detail} />}

                    {/* About */}
                    {detail && (
                        <TokenAbout
                            description={detail.description}
                            website={detail.website}
                            explorerLinks={detail.explorerLinks}
                        />
                    )}

                    {/* Transactions — only completed, below all token details */}
                    <div className="pt-8 border-t border-white/[0.06]">
                        <TokenProtocolTransactions
                            tokenId={tokenId}
                            isCashToken={isCashToken}
                            isMainnet={isMainnet}
                        />
                    </div>
                </div>

                {/* ── Right column (1/3) — sticky floating swap card (Desktop only) ─────── */}
                <div className="min-w-0 hidden lg:block">
                    <div className="sticky top-28">
                        {!swapReady ? (
                            <SwapCardSkeleton />
                        ) : (
                            <div
                                key={tokenId}
                                className="animate-in fade-in slide-in-from-bottom-4 duration-300 ease-out"
                            >
                                <BCHSwapCard
                                    key={tokenId}
                                    orderType={orderType}
                                    onOrderTypeChange={setOrderType}
                                    anchorToken={anchorToken}
                                    anchorSide={anchorSide}
                                    onAnchorTokenChange={handleAnchorTokenChange}
                                    compact
                                    transparent
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Mobile/Tablet floating action button & drawer */}
            <div className={cn(
                "lg:hidden fixed bottom-0 left-0 right-0 px-4 pb-6 z-[90] transition-all duration-200",
                "safe-area-bottom",
                mobileSwapOpen ? "opacity-0 pointer-events-none" : "opacity-100"
            )}>
                <Drawer open={mobileSwapOpen} onOpenChange={setMobileSwapOpen}>
                    <DrawerTrigger asChild>
                        <button className="w-full h-14 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 active:scale-[0.98] text-white font-bold rounded-2xl shadow-[0_8px_32px_rgba(16,185,129,0.35)] flex items-center justify-center gap-2 text-base transition-all duration-150">
                            <ArrowLeftRight className="h-4 w-4 shrink-0" />
                            {detail ? `Swap ${detail.symbol}` : 'Swap'}
                        </button>
                    </DrawerTrigger>
                    <DrawerContent className="p-0 max-h-[90dvh] z-[100] pointer-events-auto">
                        <div className="overflow-y-auto scrollbar-none px-1 pt-2 pb-safe-or-8">
                            {!swapReady ? (
                                <SwapCardSkeleton />
                            ) : (
                                <div
                                    key={tokenId}
                                    className="animate-in fade-in slide-in-from-bottom-4 duration-300 ease-out"
                                >
                                    <BCHSwapCard
                                        key={tokenId}
                                        orderType={orderType}
                                        onOrderTypeChange={setOrderType}
                                        anchorToken={anchorToken}
                                        anchorSide={anchorSide}
                                        onAnchorTokenChange={handleAnchorTokenChange}
                                        compact
                                        transparent
                                    />
                                </div>
                            )}
                        </div>
                    </DrawerContent>
                </Drawer>
            </div>
        </div>
    );
}
