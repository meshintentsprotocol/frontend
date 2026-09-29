// ============================================================================
// BcmrClient — CashToken metadata from BCMR (CHIP-2022-10)
// ============================================================================
// Server-first: BCHMesh `/bcmr` (BCMR indexer → Cauldron → embedded registry,
// cached server-side). If the server is unreachable, falls back to the public
// Paytaca BCMR indexer directly. Metadata only — prices stay in cauldron.ts.
// Docs: devrel-agent-context/MeshDocs/TokenDataAPIdocs

import { BCH_MESH_SERVER_URL } from './config';

export type TokenMetadataSource = 'bcmr-indexer' | 'cauldron' | 'embedded';

export interface TokenMetadata {
    category: string;
    network: 'mainnet' | 'chipnet';
    name: string;
    symbol: string;
    /** BCMR `token.decimals` (0 when the registry omits it) */
    decimals: number;
    description: string;
    /** Raw icon URI (ipfs:// / https:// / data:) — pass through resolveTokenIconUri */
    icon: string | null;
    uris: Record<string, string>;
    isNft: boolean;
    nftType: 'sequential' | 'parsable' | null;
    nfts: unknown | null;
    source: TokenMetadataSource;
    snapshotTimestamp: string | null;
    migratedTo: string | null;
    fetchedAt: number;
}

const PAYTACA_URLS = {
    mainnet: 'https://bcmr.paytaca.com',
    chipnet: 'https://bcmr-chipnet.paytaca.com',
} as const;

const SERVER_TIMEOUT_MS = 3500;
const DIRECT_TIMEOUT_MS = 8000;
const FOUND_TTL_MS = 30 * 60 * 1000;
const MISSING_TTL_MS = 10 * 60 * 1000;
const MAX_BATCH = 100;

const CATEGORY_RE = /^[0-9a-f]{64}$/;

export function normalizeCategory(raw: string | null | undefined): string | null {
    const c = (raw ?? '').trim().toLowerCase().replace(/^0x/, '');
    return CATEGORY_RE.test(c) ? c : null;
}

// ── Direct Paytaca normalisation (mirrors meshserver/src/bcmr/bcmrService.ts) ─

const SAFE_URI = /^(https?:\/\/|ipfs:\/\/)/i;
const SAFE_ICON = /^(https?:\/\/|ipfs:\/\/|data:image\/)/i;
const clip = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function sanitizeUris(raw: unknown): Record<string, string> {
    const out: Record<string, string> = {};
    if (!raw || typeof raw !== 'object') return out;
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
        if (typeof value !== 'string' || key.length > 32) continue;
        const v = value.trim();
        const ok = key === 'icon' || key === 'image' ? SAFE_ICON.test(v) : SAFE_URI.test(v);
        if (ok && v.length <= 4096) out[key] = v;
    }
    return out;
}

function fromPaytaca(category: string, network: 'mainnet' | 'chipnet', body: any): TokenMetadata | null {
    if (!body || body.error || !body.token) return null;
    const symbol = clip(body.token.symbol, 32).toUpperCase();
    const rawDecimals = body.token.decimals;
    const decimals = rawDecimals === undefined || rawDecimals === null ? 0 : Number(rawDecimals);
    if (!symbol || !Number.isInteger(decimals) || decimals < 0 || decimals > 18) return null;
    const uris = sanitizeUris(body.uris);
    const tokenCategory = normalizeCategory(body.token.category);
    return {
        category,
        network,
        name: clip(body.name, 128) || symbol,
        symbol,
        decimals,
        description: clip(body.description, 2000),
        icon: uris.icon ?? null,
        uris,
        isNft: body.is_nft === true,
        nftType: body.nft_type === 'sequential' || body.nft_type === 'parsable' ? body.nft_type : null,
        nfts: body.token.nfts ?? null,
        source: 'bcmr-indexer',
        snapshotTimestamp: null,
        migratedTo: tokenCategory && tokenCategory !== category ? tokenCategory : null,
        fetchedAt: Date.now(),
    };
}

// ── Transport ────────────────────────────────────────────────────────────────

async function fetchJson(url: string, timeoutMs: number, init?: RequestInit): Promise<{ status: number; body: any }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, { ...init, signal: controller.signal });
        const body = await res.json().catch(() => null);
        return { status: res.status, body };
    } finally {
        clearTimeout(timer);
    }
}

async function fetchDirect(category: string, network: 'mainnet' | 'chipnet'): Promise<TokenMetadata | null> {
    try {
        const { status, body } = await fetchJson(`${PAYTACA_URLS[network]}/api/tokens/${category}/`, DIRECT_TIMEOUT_MS);
        if (status !== 200) return null;
        return fromPaytaca(category, network, body);
    } catch {
        return null;
    }
}

// ── Client with in-memory cache ──────────────────────────────────────────────

interface CacheEntry { value: TokenMetadata | null; expiresAt: number }
const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<TokenMetadata | null>>();

const keyOf = (category: string, network: string) => `${network}:${category}`;

function remember(category: string, network: string, value: TokenMetadata | null): void {
    cache.set(keyOf(category, network), {
        value,
        expiresAt: Date.now() + (value ? FOUND_TTL_MS : MISSING_TTL_MS),
    });
}

function cached(category: string, network: string): TokenMetadata | null | undefined {
    const entry = cache.get(keyOf(category, network));
    if (!entry || entry.expiresAt < Date.now()) return undefined;
    return entry.value;
}

export const BcmrClient = {
    /** Metadata for one token category, or null if no registry describes it. */
    async get(categoryRaw: string, isMainnet: boolean): Promise<TokenMetadata | null> {
        const category = normalizeCategory(categoryRaw);
        if (!category) return null;
        const network = isMainnet ? 'mainnet' : 'chipnet';

        const hit = cached(category, network);
        if (hit !== undefined) return hit;
        const key = keyOf(category, network);
        const pending = inflight.get(key);
        if (pending) return pending;

        const task = (async () => {
            try {
                const { status, body } = await fetchJson(
                    `${BCH_MESH_SERVER_URL}/bcmr/${category}?network=${network}`,
                    SERVER_TIMEOUT_MS,
                );
                if (status === 200 && body?.symbol) {
                    remember(category, network, body as TokenMetadata);
                    return body as TokenMetadata;
                }
                // Server already tried every source — trust its miss
                if (status === 404) {
                    remember(category, network, null);
                    return null;
                }
            } catch {
                // server unreachable — fall through to direct indexer
            }
            const direct = await fetchDirect(category, network);
            remember(category, network, direct);
            return direct;
        })().finally(() => inflight.delete(key));

        inflight.set(key, task);
        return task;
    },

    /** Metadata for many categories; result is keyed by lowercase category. */
    async getMany(categoriesRaw: string[], isMainnet: boolean): Promise<Record<string, TokenMetadata | null>> {
        const network = isMainnet ? 'mainnet' : 'chipnet';
        const categories = [...new Set(categoriesRaw.map(normalizeCategory).filter((c): c is string => !!c))];
        const out: Record<string, TokenMetadata | null> = {};
        const missing: string[] = [];
        for (const c of categories) {
            const hit = cached(c, network);
            if (hit !== undefined) out[c] = hit;
            else missing.push(c);
        }
        if (missing.length === 0) return out;

        const unresolved: string[] = [];
        for (let i = 0; i < missing.length; i += MAX_BATCH) {
            const chunk = missing.slice(i, i + MAX_BATCH);
            try {
                const { status, body } = await fetchJson(`${BCH_MESH_SERVER_URL}/bcmr/batch`, SERVER_TIMEOUT_MS * 3, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ network, categories: chunk }),
                });
                if (status !== 200 || !body?.tokens) throw new Error(`HTTP ${status}`);
                for (const c of chunk) {
                    const value = (body.tokens[c] ?? null) as TokenMetadata | null;
                    remember(c, network, value);
                    out[c] = value;
                }
            } catch {
                unresolved.push(...chunk);
            }
        }

        // Server unavailable → resolve the rest directly, a few at a time
        for (let i = 0; i < unresolved.length; i += 4) {
            const slice = unresolved.slice(i, i + 4);
            const values = await Promise.all(slice.map(c => this.get(c, isMainnet)));
            slice.forEach((c, k) => { out[c] = values[k]; });
        }
        return out;
    },
};
