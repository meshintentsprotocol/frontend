/**
 * Token rows the swap server contributes to the selector.
 *
 * Cross-chain USDC: one verified row per CCTP chain from /config, enriched by exact asset identity.
 * Mainnet 1Click capabilities coexist with CCTP/Jupiter on the same asset.
 */
import type { Token } from '@/types';
import { cctpInMode, localChain } from './cctpChains';
import { cctpChainOf, isCctpOnly, NATIVE_SOL_MINT, isNativeBch, jupiterMintOf, resolveRoute } from './routing';
import type { BchToken, SwapServerConfig } from './types';

export const USDC_ICON = '/logos/usd-coin-usdc-logo.svg';
export const BCH_ICON = '/logos/bitcoin-cash-bch-logo.svg';
export const NEAR_ICON = '/logos/near.svg';

export const isBchOnly = (token: Token) => token.swapServer?.product === 'bch';

/** Canonical chain mapping across frontend representations */
export function normalizeChainName(c: string | undefined): Token['chain'] {
    if (!c) return 'bch';
    const norm = c.toLowerCase().trim();
    if (norm === 'eth') return 'ethereum';
    if (norm === 'arb') return 'arbitrum';
    if (norm === 'op') return 'optimism';
    if (norm === 'sol') return 'solana';
    if (norm === 'pol') return 'polygon';
    if (norm === 'avax') return 'avalanche';
    if (norm === 'bsc' || norm === 'binance') return 'bsc';
    if (norm === 'base') return 'base';
    if (norm === 'near') return 'near' as Token['chain'];
    if (norm === 'bch' || norm === 'bitcoin-cash') return 'bch';
    return norm as Token['chain'];
}

/** Resolves an accurate token logo, falling back to CoinGecko CDN or chain icon */
export function resolveTokenIcon(b: BchToken): string {
    if (b.icon) return b.icon;
    const s = (b.symbol || '').toUpperCase().trim();

    if (s === 'BCH') return BCH_ICON;
    if (s === 'NEAR' || s === 'WNEAR') return NEAR_ICON;
    if (s === 'ETH' || s === 'WETH') return '/logos/ethereum-eth-logo.svg';
    if (s === 'SOL') return '/logos/solana.svg';
    if (s === 'BNB') return '/logos/bnb-bnb-logo.svg';
    if (s === 'USDC') return USDC_ICON;
    if (s === 'USDT') return '/logos/usdt-svgrepo-com.svg';
    if (s === 'BTC' || s === 'WBTC' || s === 'CBBTC') return '/logos/bitcoin-btc-logo.svg';
    if (s === 'ARB') return '/logos/arbitrum-arb-logo.svg';
    if (s === 'OP') return '/logos/optimism.svg';
    if (s === 'POL' || s === 'MATIC') return '/logos/polygon-matic-logo.svg';
    if (s === 'AVAX') return '/logos/avalanche-avax-logo.svg';
    if (s === 'MOVE') return '/logos/movement.svg';
    if (s === 'XMR') return '/logos/monero.svg';
    if (s === 'AURORA') return 'https://assets.coingecko.com/coins/images/20582/standard/aurora.png';

    // DefiLlama / CoinGecko cached logo CDN if coingeckoId exists
    if (b.coingeckoId) {
        return `https://icons.llamao.fi/token/coingecko:${b.coingeckoId}`;
    }

    return '';
}

/** Convert a 1Click BchToken catalog item into a Token row for selectors */
export function toTokenRow(b: BchToken): Token {
    const chain = normalizeChainName(b.chain);
    const icon = resolveTokenIcon(b);
    const native = !b.contractAddress && ((chain === 'bch' && b.symbol === 'BCH') || (chain === 'solana' && b.symbol === 'SOL') ||
        (['ethereum', 'base', 'arbitrum', 'optimism'].includes(chain ?? '') && b.symbol === 'ETH') ||
        (chain === 'bsc' && b.symbol === 'BNB') || (chain === 'polygon' && b.symbol === 'POL') || (chain === 'avalanche' && b.symbol === 'AVAX'));
    return {
        symbol: b.symbol,
        name: b.name,
        icon,
        decimals: b.decimals,
        type: native ? 'native' : chain === 'solana' ? 'spl-token' : 'erc20',
        chain,
        address: native ? (chain === 'solana' ? NATIVE_SOL_MINT : undefined) : b.contractAddress || b.assetId,
        network: 'mainnet',
        priceUsd: b.price,
        swapServer: {
            product: 'bch',
            chainKey: b.chain,
            assetId: b.assetId,
        },
    };
}

/** Enrich exact mainnet assets without replacing CCTP/Jupiter capabilities. */
export function withBchTokens(base: Token[], bchTokens: BchToken[] | undefined, isMainnet = true): Token[] {
    if (!isMainnet || !bchTokens?.length) return base;
    const out = [...base];
    for (const b of bchTokens) {
        if (!['bch', 'ethereum', 'base', 'arbitrum', 'optimism', 'bsc', 'solana', 'polygon', 'avalanche'].includes(normalizeChainName(b.chain) ?? '')) continue;
        const row = toTokenRow(b);
        const i = out.findIndex(x => tokenKey(x) === tokenKey(row) && x.network !== 'testnet');
        if (i < 0) out.push(row);
        else {
            const existing = out[i];
            out[i] = { ...existing, network: 'mainnet', disabled: false, comingSoon: false,
                icon: existing.icon || row.icon,
                swapServer: { ...(existing.swapServer ?? row.swapServer!), assetId: b.assetId } };
        }
    }
    return out;
}

/** Explicit network tags keep test contracts out of mainnet catalogs and vice versa. */
export function tokensInMode(base: Token[], isMainnet: boolean): Token[] {
    return base.filter(t => normalizeChainName(t.chain) !== 'near' && (!t.network || t.network === (isMainnet ? 'mainnet' : 'testnet')));
}

/** One USDC row per CCTP chain this build can sign for. */
export function cctpTokens(config: SwapServerConfig | undefined): Token[] {
    if (!config) return [];
    return config.cctp.chains.flatMap((c): Token[] => {
        const local = localChain(c.key);
        if (!local) return [];
        return [{
            network: config.cctp.network === 'mainnet' ? 'mainnet' : 'testnet',
            symbol: 'USDC', name: `USD Coin (${c.name})`, icon: USDC_ICON, decimals: 6,
            type: c.kind === 'evm' ? 'erc20' : 'spl-token',
            chain: local.tokenChain, address: c.usdc,
            swapServer: { product: 'cctp', chainKey: c.key },
        }];
    });
}

/** Add verified CCTP assets for this mode without overwriting different live contracts. */
export function withCctpTokens(base: Token[], config: SwapServerConfig | undefined, isMainnet: boolean): Token[] {
    if (!config || !cctpInMode(config, isMainnet)) return base;
    const out = tokensInMode(base, isMainnet);
    const same = (a?: string, b?: string) => !!a && !!b && (a === b || (a.startsWith('0x') && b.startsWith('0x') && a.toLowerCase() === b.toLowerCase()));
    for (const t of cctpTokens(config)) {
        if (out.some(x => x.chain === t.chain && !x.disabled && same(x.address, t.address))) continue;
        // Only an unconfigured placeholder can be replaced by symbol; live contracts keep their identity.
        const i = out.findIndex(x => x.chain === t.chain && x.symbol === t.symbol && x.disabled && !x.address);
        if (i < 0) out.push(t); else out[i] = t;
    }
    return out;
}

/** Order in which a counterpart chain is offered when the user has not picked one. */
const PREFERRED: NonNullable<Token['chain']>[] = ['ethereum', 'base', 'arbitrum', 'optimism', 'solana', 'arc'];

/**
 * After the user picks `picked` on one side: what the other side should become, if it has to change.
 */
export function pairAfterSelect(
    picked: Token, other: Token, ctx: { tokens: Token[]; config?: SwapServerConfig; isMainnet: boolean; mode?: SwapTokenMode; pickedIsSell?: boolean },
): { other?: Token; reset?: boolean } {
    if (ctx.mode && ctx.mode !== 'all') {
        const usable = (candidate: Token) => tokenSupportsMode(candidate, ctx.mode!, ctx) &&
            resolveRoute(ctx.pickedIsSell === false ? candidate : picked, ctx.pickedIsSell === false ? picked : candidate, ctx)?.kind !== 'unsupported';
        if (usable(other)) return {};
        const candidates = ctx.tokens.filter(usable);
        if (ctx.mode === 'cashtokens' || ctx.mode === 'crosschain') candidates.sort((a, b) => Number(isNativeBch(b)) - Number(isNativeBch(a)));
        return candidates[0] ? { other: candidates[0] } : {};
    }
    if (!ctx.config || !cctpInMode(ctx.config, ctx.isMainnet)) return {};
    const pickedChain = cctpChainOf(picked, ctx.config), otherChain = cctpChainOf(other, ctx.config);
    if (isCctpOnly(picked) && pickedChain && (!otherChain || otherChain.key === pickedChain.key)) {
        const candidates = ctx.tokens.filter(t => !t.disabled && cctpChainOf(t, ctx.config)?.key !== pickedChain.key && cctpChainOf(t, ctx.config));
        candidates.sort((a, b) => PREFERRED.indexOf(a.chain!) - PREFERRED.indexOf(b.chain!));
        return candidates[0] ? { other: candidates[0] } : {};
    }
    if (isCctpOnly(other) && !pickedChain) return { reset: true };
    return {};
}

/** Stable identity of a token across lists: its address or category when it has one, never the symbol alone. */
export function tokenKey(t: Token): string {
    const chain = normalizeChainName(t.chain);
    const address = t.categoryId ?? t.address;
    const id = address && (t.categoryId || address.startsWith('0x')) ? address.toLowerCase() : address;
    return `${chain}:${id ?? t.symbol}`;
}

/** Address/category identity is shared by catalog merging, selection and search. */
export function mergeTokenCatalog(base: Token[], extra: Token[]): Token[] {
    const rows = new Map(base.map(t => [tokenKey(t), t]));
    for (const t of extra) {
        const key = tokenKey(t), previous = rows.get(key);
        rows.set(key, previous ? { ...previous, ...t, swapServer: previous.swapServer ?? t.swapServer } : t);
    }
    return [...rows.values()];
}


export type SwapTokenMode = 'all' | 'crosschain' | 'cashtokens' | 'solana' | 'cctp';
type TokenModeContext = { isMainnet: boolean; config?: SwapServerConfig };

export function tokenSupportsMode(t: Token, mode: SwapTokenMode, ctx: TokenModeContext): boolean {
    if (t.disabled || t.chain === 'near' || (t.network && t.network !== (ctx.isMainnet ? 'mainnet' : 'testnet'))) return false;
    if (mode === 'all') return true;
    if (mode === 'cashtokens') return isNativeBch(t) || !!t.categoryId;
    if (mode === 'solana') return ctx.isMainnet && !!jupiterMintOf(t, ctx.config);
    if (mode === 'cctp') return cctpInMode(ctx.config, ctx.isMainnet) && !!cctpChainOf(t, ctx.config);
    if (ctx.isMainnet) return !!ctx.config?.bch?.enabled && !ctx.config.bch.paused && (isNativeBch(t) || !!t.swapServer?.assetId);
    return isNativeBch(t) || (!t.swapServer && !t.categoryId && ['ethereum', 'solana'].includes(t.chain ?? ''));
}
