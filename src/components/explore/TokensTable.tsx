import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MarketService, marketSymbolFor, formatCompactNumber } from '@/lib/marketData';
import { usePrices } from '@/hooks/usePrices';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ChainFilter } from '@/pages/ExplorePage';
import { ArrowUpRight, ArrowDownRight, Layers } from 'lucide-react';
import { CauldronService } from '@/lib/cauldron';
import { useWDK } from '@/context/WDKProvider';
import { TokenChainIcon } from '@/components/common/TokenChainIcon';
import { resolveTokenIconUri } from '@/lib/tokenIcons';
import { logoForSymbol } from '@/lib/tokenLogos';

type AssetChain = 'Bitcoin Cash' | 'EVM' | 'Solana' | 'Movement' | 'Monero';
interface Asset {
    symbol: string;
    name: string;
    chain: AssetChain;
    /** Canonical chain id for the chain-logo badge (see lib/chains.ts). */
    chainId: string;
    icon: string;
}

// Tokens available per network. Mirrors MAINNET_SWAP_TOKENS / ALL_BCH_SWAP_TOKENS
// in components/bch-swap/BCHTokenSelector.tsx so this table represents what is
// actually swappable on the active network. Prices resolve through
// marketSymbolFor(), so "USDC (MOVE)" is priced as USDC.
const MAINNET_ASSETS: Asset[] = [
    { symbol: "BCH", name: "Bitcoin Cash", chain: "Bitcoin Cash", chainId: "bitcoin-cash", icon: "/logos/bitcoin-cash-bch-logo.svg" },
    { symbol: "BNB", name: "BNB", chain: "EVM", chainId: "bsc", icon: "/logos/bnb-bnb-logo.svg" },
    { symbol: "USDT", name: "Tether USD (BSC)", chain: "EVM", chainId: "bsc", icon: "/logos/usdt-svgrepo-com.svg" },
    { symbol: "MOVE", name: "Movement", chain: "Movement", chainId: "movement", icon: "/logos/movement.svg" },
    { symbol: "USDC (MOVE)", name: "USD Coin (Movement)", chain: "Movement", chainId: "movement", icon: "/logos/usd-coin-usdc-logo.svg" },
    { symbol: "USDT (MOVE)", name: "Tether USD (Movement)", chain: "Movement", chainId: "movement", icon: "/logos/usdt-svgrepo-com.svg" },
    { symbol: "WETH (MOVE)", name: "Wrapped Ether (Movement)", chain: "Movement", chainId: "movement", icon: "/logos/ethereum-eth-logo.svg" },
];

const TESTNET_ASSETS: Asset[] = [
    { symbol: "BCH", name: "Bitcoin Cash", chain: "Bitcoin Cash", chainId: "bitcoin-cash", icon: "/logos/bitcoin-cash-bch-logo.svg" },
    { symbol: "ETH", name: "Ethereum (Sepolia)", chain: "EVM", chainId: "ethereum", icon: "/logos/ethereum-eth-logo.svg" },
    { symbol: "USDT", name: "Tether USD (Sepolia)", chain: "EVM", chainId: "ethereum", icon: "/logos/usdt-svgrepo-com.svg" },
    { symbol: "SOL", name: "Solana (Devnet)", chain: "Solana", chainId: "solana", icon: "/logos/solana.svg" },
    { symbol: "USDC", name: "USD Coin (Devnet)", chain: "Solana", chainId: "solana", icon: "/logos/usd-coin-usdc-logo.svg" },
    { symbol: "MOVE", name: "Movement", chain: "Movement", chainId: "movement", icon: "/logos/movement.svg" },
    { symbol: "USDC (MOVE)", name: "USD Coin (Movement)", chain: "Movement", chainId: "movement", icon: "/logos/usd-coin-usdc-logo.svg" },
    { symbol: "USDT (MOVE)", name: "Tether USD (Movement)", chain: "Movement", chainId: "movement", icon: "/logos/usdt-svgrepo-com.svg" },
    { symbol: "WETH (MOVE)", name: "Wrapped Ether (Movement)", chain: "Movement", chainId: "movement", icon: "/logos/ethereum-eth-logo.svg" },
    { symbol: "XMR", name: "Monero", chain: "Monero", chainId: "monero", icon: "/logos/monero.svg" },
];

interface TokensTableProps {
    activeChain: ChainFilter;
    refreshTrigger: number;
}

export function TokensTable({ activeChain, refreshTrigger }: TokensTableProps) {
    const { bchNetwork } = useWDK();
    const isMainnet = bchNetwork === 'mainnet';
    const navigate = useNavigate();
    const ASSETS: Asset[] = isMainnet ? MAINNET_ASSETS : TESTNET_ASSETS;

    // All three come from the mesh server and are shared app-wide via react-query.
    const { prices, refetch: refetchPrices } = usePrices();
    const markets = useQuery({
        queryKey: ['markets'],
        queryFn: () => MarketService.getMarkets(),
        staleTime: 60_000,
        refetchInterval: 60_000,
        placeholderData: keepPreviousData,
    });
    const cashTokenQuery = useQuery({
        queryKey: ['cauldron-top-tokens', isMainnet ? 'mainnet' : 'chipnet'],
        queryFn: () => CauldronService.getTopCashTokens(50, isMainnet),
        staleTime: 60_000,
        refetchInterval: 60_000,
        placeholderData: keepPreviousData,
    });
    const cashTokens = cashTokenQuery.data ?? [];

    useEffect(() => {
        if (refreshTrigger === 0) return;
        refetchPrices();
        markets.refetch();
        cashTokenQuery.refetch();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [refreshTrigger]);

    const isRefetching = markets.isFetching || cashTokenQuery.isFetching;
    // Skeleton rows only on the very first load; afterwards a missing value is "-".
    const pricesLoaded = Object.keys(prices).length > 0 || markets.isFetched;
    const showSkeleton = !pricesLoaded && cashTokenQuery.isLoading;

    const getPriceUsd = (symbol: string): number | null => {
        const market = marketSymbolFor(symbol);
        return market && prices[market] ? prices[market].price : null;
    };

    // Live BCH/USD — every CashToken sats→USD conversion uses it; 0 = unknown.
    const bchPriceUsd = prices['BCH']?.price ?? 0;

    const filteredAssets = ASSETS.filter(a => activeChain === 'All' || a.chain === activeChain);
    const filteredCashTokens = activeChain === 'All' || activeChain === 'Bitcoin Cash' ? cashTokens : [];

    const formatPct = (val: number | null | undefined) => {
        if (val === null || val === undefined || !Number.isFinite(val)) return <span className="text-muted-foreground">-</span>;
        const isPos = val >= 0;
        return (
            <span className={cn("flex items-center justify-end gap-0.5", isPos ? "text-green-400" : "text-red-400")}>
                {isPos ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {Math.abs(val).toFixed(2)}%
            </span>
        );
    };

    const formatUsd = (n: number, opts?: { min?: number; max?: number }) =>
        `$${n.toLocaleString(undefined, {
            minimumFractionDigits: opts?.min ?? 2,
            maximumFractionDigits: opts?.max ?? 6,
        })}`;

    return (
        <div className="rounded-xl border border-white/[0.08] bg-black/40 backdrop-blur-md overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />

            {isRefetching && !showSkeleton && (
                <div className="absolute top-0 left-0 right-0 h-0.5 overflow-hidden z-10">
                    <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent animate-loading-bar" />
                </div>
            )}

            <div className="px-4 py-2 border-b border-white/[0.06] flex items-center justify-between text-xs text-muted-foreground">
                <span>Prices via <span className="text-emerald-400 font-medium">BCHMesh market feed</span> (exchange median), CashToken metrics via <span className="text-emerald-400 font-medium">Cauldron Indexer</span></span>
                <span className={cn(
                    "text-[10px] font-semibold px-2 py-0.5 rounded-full border",
                    isMainnet
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
                )}>
                    {isMainnet ? 'BCH Mainnet' : 'BCH Chipnet'}
                </span>
            </div>

            <div className="overflow-x-auto relative">
                <Table>
                    <TableHeader className="bg-white/[0.02] border-b border-white/[0.06]">
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="text-muted-foreground w-[250px]">Token</TableHead>
                            <TableHead className="text-muted-foreground text-right">Price</TableHead>
                            <TableHead className="text-muted-foreground text-right w-[100px]">1H</TableHead>
                            <TableHead className="text-muted-foreground text-right w-[100px]">1D</TableHead>
                            <TableHead className="text-muted-foreground text-right hidden md:table-cell">FDV / TVL</TableHead>
                            <TableHead className="text-muted-foreground text-right hidden sm:table-cell">Volume</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {showSkeleton ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <TableRow key={`skeleton-${i}`} className="border-white/[0.06]">
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-full bg-white/[0.04] animate-pulse" />
                                            <div className="flex flex-col gap-1.5">
                                                <div className="h-3 w-24 bg-white/[0.04] rounded animate-pulse" />
                                                <div className="h-2.5 w-16 bg-white/[0.03] rounded animate-pulse" />
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right"><div className="h-4 w-16 bg-white/[0.04] rounded animate-pulse ml-auto" /></TableCell>
                                    <TableCell className="text-right"><div className="h-4 w-12 bg-white/[0.04] rounded animate-pulse ml-auto" /></TableCell>
                                    <TableCell className="text-right"><div className="h-4 w-12 bg-white/[0.04] rounded animate-pulse ml-auto" /></TableCell>
                                    <TableCell className="text-right hidden md:table-cell"><div className="h-4 w-16 bg-white/[0.04] rounded animate-pulse ml-auto" /></TableCell>
                                    <TableCell className="text-right hidden sm:table-cell"><div className="h-4 w-16 bg-white/[0.04] rounded animate-pulse ml-auto" /></TableCell>
                                </TableRow>
                            ))
                        ) : filteredAssets.length === 0 && filteredCashTokens.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                                    No tokens found for this chain.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredAssets.map((asset) => {
                                const usd = getPriceUsd(asset.symbol);
                                const market = marketSymbolFor(asset.symbol);
                                const row = market ? markets.data?.[market] : undefined;
                                const live = market ? prices[market] : undefined;
                                const sourceLabel = live ? (live.sources.includes('pyth') ? 'Pyth' : 'Live') : null;

                                return (
                                    <TableRow
                                        key={`${asset.symbol}-${asset.chain}`}
                                        className="hover:bg-white/[0.02] border-white/[0.06] transition-colors cursor-pointer"
                                        onClick={() => navigate(`/explore/tokens/${encodeURIComponent(asset.symbol)}`)}
                                    >
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <TokenChainIcon tokenIcon={asset.icon} tokenName={asset.name} chain={asset.chainId} size="sm" />
                                                <div className="flex flex-col min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-semibold text-sm truncate">{asset.name}</span>
                                                        <span className="text-xs text-muted-foreground uppercase tracking-wide">{asset.symbol}</span>
                                                    </div>
                                                    <div className="mt-0.5 flex items-center gap-1.5">
                                                        <Badge variant="outline" className={cn(
                                                            "text-[9px] h-3.5 px-1.5 border-white/10 font-medium",
                                                            asset.chain === 'Solana' && 'text-indigo-300',
                                                            asset.chain === 'Movement' && 'text-primary',
                                                            asset.chain === 'Bitcoin Cash' && 'text-emerald-400',
                                                            asset.chain === 'EVM' && 'text-yellow-300',
                                                            asset.chain === 'Monero' && 'text-orange-400'
                                                        )}>
                                                            {asset.chain}
                                                        </Badge>
                                                        {live && sourceLabel && (
                                                            <span
                                                                className="text-[8px] font-semibold text-emerald-400/70 uppercase tracking-wider"
                                                                title={`Median of ${live.sources.join(', ')}`}
                                                            >
                                                                {sourceLabel}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right font-medium">
                                            {usd !== null
                                                ? formatUsd(usd, { max: usd < 1 ? 6 : 2 })
                                                : pricesLoaded
                                                    ? <span className="text-muted-foreground">-</span>
                                                    : <div className="h-4 w-16 bg-white/5 rounded animate-pulse ml-auto" />}
                                        </TableCell>
                                        <TableCell className="text-right text-sm">
                                            {formatPct(row?.change1h)}
                                        </TableCell>
                                        <TableCell className="text-right text-sm">
                                            {formatPct(live?.change24h)}
                                        </TableCell>
                                        <TableCell className="text-right text-muted-foreground font-medium hidden md:table-cell text-sm">
                                            {formatCompactNumber(row?.fdv)}
                                        </TableCell>
                                        <TableCell className="text-right text-muted-foreground font-medium hidden sm:table-cell text-sm">
                                            {formatCompactNumber(row?.volume24h)}
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}

                        {!showSkeleton && filteredCashTokens.map(ct => {
                            const { symbol: sym, iconRaw } = CauldronService.metadataOf(ct);
                            const icon = resolveTokenIconUri(iconRaw ?? logoForSymbol(sym), ct.token_id);
                            const registered = ct.metadata_source !== 'cauldron-listing';
                            const displayName = registered
                                ? (ct.display_name || sym)
                                : `Unregistered ${ct.token_id.slice(0, 6)}…`;
                            const change24h = Number.isFinite(ct.change_24h_bp) ? ct.change_24h_bp / 100 : null; // bp → percent
                            const change7d = Number.isFinite(ct.change_7d_bp) ? ct.change_7d_bp / 100 : 0;
                            // price_now is sats per whole (display) token
                            const tokenBchPrice = ct.price_now ? ct.price_now / 1e8 : 0;
                            // Prefer our BCH/USD so every row shares one rate; server USD otherwise
                            const calculatedUsdPrice = tokenBchPrice > 0 && bchPriceUsd > 0
                                ? tokenBchPrice * bchPriceUsd
                                : ct.price_now_usd > 0 ? ct.price_now_usd : 0;
                            const tvlBch = ct.tvl_sats ? ct.tvl_sats / 1e8 : 0;
                            const tvlUsd = bchPriceUsd > 0 ? tvlBch * bchPriceUsd : null;
                            const volBch = ct.trade_volume ? ct.trade_volume / 1e8 : 0;
                            const volUsd = bchPriceUsd > 0 ? volBch * bchPriceUsd : null;

                            return (
                                <TableRow
                                    key={ct.token_id}
                                    className="hover:bg-white/[0.02] border-white/[0.06] transition-colors cursor-pointer"
                                    onClick={() => navigate(`/explore/tokens/ct-${ct.token_id}`)}
                                >
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <TokenChainIcon tokenIcon={icon} tokenName={registered ? displayName : sym} chain="bitcoin-cash" size="sm" />
                                            <div className="flex flex-col min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span
                                                        className={cn("font-semibold text-sm truncate", !registered && "text-muted-foreground")}
                                                        title={registered ? displayName : ct.token_id}
                                                    >
                                                        {displayName}
                                                    </span>
                                                    {registered && <span className="text-xs text-muted-foreground uppercase tracking-wide">{sym}</span>}
                                                </div>
                                                <div className="mt-0.5 flex items-center gap-1.5">
                                                    <Badge variant="outline" className="text-[9px] h-3.5 px-1.5 border-emerald-500/20 text-emerald-400 font-medium">
                                                        <Layers className="w-2.5 h-2.5 mr-1 inline" />
                                                        CashToken
                                                    </Badge>
                                                    {!registered && (
                                                        <Badge
                                                            variant="outline"
                                                            className="text-[9px] h-3.5 px-1.5 border-amber-500/20 text-amber-300/80 font-medium"
                                                            title="No BCMR registry describes this token — name, symbol and decimals are unverified"
                                                        >
                                                            Unverified
                                                        </Badge>
                                                    )}
                                                    <span className="text-[8px] font-mono text-muted-foreground/60 truncate max-w-[80px]" title={ct.token_id}>
                                                        {ct.token_id.slice(0, 6)}…{ct.token_id.slice(-4)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right font-medium">
                                        <div className="flex flex-col items-end">
                                            <span>{calculatedUsdPrice > 0 ? formatUsd(calculatedUsdPrice, { min: 2, max: calculatedUsdPrice < 0.01 ? 10 : 6 }) : '-'}</span>
                                            {ct.price_now ? (
                                                <span className="text-xs text-muted-foreground">{ct.price_now.toLocaleString(undefined, { maximumFractionDigits: ct.price_now < 1 ? 6 : 2 })} sats</span>
                                            ) : null}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right text-sm">
                                        <span className="text-muted-foreground">-</span>
                                    </TableCell>
                                    <TableCell className="text-right text-sm">
                                        <div className="flex flex-col items-end">
                                            {formatPct(change24h)}
                                            {Number.isFinite(change7d) && ct.change_7d_bp !== 0 && (
                                                <span className="text-[10px] text-muted-foreground">7d: {change7d >= 0 ? '+' : ''}{change7d.toFixed(2)}%</span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right text-muted-foreground font-medium hidden md:table-cell text-sm">
                                        {tvlBch > 0 ? (
                                            <div className="flex flex-col items-end">
                                                <span className="text-foreground">{formatCompactNumber(tvlUsd)}</span>
                                                <span className="text-[10px] text-muted-foreground">{tvlBch.toFixed(4)} BCH</span>
                                            </div>
                                        ) : '-'}
                                    </TableCell>
                                    <TableCell className="text-right text-muted-foreground font-medium hidden sm:table-cell text-sm">
                                        {volBch > 0 ? (
                                            <div className="flex flex-col items-end">
                                                <span className="text-foreground">{formatCompactNumber(volUsd)}</span>
                                                <span className="text-[10px] text-muted-foreground">{volBch.toFixed(4)} BCH</span>
                                            </div>
                                        ) : '-'}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
