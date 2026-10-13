/**
 * Token rows the swap server contributes to the selector.
 *
 * Cross-chain USDC (testnet mode): one USDC row per CCTP chain from /config. Two of them already exist as static
 * rows with the same addresses (Ethereum Sepolia, Solana devnet) and are left as they are, because the BCH flows
 * use them too. The rest replace a "Soon" placeholder or are new (Arc).
 */
import type { Token } from '@/types';
import { cctpInMode, localChain } from './cctpChains';
import { cctpChainOf, isCctpOnly } from './routing';
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
export function resolveTokenIcon(b: BchToken, chain: Token['chain']): string {
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
    const icon = resolveTokenIcon(b, chain);
    return {
        symbol: b.symbol,
        name: b.name,
        icon,
        decimals: b.decimals,
        type: chain === 'solana' ? 'spl-token' : chain === 'bch' ? 'native' : 'erc20',
        chain,
        address: b.contractAddress || b.assetId,
        priceUsd: b.price,
        swapServer: {
            product: 'bch',
            chainKey: b.chain,
            assetId: b.assetId,
        },
    };
}

/**
 * Merge 1Click BCH tokens into the token list.
 * Tags matching existing tokens with swapServer product 'bch', enables them if disabled,
 * and appends new tokens while avoiding duplicate symbol+chain entries.
 */
export function withBchTokens(base: Token[], bchTokens: BchToken[] | undefined): Token[] {
    if (!bchTokens || bchTokens.length === 0) return base;
    const out = [...base];
    for (const b of bchTokens) {
        const row = toTokenRow(b);
        const rChain = normalizeChainName(row.chain);
        const rSym = row.symbol?.toUpperCase();

        const existingIdx = out.findIndex(x => {
            const xChain = normalizeChainName(x.chain);
            return xChain === rChain && x.symbol?.toUpperCase() === rSym;
        });

        if (existingIdx >= 0) {
            const existing = out[existingIdx];
            out[existingIdx] = {
                ...existing,
                disabled: false,
                comingSoon: false,
                icon: existing.icon && existing.icon !== USDC_ICON ? existing.icon : (row.icon || existing.icon),
                swapServer: {
                    ...(existing.swapServer || {}),
                    product: 'bch',
                    chainKey: b.chain,
                    assetId: b.assetId,
                },
            };
        } else {
            out.push(row);
        }
    }
    return out;
}

/** One USDC row per CCTP chain this build can sign for. */
export function cctpTokens(config: SwapServerConfig | undefined): Token[] {
    if (!config) return [];
    return config.cctp.chains.flatMap((c): Token[] => {
        const local = localChain(c.key);
        if (!local) return [];
        return [{
            symbol: 'USDC', name: `USD Coin (${c.name})`, icon: USDC_ICON, decimals: 6,
            type: c.kind === 'evm' ? 'erc20' : 'spl-token',
            chain: local.tokenChain, address: c.usdc,
            swapServer: { product: 'cctp', chainKey: c.key },
        }];
    });
}

/**
 * The selector's list with the CCTP rows in, when the server's network is the mode's. A row that already is
 * this USDC (same chain, same address) is left alone, because other flows use it too. Otherwise the server row
 * replaces a disabled placeholder for the chain, or joins the list: a live static row with another address is a
 * different token (the list still carries testnet USDC in Mainnet mode) and stays next to it.
 */
export function withCctpTokens(base: Token[], config: SwapServerConfig | undefined, isMainnet: boolean): Token[] {
    if (!config || !cctpInMode(config, isMainnet)) return base;
    const out = [...base];
    const same = (a?: string, b?: string) => !!a && !!b && (a === b || a.toLowerCase() === b.toLowerCase());
    for (const t of cctpTokens(config)) {
        if (out.some(x => x.chain === t.chain && !x.disabled && same(x.address, t.address))) continue;
        const i = out.findIndex(x => x.chain === t.chain && x.symbol === t.symbol && x.disabled);
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
    picked: Token, other: Token, ctx: { tokens: Token[]; config?: SwapServerConfig; isMainnet: boolean },
): { other?: Token; reset?: boolean } {
    // If either leg is Bitcoin Cash, it's a BCH swap or cross-chain swap: do not reset!
    const isBchLeg = (picked.chain === 'bch' || picked.symbol === 'BCH') || (other.chain === 'bch' || other.symbol === 'BCH');
    if (isBchLeg) return {};

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
    return `${chain}:${t.categoryId ?? t.address ?? t.symbol}`;
}
