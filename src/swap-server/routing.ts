/**
 * Which flow a token pair belongs to. The swap card asks here first.
 *
 *   null           an existing flow in BCHSwapContext owns the pair; the card behaves exactly as before
 *   usdc-cctp      USDC on one CCTP chain to USDC on another, through the swap server (testnet mode)
 *   sol-jupiter    two Solana tokens, through the swap server and Jupiter (mainnet mode)
 *   unsupported    no flow can do it; the card disables the button and shows `reason`
 *
 * `unsupported` matters as much as the routes. `detectSwapType` in BCHSwapContext answers 'same-chain' (the BCH
 * CashToken path) for every pair it does not recognise, so without this a USDC → USDC pick would be sent to the
 * wrong executor.
 */
import type { Token } from '@/types';
import { cctpInMode, chainForTokenChain } from './cctpChains';
import type { CctpChain, SwapServerConfig } from './types';

export type SwapRoute =
    | { kind: 'usdc-cctp'; src: CctpChain; dst: CctpChain }
    | { kind: 'sol-jupiter'; inputMint: string; outputMint: string }
    | { kind: 'bch-crosschain'; fromAsset: string; toAsset: string; fromChain: string; toChain: string }
    | { kind: 'unsupported'; reason: string };

export interface RouteContext {
    isMainnet: boolean;
    /** Undefined while the swap server has not answered. */
    config?: SwapServerConfig;
}

export const NATIVE_SOL_MINT = 'So11111111111111111111111111111111111111112';

type Family = 'bch' | 'solana' | 'evm' | 'near' | 'arc' | 'movement' | 'xmr';

/** A CashToken from Cauldron can come without a chain; the card has always treated that as BCH. */
function family(t: Token): Family {
    switch (t.chain) {
        case undefined: case 'bch': return 'bch';
        case 'solana': return 'solana';
        case 'near': return 'near';
        case 'movement': return 'movement';
        case 'xmr': return 'xmr';
        case 'arc': return 'arc';
        default: return 'evm';
    }
}

/** The pairs `detectSwapType` has a real executor for. Everything else falls through to 'same-chain' there. */
const EXISTING_FLOWS = new Set([
    'bch>bch', 'bch>solana', 'solana>bch', 'bch>movement', 'movement>bch', 'solana>movement', 'movement>solana',
    'bch>xmr', 'xmr>bch', 'evm>bch', 'bch>evm',
]);

const sameAddress = (a: string, b: string, evm: boolean) => (evm ? a.toLowerCase() === b.toLowerCase() : a === b);

/** The CCTP chain this token is USDC on, or undefined: matched by chain and by the USDC address the server gives. */
export function cctpChainOf(token: Token, config?: SwapServerConfig): CctpChain | undefined {
    if (!config || !token.address) return undefined;
    const chain = token.swapServer?.chainKey
        ? (config.cctp.chains.find(c => c.key === token.swapServer!.chainKey) ?? chainForTokenChain(token.chain, config.cctp.chains))
        : chainForTokenChain(token.chain, config.cctp.chains);
    return chain && sameAddress(chain.usdc, token.address, chain.kind === 'evm') ? chain : undefined;
}

/** True for a row the swap server supplied for bridging: it has no other flow. */
export const isCctpOnly = (token: Token) => token.swapServer?.product === 'cctp';

/** The mint Jupiter trades this token by, or undefined when it is not a Solana mainnet token. */
export function jupiterMintOf(token: Token, config?: SwapServerConfig): string | undefined {
    if (token.chain !== 'solana') return undefined;
    // A cross-chain USDC row on Solana mainnet is the same mint Jupiter trades.
    if (token.swapServer?.product === 'jupiter' || (token.swapServer?.product === 'cctp' && config?.cctp.network === 'mainnet')) return token.address;
    // The static SOL row is the same asset on every Solana network.
    if (token.symbol === 'SOL' && (!token.address || token.address === NATIVE_SOL_MINT)) return config?.solana.nativeMint ?? NATIVE_SOL_MINT;
    return undefined;
}

/** The reason given when there is nothing more useful to say than that. */
export const PAIR_NOT_AVAILABLE = 'This pair is not available.';

const unsupported = (reason: string): SwapRoute => ({ kind: 'unsupported', reason });

/** Native BCH only: a CashToken category must never be converted into BCH. */
export function isNativeBch(t: Token): boolean {
    return family(t) === 'bch' && !t.categoryId && t.symbol === 'BCH' && t.type === 'native';
}

/** Stable 1Click asset identifier for Bitcoin Cash cross-chain swaps. */
export function bchAssetIdOf(t: Token): string {
    if (t.swapServer?.assetId) return t.swapServer.assetId;
    if (isNativeBch(t)) return 'bch';
    if (t.address && t.address.startsWith('0x')) return t.address;
    const c = bchChainOf(t);
    return `${c}:${t.symbol}`;
}

export function bchChainOf(t: Token): string {
    if (isNativeBch(t)) return 'bch';
    if (t.chain === 'ethereum') return 'eth';
    if (t.chain === 'arbitrum') return 'arb';
    if (t.chain === 'optimism') return 'op';
    if (t.chain === 'solana') return 'sol';
    if (t.chain === 'polygon') return 'pol';
    if (t.chain === 'avalanche') return 'avax';
    return t.chain || 'bch';
}

export function resolveRoute(sell: Token, buy: Token, ctx: RouteContext): SwapRoute | null {
    const fromServer = !!sell.swapServer || !!buy.swapServer;
    const fs = family(sell), fb = family(buy);

    if (fs === 'near' || fb === 'near') return unsupported(PAIR_NOT_AVAILABLE);
    if (sell.disabled || buy.disabled) return unsupported(PAIR_NOT_AVAILABLE);
    if ([sell, buy].some(t => t.network && t.network !== (ctx.isMainnet ? 'mainnet' : 'testnet'))) return unsupported('Pick tokens on the current network.');
    if (sell.chain === buy.chain && (sell.categoryId ?? sell.address ?? sell.type) === (buy.categoryId ?? buy.address ?? buy.type)) return unsupported('Pick two different tokens.');
    // A catalog capability on native BCH must never take over CashToken swaps.
    if (fs === 'bch' && fb === 'bch') return null;
    if ((fs === 'bch' && !isNativeBch(sell)) || (fb === 'bch' && !isNativeBch(buy))) return unsupported(PAIR_NOT_AVAILABLE);

    // Two Solana tokens in Mainnet mode are a swap, also when one of them is the USDC that can be bridged.
    if (ctx.isMainnet && fs === 'solana' && fb === 'solana') {
        const a = jupiterMintOf(sell, ctx.config), b = jupiterMintOf(buy, ctx.config);
        if (a && b) return a === b ? unsupported('Pick two different tokens.') : { kind: 'sol-jupiter', inputMint: a, outputMint: b };
    }
    // Cross-chain USDC, when the server this mode talks to is on the mode's network.
    const cctp = cctpInMode(ctx.config, ctx.isMainnet);
    const src = cctp ? cctpChainOf(sell, ctx.config) : undefined, dst = cctp ? cctpChainOf(buy, ctx.config) : undefined;
    if (src && dst) {
        if (src.key === dst.key) return unsupported('Pick USDC on two different chains.');
        if (ctx.config!.cctp.closedRoutes.includes(`${src.key}>${dst.key}`)) return unsupported(`${src.name} → ${dst.name} is temporarily closed.`);
        return { kind: 'usdc-cctp', src, dst };
    }
    // 1Click is a mainnet product; require the external asset's verified catalog ID.
    const external = isNativeBch(sell) ? buy : isNativeBch(buy) ? sell : undefined;
    if (external?.swapServer?.assetId && ctx.isMainnet) {
        if (!ctx.config?.bch?.enabled) return unsupported('Bitcoin Cash cross-chain swaps are unavailable.');
        if (ctx.config.bch.paused) return unsupported(ctx.config.bch.pauseReason || 'Bitcoin Cash cross-chain swaps are temporarily paused.');
        return { kind: 'bch-crosschain', fromAsset: bchAssetIdOf(sell), toAsset: bchAssetIdOf(buy), fromChain: bchChainOf(sell), toChain: bchChainOf(buy) };
    }
    const only = src ?? dst;
    if (only && (isCctpOnly(sell) || isCctpOnly(buy))) return unsupported(`USDC on ${only.name} can only be sent to USDC on another chain.`);
    if (!ctx.isMainnet && !fromServer && EXISTING_FLOWS.has(`${fs}>${fb}`) && !sell.disabled && !buy.disabled) return null;
    const bothUsdc = sell.symbol?.toUpperCase() === 'USDC' && buy.symbol?.toUpperCase() === 'USDC';
    if (!ctx.isMainnet) {
        if (!ctx.config && bothUsdc) return unsupported('The USDC bridge cannot be reached right now.');
        if (fs === 'solana' && fb === 'solana') return unsupported('Solana swaps are available in Mainnet mode.');
    } else if (!cctp && (isCctpOnly(sell) || isCctpOnly(buy) || (bothUsdc && fs !== fb))) {
        return unsupported('Cross-chain USDC is available in Testnet mode.');
    }
    return unsupported(PAIR_NOT_AVAILABLE);
}
