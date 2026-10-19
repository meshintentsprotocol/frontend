/**
 * Solana swaps through the swap server and Jupiter (mainnet), without React: token rows and the swap flow.
 *
 * A token is identified by its mint, never by its symbol: copies of popular tokens share symbols. Amounts go to
 * the server as integer base units of the input token.
 */
import { ethers } from 'ethers';
import type { Keypair } from '@solana/web3.js';
import type { Token } from '@/types';
import { SwapServerError, type SwapServerApi } from './api';
import { signSolanaTx, toBase64 } from './signers';
import type { SolanaSwap, SolanaToken } from './types';

import type { SolanaTxSigner } from '@/lib/wallets/solanaSigner';

export function jupiterToken(t: SolanaToken): Token {
    return {
        symbol: t.symbol, name: t.name, icon: t.icon ?? '', decimals: t.decimals, type: 'spl-token', chain: 'solana', address: t.mint,
        priceUsd: t.usdPrice,
        swapServer: { product: 'jupiter', verified: t.verified, suspicious: t.suspicious, isStock: t.isStock },
    };
}

/** The selector's list with Jupiter's tokens in (mainnet mode). A static row with the same mint stays the row. */
export function withJupiterTokens(base: Token[], list: SolanaToken[] | undefined, isMainnet: boolean): Token[] {
    if (!isMainnet || !list?.length) return base;
    const have = new Set(base.filter(t => t.chain === 'solana' && t.address).map(t => t.address));
    return [...base, ...list.filter(t => !have.has(t.mint)).map(jupiterToken)];
}

/** "1.5" of a 6-decimal token → "1500000". Undefined when it is not an amount this token can express. */
export function toBaseUnits(amount: string, decimals: number): string | undefined {
    try {
        const v = ethers.parseUnits(amount, decimals);
        return v > 0n ? v.toString() : undefined;
    } catch { return undefined; }
}

export type SwapStage = 'create' | 'sign' | 'landing';

export interface SwapDeps {
    api: Pick<SwapServerApi, 'createSolSwap' | 'executeSolSwap' | 'getSolSwap'>;
    keypair?: Keypair;
    signer?: SolanaTxSigner;
    onStage?: (stage: SwapStage, swap?: SolanaSwap) => void;
    pollMs?: number;
    /** Give up polling an unknown result after this long; the history row keeps following it. */
    pollTimeoutMs?: number;
}

/**
 * Create the swap, sign Jupiter's transaction and hand it back for execution. The wallet signs and never sends.
 * RESULT_UNKNOWN means the swap may still land: it is polled, and a second swap is never created.
 */
export async function runSolanaSwap(
    input: { inputMint: string; outputMint: string; amount: string; taker: string; slippageBps?: number }, deps: SwapDeps,
): Promise<SolanaSwap> {
    deps.onStage?.('create');
    const { swap, tx } = await deps.api.createSolSwap(input);
    deps.onStage?.('sign', swap);
    const signedTx = deps.signer
        ? await deps.signer.sign(tx.serializedTx)
        : signSolanaTx(tx.serializedTx, deps.keypair!);
    const signed = toBase64(signedTx.raw);
    deps.onStage?.('landing', swap);
    try {
        return await deps.api.executeSolSwap(swap.id, signed);
    } catch (e) {
        if (!(e instanceof SwapServerError) || (e.code !== 'RESULT_UNKNOWN' && e.code !== 'IN_PROGRESS')) throw e;
        const deadline = Date.now() + (deps.pollTimeoutMs ?? 180_000);
        for (;;) {
            await new Promise(r => setTimeout(r, deps.pollMs ?? 3000));
            const s = await deps.api.getSolSwap(swap.id).catch(() => undefined);
            if (s?.terminal) return s;
            if (Date.now() > deadline) return s ?? swap;
        }
    }
}
