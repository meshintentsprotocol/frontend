// ============================================================================
// CauldronService — Fetch CashTokens with Server-First & Direct Indexer Fallback
// ============================================================================
// API Docs: https://docs.riftenlabs.com/cauldron/API/cauldron/

import { BCH_MESH_SERVER_URL } from './config';
import { resolveTokenIconUri } from './tokenIcons';
import type { TokenMetadata } from './bcmr';

export interface CauldronTokenData {
    token_id: string;
    display_name: string;
    display_symbol: string;
    score_rank: number;
    trade_volume: number;
    tvl_sats: number;
    tvl_tokens: number;
    price_now: number;
    price_now_usd: number;
    price_24h: number;
    price_24h_usd: number;
    change_24h_bp: number;
    change_7d_bp: number;
    /** USD-denominated 24h / 7d change, in basis points (1% = 100bp). */
    change_24h_usd_bp?: number;
    change_7d_usd_bp?: number;
    /** Where the bcmr block came from: BCHMesh BCMR service, or Cauldron's own copy */
    metadata_source?: 'bcmr-indexer' | 'cauldron' | 'embedded' | 'cauldron-listing';
    bcmr?: {
        name?: string;
        description?: string;
        token?: {
            category?: string;
            decimals?: number;
            symbol?: string;
        };
        uris?: {
            icon?: string;
            web?: string;
        };
    };
}

export const CauldronService = {
    CHIPNET_API_URL: 'https://indexer-chipnet.riften.net/cauldron',
    MAINNET_API_URL: 'https://indexer.riften.net/cauldron',

    /**
     * Fetches the top CashTokens.
     * Tries:
     * 1. Local BCHMesh backend server (/tokens)
     * 2. Direct Cauldron indexer
     */
    async getTopCashTokens(limit = 50, isMainnet = false): Promise<CauldronTokenData[]> {
        const network = isMainnet ? 'mainnet' : 'chipnet';

        // 1. Try local BCHMesh aggregator server first
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 3500);
            const res = await fetch(
                `${BCH_MESH_SERVER_URL}/tokens?network=${network}&limit=${limit}`,
                { signal: controller.signal }
            );
            clearTimeout(timer);

            if (res.ok) {
                const data = await res.json();
                const tokensList = Array.isArray(data.tokens) ? data.tokens : (Array.isArray(data) ? data : []);
                if (tokensList.length > 0) {
                    return tokensList.map((t: any): CauldronTokenData => {
                        // Prefer the indexer's float price — priceSats is an integer
                        // (BigInt-derived) and truncates sub-sat tokens to 0.
                        const priceSats = Number(t.price_now || t.priceSats || 0);
                        const tvlSats = Number(t.tvlSats || t.tvl_sats || 0);
                        const change24h = Number(t.change24hBp ?? t.change_24h_bp ?? 0);
                        return {
                            token_id: t.categoryId || t.token_id,
                            display_name: t.name || t.display_name || t.symbol,
                            display_symbol: (t.symbol || t.display_symbol || 'UNKNOWN').toUpperCase(),
                            score_rank: t.score_rank || 0,
                            trade_volume: Number(t.trade_volume || t.volume24h || 0),
                            tvl_sats: tvlSats,
                            tvl_tokens: Number(t.tvl_tokens || 0),
                            price_now: priceSats,
                            price_now_usd: Number(t.priceUsd || t.price_now_usd || 0),
                            price_24h: Number(t.price_24h || 0),
                            price_24h_usd: Number(t.price_24h_usd || 0),
                            change_24h_bp: change24h,
                            change_7d_bp: Number(t.change7dBp ?? t.change_7d_bp ?? 0),
                            change_24h_usd_bp: Number(t.change_24h_usd_bp || change24h),
                            metadata_source: t.metadata_source ?? 'cauldron-listing',
                            bcmr: {
                                name: t.name,
                                description: t.description || '',
                                token: {
                                    category: t.categoryId || t.token_id,
                                    decimals: Number(t.decimals ?? 0),
                                    symbol: (t.symbol || '').toUpperCase(),
                                },
                                uris: {
                                    icon: t.icon,
                                    web: t.web || t.website,
                                },
                            },
                        };
                    }).filter((t: CauldronTokenData) => t.display_symbol !== 'UNKNOWN');
                }
            }
        } catch {
            // Non-fatal, proceed to direct indexer
        }

        // 2. Direct Cauldron indexer
        const apiUrl = isMainnet ? this.MAINNET_API_URL : this.CHIPNET_API_URL;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
        try {
            const res = await fetch(
                `${apiUrl}/tokens/list_cached?limit=${limit}&by=volume&order=desc`,
                { signal: controller.signal },
            );

            if (!res.ok) {
                console.warn("Cauldron API response not ok:", res.status);
                return [];
            }

            const rawData = await res.json() as CauldronTokenData[];
            return (Array.isArray(rawData) ? rawData : [])
                .map(t => ({ ...t, metadata_source: t.bcmr?.token ? 'cauldron' as const : 'cauldron-listing' as const }))
                .filter(t => this.metadataOf(t).symbol !== 'UNKNOWN');
        } catch (e: any) {
            if (e?.name !== 'AbortError') {
                console.warn('Cauldron API fetch error:', e?.message ?? e);
            }
            return [];
        } finally {
            clearTimeout(timer);
        }
    },

    /**
     * Fetch a single token's full detail by token_id.
     */
    async getTokenDetail(tokenId: string, isMainnet = false): Promise<CauldronTokenData | null> {
        const list = await this.getTopCashTokens(200, isMainnet);
        return list.find(t => t.token_id.toLowerCase() === tokenId.toLowerCase()) ?? null;
    },

    /**
     * Fetch price history for charting.
     * period: '1h' | '24h' | '7d' | '30d' | '365d' | 'all'
     */
    async getPriceHistory(
        tokenId: string,
        period: '1h' | '24h' | '7d' | '30d' | '365d' | 'all',
        isMainnet = false
    ): Promise<Array<{ timestamp: number; price_sats: number }>> {
        const apiUrl = isMainnet ? this.MAINNET_API_URL : this.CHIPNET_API_URL;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
        try {
            const res = await fetch(
                `${apiUrl}/tokens/${tokenId}/price_history?period=${period}`,
                { signal: controller.signal }
            );
            if (!res.ok) return [];
            const data = await res.json();
            return Array.isArray(data) ? data : (data.prices ?? data.history ?? []);
        } catch {
            return [];
        } finally {
            clearTimeout(timer);
        }
    },

    /**
     * The one place token metadata is read off a Cauldron row. The `bcmr` block
     * is BCMR data (from the BCHMesh BCMR service on the server path, Cauldron's
     * embedded copy on the direct path). Pass `bcmr` (a BcmrClient result) to
     * let a fresher BCMR lookup win.
     */
    metadataOf(t: CauldronTokenData, bcmr?: TokenMetadata | null): {
        symbol: string;
        name: string;
        decimals: number;
        iconRaw: string | undefined;
        description: string;
        website: string | null;
    } {
        const symbol = (bcmr?.symbol || t.bcmr?.token?.symbol || t.display_symbol || 'UNKNOWN').toUpperCase();
        const rawDecimals = bcmr?.decimals ?? t.bcmr?.token?.decimals ?? 0;
        const decimals = Number.isInteger(Number(rawDecimals)) ? Number(rawDecimals) : 0;
        return {
            symbol,
            name: bcmr?.name || t.bcmr?.name || t.display_name || symbol,
            decimals,
            iconRaw: bcmr?.icon ?? t.bcmr?.uris?.icon,
            description: bcmr?.description || t.bcmr?.description || '',
            website: bcmr?.uris.web ?? t.bcmr?.uris?.web ?? null,
        };
    },

    /**
     * Maps raw API data to our simplified Token-like shape for UI injection.
     */
    mapToTokens(data: CauldronTokenData[]): Array<{
        symbol: string;
        name: string;
        icon: string;
        decimals: number;
        type: string;
        chain: string;
        categoryId: string;
        priceUsd: number;
        priceSats: number;
    }> {
        return data.map(t => {
            const { symbol, name, iconRaw, decimals } = this.metadataOf(t);
            const icon = resolveTokenIconUri(iconRaw, t.token_id);

            return {
                symbol,
                name,
                icon,
                decimals,
                type: t.token_id,
                chain: "bch",
                categoryId: t.token_id,
                priceUsd: t.price_now_usd || 0,
                priceSats: t.price_now || 0,
            };
        });
    }
};
