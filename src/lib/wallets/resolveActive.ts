/**
 * Unified active wallet resolution logic.
 * Phase 0: Foundation
 */

import { ChainFamily } from './types';
import { MAIN_WALLET_ID } from '../walletStore';

export interface WalletCandidate {
    id: string;
    connectedAt: number;
}

/**
 * Resolves the active wallet ID for a given chain family and network.
 *
 * Rules:
 * 1. Current is still a candidate (or 'main' when built-in is available) -> keep current
 * 2. Built-in wallet available/unlocked -> 'main'
 * 3. Any candidate external wallet -> most recently connected (highest connectedAt)
 * 4. Otherwise -> null
 */
export function resolveActive(
    _family: ChainFamily,
    current: string | null,
    candidates: WalletCandidate[],
    builtInAvailable: boolean
): string | null {
    // Rule 1a: current is 'main' and builtIn is available
    if (current === MAIN_WALLET_ID && builtInAvailable) {
        return MAIN_WALLET_ID;
    }

    // Rule 1b: current is still an active candidate
    if (current && candidates.some(c => c.id === current)) {
        return current;
    }

    // Rule 2: built-in wallet unlocked/available
    if (builtInAvailable) {
        return MAIN_WALLET_ID;
    }

    // Rule 3: pick most recently connected external candidate
    if (candidates.length > 0) {
        const sorted = [...candidates].sort((a, b) => b.connectedAt - a.connectedAt);
        return sorted[0].id;
    }

    // Rule 4: no wallet
    return null;
}
