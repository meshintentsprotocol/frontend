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
    | { kind: 'unsupported'; reason: string };

export interface RouteContext {
    isMainnet: boolean;
    /** Undefined while the swap server has not answered. */
    config?: SwapServerConfig;
}

export const NATIVE_SOL_MINT = 'So11111111111111111111111111111111111111112';

type Family = 'bch' | 'solana' | 'evm' | 'arc' | 'movement' | 'xmr';

/** A CashToken from Cauldron can come without a chain; the card has always treated that as BCH. */
function family(t: Token): Family {
    switch (t.chain) {
        case undefined: case 'bch': return 'bch';
        case 'solana': return 'solana';
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
        ? config.cctp.chains.find(c => c.key === token.swapServer!.chainKey)
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

export function resolveRoute(sell: Token, buy: Token, ctx: RouteContext): SwapRoute | null {
    const fromServer = !!sell.swapServer || !!buy.swapServer;
    const fs = family(sell), fb = family(buy);
    if (!fromServer && EXISTING_FLOWS.has(`${fs}>${fb}`)) return null;

    // Nothing in BCHSwapContext can execute this pair: it is one of ours, or it is not available.
    const bothUsdc = sell.symbol === 'USDC' && buy.symbol === 'USDC';
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
    const only = src ?? dst;
    if (only && (isCctpOnly(sell) || isCctpOnly(buy))) return unsupported(`USDC on ${only.name} can only be sent to USDC on another chain.`);
    if (!ctx.isMainnet) {
        if (!ctx.config && bothUsdc) return unsupported('The USDC bridge cannot be reached right now.');
        if (fs === 'solana' && fb === 'solana') return unsupported('Solana swaps are available in Mainnet mode.');
    } else if (!cctp && (isCctpOnly(sell) || isCctpOnly(buy) || (bothUsdc && fs !== fb))) {
        return unsupported('Cross-chain USDC is available in Testnet mode.');
    }
    return unsupported(PAIR_NOT_AVAILABLE);
}
