// ============================================================================
// CauldronService — Fetch CashTokens from the Riften Labs Indexer (mainnet)
// ============================================================================
// API Docs: https://docs.riftenlabs.com/cauldron/API/cauldron/

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
    bcmr?: {
        name: string;
        description: string;
        token?: {
            category: string;
            decimals: number;
            symbol: string;
        };
        uris?: {
            icon?: string;
            web?: string;
        };
    };
}

/**
 * Resolve an icon URI from BCMR metadata.
 * Handles ipfs:// URIs, https:// URIs, and IPFS CIDs.
 */
function resolveIconUri(uri?: string | null): string | undefined {
    if (!uri) return undefined;
    if (uri.startsWith('https://') || uri.startsWith('http://')) return uri;
    if (uri.startsWith('ipfs://')) {
        const cid = uri.replace('ipfs://', '');
        return `https://ipfs.io/ipfs/${cid}`;
    }
    return undefined;
}

export const CauldronService = {
    CHIPNET_API_URL: 'https://indexer-chipnet.riften.net/cauldron',
    MAINNET_API_URL: 'https://indexer.riften.net/cauldron',

    /**
     * Fetches the top CashTokens from the Cauldron indexer sorted by volume.
     * Returns data in a format compatible with our internal Token interface.
     */
    async getTopCashTokens(limit = 20, isMainnet = false): Promise<CauldronTokenData[]> {
        const apiUrl = isMainnet ? this.MAINNET_API_URL : this.CHIPNET_API_URL;
        // Abort after 8s so a slow/unreachable indexer cannot leave the request
        // (and any query awaiting it) hanging indefinitely.
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
            // Centrally prune UNKNOWN tokens for all UI components (Wallet UI, Explore, Oracle, Token Selector)
            return rawData.filter(t => {
                const symbol = t.bcmr?.token?.symbol || t.display_symbol || 'UNKNOWN';
                return symbol !== 'UNKNOWN';
            });
        } catch (e: any) {
            // AbortError is expected — we intentionally abort after 8 s via controller.
            // Only log genuine failures to avoid console noise on slow connections.
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
     * Cauldron has no single-token endpoint — we search the cached list instead.
     */
    async getTokenDetail(tokenId: string, isMainnet = false): Promise<CauldronTokenData | null> {
        const list = await this.getTopCashTokens(200, isMainnet);
        return list.find(t => t.token_id === tokenId) ?? null;
    },

    /**
     * Fetch price history for charting.
     * period: '1h' | '24h' | '7d' | '30d' | '365d' | 'all'
     * Returns [{timestamp, price_sats}] sorted oldest first.
     * Falls back to empty array if the endpoint doesn't exist yet.
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
            const symbol = t.bcmr?.token?.symbol || t.display_symbol || 'UNKNOWN';
            const name = t.bcmr?.name || t.display_name || symbol;
            const iconRaw = t.bcmr?.uris?.icon;
            const icon = resolveIconUri(iconRaw) || `https://api.dicebear.com/7.x/identicon/svg?seed=${t.token_id}`;

            const decimals = t.bcmr?.token?.decimals || 0;
            return {
                symbol: symbol.toUpperCase(),
                name,
                icon,
                decimals,
                type: t.token_id,
                chain: "bch",
                categoryId: t.token_id,
                // Cauldron already reports these per WHOLE token — no decimal
                // scaling. `price_now_usd` = USD/token, `price_now` = sats/token.
                priceUsd: t.price_now_usd || 0,
                priceSats: t.price_now || 0,
            };
        });
    }
};
