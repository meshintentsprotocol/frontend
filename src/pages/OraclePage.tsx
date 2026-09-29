import { useEffect, useState, useCallback } from "react";
import { PriceService } from "@/lib/pyth";
import { PriceData } from "@/types";
import { cn } from "@/lib/utils";
import { ArrowUpRight, ArrowDownRight, RefreshCcw, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CauldronTokenData, CauldronService } from "@/lib/cauldron";
import { useWDK } from "@/context/WDKProvider";
import { TokenChainIcon } from "@/components/common/TokenChainIcon";
import { resolveTokenIconUri } from "@/lib/tokenIcons";

const ASSETS = [
    // Movement Chain
    { symbol: "MOVE", name: "Movement Coin", chain: "Movement", priceKey: "MOVE", icon: "https://raw.githubusercontent.com/kitelabs-io/mvmt-tokens/main/logos/MOVE.png" },
    { symbol: "USDC.e", name: "Bridged USDC", chain: "Movement", priceKey: "USDC.e", icon: "https://raw.githubusercontent.com/kitelabs-io/mvmt-tokens/main/logos/USDC.png" },
    { symbol: "USDT.e", name: "Bridged USDT", chain: "Movement", priceKey: "USDT.e", icon: "https://raw.githubusercontent.com/kitelabs-io/mvmt-tokens/main/logos/USDT.png" },

    // Solana Chain
    { symbol: "SOL", name: "Solana", chain: "Solana", priceKey: "SOL", icon: "/assets/solanaLogo.png" },
    { symbol: "USDC", name: "USD Coin", chain: "Solana", priceKey: "USDC", icon: "/logos/usd-coin-usdc-logo.svg" },
    { symbol: "USDT", name: "Tether", chain: "Solana", priceKey: "USDT", icon: "/logos/usd-coin-usdc-logo.svg" },

    // Bitcoin Cash
    { symbol: "BCH", name: "Bitcoin Cash", chain: "Bitcoin Cash", priceKey: "BCH", icon: "/logos/bitcoin-cash-bch-logo.svg" },
];

export function OraclePage() {
    const wdk = useWDK();
    const isMainnet = wdk.bchNetwork === 'mainnet';

    const [prices, setPrices] = useState<Record<string, PriceData>>({});
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [cashTokens, setCashTokens] = useState<CauldronTokenData[]>([]);

    const fetchPrices = useCallback(async () => {
        setLoading(true);
        try {
            const data = await PriceService.getLatestPrices();
            setPrices(data);
            const cTokensRaw = await CauldronService.getTopCashTokens(8, isMainnet);
            setCashTokens(cTokensRaw);
            setLastUpdated(new Date());
        } catch (e) {
            console.error("Failed to fetch oracles", e);
        }
        setLoading(false);
    }, [isMainnet]);

    useEffect(() => {
        fetchPrices();
        const interval = setInterval(fetchPrices, 10000); // Poll every 10s
        return () => clearInterval(interval);
    }, [fetchPrices]);

    return (
        <div className="container mx-auto p-8 max-w-5xl space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Movement Oracles</h1>
                    <p className="text-muted-foreground mt-2">
                        Real-time price feeds powered by <a href="https://pyth.network" className="text-primary hover:underline font-medium">Pyth Network</a>
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground">
                        Last updated: {lastUpdated ? lastUpdated.toLocaleTimeString() : 'Never'}
                    </span>
                    <Button variant="outline" size="icon" onClick={fetchPrices} disabled={loading}>
                        <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {ASSETS.map((asset) => {
                    const priceData = prices[asset.priceKey];
                    const price = PriceService.formatPrice(priceData);
                    // Mock change for demo since Pyth Hermes Latest doesn't give 24h change directly without historical query
                    const change = (Math.random() * 5) * (Math.random() > 0.5 ? 1 : -1);

                    return (
                        <div key={asset.symbol} className="bg-card border rounded-xl p-6 shadow-sm flex flex-col justify-between h-[180px] hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-accent/10 p-2 flex items-center justify-center overflow-hidden">
                                        <img src={asset.icon} alt={asset.name} className="h-full w-full object-contain" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold">{asset.symbol}</h3>
                                        <p className="text-xs text-muted-foreground">{asset.name}</p>
                                    </div>
                                </div>
                                <Badge variant={asset.chain === 'Movement' ? 'default' : 'secondary'} className={cn(
                                    asset.chain === 'Solana' && 'bg-indigo-500 hover:bg-indigo-600 text-white',
                                    asset.chain === 'Bitcoin Cash' && 'bg-emerald-500 hover:bg-emerald-600 text-white',
                                    asset.chain === 'Movement' && 'bg-primary',
                                )}>
                                    {asset.chain}
                                </Badge>
                            </div>

                            <div className="space-y-1">
                                {loading && !price ? (
                                    <div className="h-8 w-24 bg-muted animate-pulse rounded" />
                                ) : (
                                    <div className="text-2xl font-bold">
                                        ${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                                    </div>
                                )}

                                <div className={cn("flex items-center text-sm font-medium", change >= 0 ? "text-green-500" : "text-red-500")}>
                                    {change >= 0 ? <ArrowUpRight className="mr-1 h-3 w-3" /> : <ArrowDownRight className="mr-1 h-3 w-3" />}
                                    {Math.abs(change).toFixed(2)}%
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {cashTokens.length > 0 && (
                <div className="mt-12 space-y-6">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">Top CashTokens</h2>
                        <p className="text-sm text-muted-foreground mt-1">Live data from Cauldron Indexer</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {(() => {
                            const bchPriceData = prices['BCH'];
                            const bchPriceUsd = bchPriceData ? PriceService.formatPrice(bchPriceData) : 0;
                            return cashTokens.map(ct => {
                                const { symbol: sym, iconRaw } = CauldronService.metadataOf(ct);
                                const icon = resolveTokenIconUri(iconRaw, ct.token_id);
                                const change24h = ct.change_24h_bp / 100;
                                const isPositive = change24h >= 0;
                                const tokenBchPrice = ct.price_now ? ct.price_now / 1e8 : 0;
                                const calculatedUsdPrice = ct.price_now_usd > 0 ? ct.price_now_usd : (tokenBchPrice * bchPriceUsd);

                                return (
                                    <div key={ct.token_id} className="bg-card border border-emerald-500/20 rounded-xl p-6 shadow-sm flex flex-col justify-between h-[180px] hover:border-emerald-500/40 transition-colors">
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-3">
                                                <TokenChainIcon tokenIcon={icon} tokenName={ct.display_name || sym} chain="bitcoin-cash" size="md" />
                                                <div className="overflow-hidden">
                                                    <h3 className="font-semibold truncate max-w-[100px]">{sym}</h3>
                                                    <p className="text-xs text-muted-foreground truncate max-w-[100px]">{ct.display_name}</p>
                                                </div>
                                            </div>
                                            <Badge variant="secondary" className="bg-emerald-500 hover:bg-emerald-600 text-white flex items-center gap-1">
                                                <Layers className="w-3 h-3" />
                                                CashToken
                                            </Badge>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="text-xl font-bold font-mono">
                                                <span>{calculatedUsdPrice > 0 ? `$${calculatedUsdPrice.toFixed(6)}` : 'N/A'}</span>
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                {ct.price_now ? `${ct.price_now.toFixed(2)} sats` : 'N/A'}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                TVL: {ct.tvl_sats ? `${(ct.tvl_sats / 1e8).toFixed(4)} BCH` : 'N/A'}
                                                {ct.trade_volume ? ` · Vol: ${(ct.trade_volume / 1e8).toFixed(4)} BCH` : ''}
                                            </p>
                                            <div className={cn("flex items-center text-sm font-medium", isPositive ? "text-green-500" : "text-red-500")}>
                                                {isPositive ? <ArrowUpRight className="mr-1 h-3 w-3" /> : <ArrowDownRight className="mr-1 h-3 w-3" />}
                                                {Math.abs(change24h).toFixed(2)}% (24h)
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        })()}
                    </div>
                </div>
            )}

            <div className="bg-muted/30 rounded-lg p-6 text-center border-dashed border-2">
                <h3 className="font-semibold mb-2">Build with Oracles</h3>
                <p className="text-sm text-muted-foreground mb-4">
                    Access these feeds in your Move smart contracts to build DeFi applications on Movement.
                </p>
                <div className="flex justify-center gap-4">
                    <Button variant="link" className="text-primary" asChild>
                        <a href="https://docs.movementnetwork.xyz/devs/oracles" target="_blank" rel="noreferrer">
                            Read the Docs &rarr;
                        </a>
                    </Button>
                    <Button variant="link" className="text-muted-foreground" asChild>
                        <a href="/">
                            Powered by Intent Protocol &uarr;
                        </a>
                    </Button>
                </div>
            </div>
        </div>
    );
}
