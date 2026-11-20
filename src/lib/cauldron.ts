import { cashTokenDisplay } from './cashTokenDisplay';
// ============================================================================
// CauldronService — Fetch CashTokens with Server-First & Direct Indexer Fallback
// ============================================================================
// API Docs: https://docs.riftenlabs.com/cauldron/API/cauldron/

import { meshServerUrlFor } from './config';
import { resolveTokenIconUri } from './tokenIcons';
import { normalizeCategory, type TokenMetadata, BcmrClient } from './bcmr';

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
            image?: string;
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
        const meshUrl = meshServerUrlFor(isMainnet);

        // 1. Try local BCHMesh aggregator server first
        try {
            if (!meshUrl) throw new Error('Mesh server is not configured for this network');
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 3500);
            const res = await fetch(
                `${meshUrl}/tokens?network=${network}&limit=${limit}`,
                { signal: controller.signal }
            );
            clearTimeout(timer);

            if (res.ok) {
                const data = await res.json();
                if (data?.network !== network) throw new Error('Token list network mismatch');
                const tokensList = Array.isArray(data.tokens) ? data.tokens : (Array.isArray(data) ? data : []);
                if (tokensList.length > 0) {
                    return tokensList.filter((t: any) => normalizeCategory(t.categoryId || t.token_id) && (!t.network || t.network === network) && Number.isInteger(t.decimals) && t.decimals >= 0 && t.decimals <= 18).map((t: any): CauldronTokenData => {
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
        if (!tokenId || tokenId === '0x') return null;
        const cleanId = tokenId.toLowerCase();
        const list = await this.getTopCashTokens(200, isMainnet);
        const found = list.find(t => t.token_id.toLowerCase() === cleanId);
        if (found) return found;

        // Fallback: direct active pool query from Riften Indexer if token is outside top 200
        const apiUrl = isMainnet ? this.MAINNET_API_URL : this.CHIPNET_API_URL;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 6000);
        try {
            const res = await fetch(`${apiUrl}/pool/active?token=${cleanId}`, { signal: controller.signal });
            if (res.ok) {
                const data = await res.json();
                const active = data?.active ?? [];
                if (active.length > 0) {
                    const pool = active[0];
                    const sats = Number(pool.sats || pool.output?.amount || 0);
                    const tokens = Number(pool.tokens || pool.output?.token?.amount || 0);
                    const bcmr = await BcmrClient.get(cleanId, isMainnet).catch(() => null);
                    const dec = bcmr?.decimals ?? 0;
                    const price_now = tokens > 0 ? (sats / tokens) * (10 ** dec) : 0;
                    return {
                        token_id: cleanId,
                        display_name: bcmr?.name || cleanId.slice(0, 8),
                        display_symbol: (bcmr?.symbol || 'UNKNOWN').toUpperCase(),
                        score_rank: 0,
                        trade_volume: 0,
                        tvl_sats: sats,
                        tvl_tokens: tokens,
                        price_now,
                        price_now_usd: 0,
                        price_24h: 0,
                        price_24h_usd: 0,
                        change_24h_bp: 0,
                        change_7d_bp: 0,
                        metadata_source: bcmr ? 'bcmr-indexer' : 'cauldron',
                        bcmr: bcmr ? {
                            name: bcmr.name,
                            description: bcmr.description,
                            token: { category: cleanId, decimals: dec, symbol: bcmr.symbol },
                            uris: bcmr.uris,
                        } : undefined,
                    };
                }
            }
        } catch {
            // Ignore
        } finally {
            clearTimeout(timer);
        }

        return null;
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
        const decimals = typeof rawDecimals === 'number' && Number.isInteger(rawDecimals) && rawDecimals >= 0 && rawDecimals <= 18 ? rawDecimals : 0;
        const display = cashTokenDisplay(t.token_id, bcmr?.name || t.bcmr?.name || t.display_name, symbol);
        return {
            symbol: display.symbol,
            name: display.name,
            decimals,
            iconRaw: bcmr?.icon ?? bcmr?.uris?.image ?? t.bcmr?.uris?.icon ?? t.bcmr?.uris?.image,
            description: bcmr?.description || t.bcmr?.description || '',
            website: bcmr?.uris?.web ?? t.bcmr?.uris?.web ?? null,
        };
    },

    /** Correct all per-token metrics together when BCMR supplies newer decimals. */
    applyMetadata(t: CauldronTokenData, metadata: TokenMetadata | null | undefined): CauldronTokenData {
        if (!metadata || normalizeCategory(t.token_id) !== metadata.category) return t;
        const scale = 10 ** (metadata.decimals - this.metadataOf(t).decimals);
        return { ...t, display_name: metadata.name, display_symbol: metadata.symbol,
            price_now: t.price_now * scale, price_now_usd: t.price_now_usd * scale,
            price_24h: t.price_24h * scale, price_24h_usd: t.price_24h_usd * scale,
            tvl_tokens: t.tvl_tokens / scale, metadata_source: metadata.source,
            bcmr: { name: metadata.name, description: metadata.description,
                token: { category: metadata.category, decimals: metadata.decimals, symbol: metadata.symbol },
                uris: { ...metadata.uris, icon: metadata.icon ?? metadata.uris.icon } } };
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
            const icon = iconRaw || resolveTokenIconUri(undefined, t.token_id);

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
