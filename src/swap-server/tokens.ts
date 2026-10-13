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
import type { SwapServerConfig } from './types';

export const USDC_ICON = '/logos/usd-coin-usdc-logo.svg';

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
 *
 *   { other }   a bridge-only USDC row was picked and the other side is not USDC on a different CCTP chain
 *   { reset }   the other side holds a bridge-only row and the pick is not bridgeable: the caller puts its own
 *               default there, since such a pair has no flow
 *   {}          nothing to change
 */
export function pairAfterSelect(
    picked: Token, other: Token, ctx: { tokens: Token[]; config?: SwapServerConfig; isMainnet: boolean },
): { other?: Token; reset?: boolean } {
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
    return `${t.chain ?? 'bch'}:${t.categoryId ?? t.address ?? t.symbol}`;
}
