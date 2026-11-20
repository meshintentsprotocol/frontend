import { useQuery } from '@tanstack/react-query';
import { CauldronService, type CauldronTokenData } from '@/lib/cauldron';
import { PriceService } from '@/lib/pyth';
import { MarketService, marketSymbolFor, type MarketDetail } from '@/lib/marketData';
import { resolveTokenIconUri } from '@/lib/tokenIcons';
import { BcmrClient } from '@/lib/bcmr';
import { logoForSymbol } from '@/lib/tokenLogos';

export interface TokenDetail {
    symbol: string;
    name: string;
    icon: string;
    decimals: number;
    chain: string;
    isCashToken: boolean;
    // price
    priceUsd: number;
    priceSats?: number;
    change1h: number | null;
    change24h: number | null;
    change7d: number | null;
    // market stats
    marketCap: number | null;
    fdv: number | null;
    volume24h: number | null;
    tvlUsd: number | null;
    high24h: number | null;
    low24h: number | null;
    ath: number | null;
    atl: number | null;
    circulatingSupply: number | null;
    totalSupply: number | null;
    // meta
    description: string;
    website: string | null;
    explorerLinks: string[];
    bcmrCategory?: string;
    metadataSource?: string;
    metadataStatus?: 'available' | 'missing' | 'unavailable';
    migratedTo?: string | null;
    // raw data for advanced use
    raw?: MarketDetail | CauldronTokenData;
}

/** Live BCH/USD from the mesh feed; 0 when unavailable (USD fields then show "–"). */
async function liveBchUsd(): Promise<number> {
    const prices = await PriceService.getLatestPrices();
    return prices['BCH'] ? PriceService.formatPrice(prices['BCH']) : 0;
}

function resolveChain(sym: string, isMainnet: boolean): string {
    if (sym.endsWith('(MOVE)')) return 'Movement';
    switch (sym) {
        case 'BTC':  return 'Bitcoin';
        case 'BCH':  return 'Bitcoin Cash';
        case 'SOL':  return 'Solana';
        case 'USDC': return 'Solana';
        case 'XMR':  return 'Monero';
        case 'MOVE': return 'Movement';
        case 'BNB':  return isMainnet ? 'BNB Chain' : 'BNB Chain';
        case 'USDT': return isMainnet ? 'BNB Chain' : 'Ethereum';
        case 'ETH':  return 'Ethereum';
        default:     return 'EVM';
    }
}

export function useTokenDetail(
    tokenId: string,
    isCashToken: boolean,
    isMainnet: boolean
) {
    return useQuery<TokenDetail | null>({
        queryKey: ['token-detail', tokenId, isCashToken, isMainnet],
        queryFn: async () => {

            // ── CashToken ────────────────────────────────────────────────────
            if (isCashToken) {
                const [market, lookup, bchPrice] = await Promise.all([
                    CauldronService.getTokenDetail(tokenId, isMainnet),
                    BcmrClient.get(tokenId, isMainnet).then(metadata => ({ metadata, unavailable: false })).catch(() => ({ metadata: null, unavailable: true })),
                    liveBchUsd(),
                ]);
                const bcmr = lookup.metadata;
                if (!market && !bcmr) return null;

                // No Cauldron pool (e.g. a wallet-held token) — metadata-only row
                const listing: CauldronTokenData = market ?? {
                    token_id: bcmr!.category,
                    display_name: bcmr!.name,
                    display_symbol: bcmr!.symbol,
                    score_rank: 0, trade_volume: 0, tvl_sats: 0, tvl_tokens: 0,
                    price_now: 0, price_now_usd: 0, price_24h: 0, price_24h_usd: 0,
                    change_24h_bp: 0, change_7d_bp: 0,
                };
                const detail = CauldronService.applyMetadata(listing, bcmr);
                const meta = CauldronService.metadataOf(detail, bcmr);

                const tokenBchPrice = detail.price_now ? detail.price_now / 1e8 : 0;
                const priceUsd = detail.price_now_usd
                    || (tokenBchPrice > 0 && bchPrice > 0 ? tokenBchPrice * bchPrice : 0);

                const tvlBch = detail.tvl_sats ? detail.tvl_sats / 1e8 : 0;
                const volBch = detail.trade_volume ? detail.trade_volume / 1e8 : 0;

                // change_24h_bp: Cauldron reports in basis points (1% = 100bp)
                const change24h = !market ? null : (detail.change_24h_bp != null && detail.change_24h_bp !== 0)
                    ? detail.change_24h_bp / 100
                    : (detail.change_24h_usd_bp != null ? detail.change_24h_usd_bp / 100 : null);
                const change7d = !market ? null : (detail.change_7d_bp != null && detail.change_7d_bp !== 0)
                    ? detail.change_7d_bp / 100
                    : (detail.change_7d_usd_bp != null ? detail.change_7d_usd_bp / 100 : null);

                const network = isMainnet ? '' : 'chipnet.';
                const explorerBase = isMainnet
                    ? `https://explorer.bitcoinunlimited.info/token/${detail.token_id}`
                    : `https://${network}chaingraph.cash/token/${detail.token_id}`;

                return {
                    symbol: meta.symbol,
                    name: meta.name || 'Unknown Token',
                    icon: meta.iconRaw || resolveTokenIconUri(null, detail.token_id),
                    decimals: meta.decimals,
                    chain: 'Bitcoin Cash',
                    isCashToken: true,
                    priceUsd,
                    priceSats: detail.price_now || undefined,
                    change1h: null,
                    change24h,
                    change7d,
                    marketCap: null,
                    fdv: null,
                    volume24h: volBch > 0 && bchPrice > 0 ? volBch * bchPrice : null,
                    tvlUsd: tvlBch > 0 && bchPrice > 0 ? tvlBch * bchPrice : null,
                    // Cauldron has no intraday high/low — avoid misleading price_24h_usd
                    high24h: null,
                    low24h: null,
                    ath: null,
                    atl: null,
                    circulatingSupply: null,
                    totalSupply: detail.tvl_tokens || null,
                    description: meta.description,
                    website: meta.website,
                    explorerLinks: [explorerBase],
                    bcmrCategory: detail.token_id,
                    metadataSource: bcmr?.source ?? detail.metadata_source,
                    metadataStatus: bcmr || (detail.metadata_source && detail.metadata_source !== 'cauldron-listing') ? 'available' : lookup.unavailable ? 'unavailable' : 'missing',
                    migratedTo: bcmr?.migratedTo,
                    raw: detail,
                } satisfies TokenDetail;
            }

            // ── Cross-chain (priced by the mesh server's market feed) ────────
            const sym = tokenId.toUpperCase();
            const marketSym = marketSymbolFor(sym);
            let detail = marketSym ? await MarketService.getMarket(marketSym).catch(() => null) : null;
            const info = detail?.info ?? null;

            // If the market detail call failed but we have spot prices from
            // the Bitfinex fallback, build a minimal detail so the page still
            // shows a live price rather than "$0.00".
            let fallbackPrice: number | null = null;
            let fallbackChange24h: number | null = null;
            if (!detail && marketSym) {
                try {
                    const spotPrices = await MarketService.getPrices();
                    const sp = spotPrices[marketSym];
                    if (sp && sp.price > 0) {
                        fallbackPrice = sp.price;
                        fallbackChange24h = sp.change24h;
                    }
                } catch { /* no-op */ }
            }

            const crossChainDecimals: Record<string, number> = {
                BCH: 8, SOL: 9, USDC: 6, USDT: 6, ETH: 18, BTC: 8, MOVE: 8, XMR: 12, BNB: 18,
            };

            return {
                symbol: sym,
                name: info?.name || sym,
                icon: logoForSymbol(sym) ?? info?.image ?? '',
                decimals: crossChainDecimals[marketSym ?? sym] ?? 8,
                chain: resolveChain(sym, isMainnet),
                isCashToken: false,
                priceUsd: detail && !detail.stale && detail.price ? detail.price : (fallbackPrice ?? 0),
                change1h: info?.change1h ?? null,
                change24h: detail?.change24h ?? fallbackChange24h ?? null,
                change7d: info?.change7d ?? null,
                marketCap: info?.marketCap ?? null,
                fdv: info?.fdv ?? null,
                volume24h: info?.volume24h ?? null,
                tvlUsd: null,
                high24h: info?.high24h ?? null,
                low24h: info?.low24h ?? null,
                ath: info?.ath ?? null,
                atl: info?.atl ?? null,
                circulatingSupply: info?.circulatingSupply ?? null,
                totalSupply: info?.totalSupply ?? null,
                description: info?.description ?? '',
                website: info?.homepage ?? null,
                explorerLinks: info?.explorers ?? [],
                raw: detail ?? undefined,
            } satisfies TokenDetail;
        },
        staleTime: 30_000,
        refetchInterval: 30_000,
        retry: 1,
    });
}
