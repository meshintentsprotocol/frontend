import { useQuery } from '@tanstack/react-query';
import { CoinGeckoService, CoinGeckoService_extended, CG_ID_MAP, type CoinDetail } from '@/lib/coingecko';
import { CauldronService, type CauldronTokenData } from '@/lib/cauldron';
import { PriceService } from '@/lib/pyth';
import type { PriceData } from '@/types';
import { resolveTokenIconUri } from '@/lib/tokenIcons';
import { BcmrClient } from '@/lib/bcmr';

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
    // raw data for advanced use
    raw?: CoinDetail | CauldronTokenData;
}

// Approximate BCH/USD fallback when Pyth is unavailable
const BCH_FALLBACK_USD = 380;

function safeBchPrice(pythPrices: Record<string, PriceData>): number {
    try {
        const p = pythPrices['BCH'];
        if (p) {
            const val = PriceService.formatPrice(p);
            if (val > 0) return val;
        }
    } catch { /* non-fatal */ }
    return BCH_FALLBACK_USD;
}

function resolveChain(sym: string, isMainnet: boolean): string {
    switch (sym) {
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
                const [market, bcmr, pythPrices] = await Promise.all([
                    CauldronService.getTokenDetail(tokenId, isMainnet),
                    BcmrClient.get(tokenId, isMainnet).catch(() => null),
                    PriceService.getLatestPrices().catch(() => ({})),
                ]);
                if (!market && !bcmr) return null;

                // No Cauldron pool (e.g. a wallet-held token) — metadata-only row
                const detail: CauldronTokenData = market ?? {
                    token_id: bcmr!.category,
                    display_name: bcmr!.name,
                    display_symbol: bcmr!.symbol,
                    score_rank: 0, trade_volume: 0, tvl_sats: 0, tvl_tokens: 0,
                    price_now: 0, price_now_usd: 0, price_24h: 0, price_24h_usd: 0,
                    change_24h_bp: 0, change_7d_bp: 0,
                };
                const meta = CauldronService.metadataOf(detail, bcmr);

                const bchPrice = safeBchPrice(pythPrices as Record<string, PriceData>);

                const tokenBchPrice = detail.price_now ? detail.price_now / 1e8 : 0;
                const priceUsd = detail.price_now_usd
                    || (tokenBchPrice > 0 ? tokenBchPrice * bchPrice : 0);

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
                    icon: resolveTokenIconUri(meta.iconRaw, detail.token_id),
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
                    volume24h: volBch > 0 ? volBch * bchPrice : null,
                    tvlUsd: tvlBch > 0 ? tvlBch * bchPrice : null,
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
                    raw: detail,
                } satisfies TokenDetail;
            }

            // ── Cross-chain ──────────────────────────────────────────────────
            const sym = tokenId.toUpperCase();
            const cgId = CG_ID_MAP[sym];

            const [cgList, detail, pythPrices] = await Promise.all([
                CoinGeckoService.getMarketData([sym]).catch(() => ({})),
                cgId ? CoinGeckoService_extended.getCoinDetail(cgId) : Promise.resolve(null),
                PriceService.getLatestPrices().catch(() => ({})),
            ]);

            const cgMap = cgList as Record<string, import('@/lib/coingecko').CoinData | undefined>;
            const cg = cgMap[sym];
            const typedPyth = pythPrices as Record<string, PriceData>;
            const pythKey = Object.keys(typedPyth).find(k => k.toUpperCase() === sym);
            const priceFromPyth = pythKey ? PriceService.formatPrice(typedPyth[pythKey]) : 0;
            const priceUsd = (priceFromPyth > 0 ? priceFromPyth : cg?.current_price) ?? 0;

            const iconFallback = cg?.image || `/logos/${sym.toLowerCase()}.svg`;
            const icon = detail?.image?.large || detail?.image?.small || iconFallback;

            const crossChainDecimals: Record<string, number> = {
                BCH: 8, SOL: 9, USDC: 6, USDT: 6, ETH: 18, 'WETH.E': 8, MOVE: 8, XMR: 12, BNB: 18,
            };
            const decimals = crossChainDecimals[sym] ?? 8;

            // Safe access — CoinGecko may rate-limit; market_data fields may be absent
            const md = detail?.market_data;
            const links = detail?.links;

            const blockchainSites = Array.isArray(links?.blockchain_site)
                ? links.blockchain_site.filter((s: string) => Boolean(s)).slice(0, 3)
                : [];
            const homepage = Array.isArray(links?.homepage)
                ? (links.homepage.find((h: string) => Boolean(h)) ?? null)
                : null;
            const descriptionText = typeof detail?.description?.en === 'string'
                ? detail.description.en.replace(/<[^>]*>/g, '').trim()
                : '';

            return {
                symbol: sym,
                name: detail?.name || cg?.name || sym,
                icon,
                decimals,
                chain: resolveChain(sym, isMainnet),
                isCashToken: false,
                priceUsd,
                change1h: md?.price_change_percentage_1h_in_currency?.usd
                    ?? cg?.price_change_percentage_1h_in_currency
                    ?? null,
                change24h: md?.price_change_percentage_24h_in_currency?.usd
                    ?? cg?.price_change_percentage_24h_in_currency
                    ?? null,
                change7d: md?.price_change_percentage_7d_in_currency?.usd ?? null,
                marketCap: md?.market_cap?.usd ?? cg?.market_cap ?? null,
                fdv: md?.fully_diluted_valuation?.usd ?? cg?.fully_diluted_valuation ?? null,
                volume24h: md?.total_volume?.usd ?? cg?.total_volume ?? null,
                tvlUsd: null,
                high24h: md?.high_24h?.usd ?? null,
                low24h: md?.low_24h?.usd ?? null,
                ath: md?.ath?.usd ?? null,
                atl: md?.atl?.usd ?? null,
                circulatingSupply: md?.circulating_supply ?? null,
                totalSupply: md?.total_supply ?? null,
                description: descriptionText,
                website: homepage,
                explorerLinks: blockchainSites,
                raw: detail ?? undefined,
            } satisfies TokenDetail;
        },
        staleTime: 30_000,
        refetchInterval: 30_000,
        retry: 1,
    });
}
