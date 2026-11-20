/**
 * Unified Balance Refresh Trigger
 *
 * Broadcasts balance invalidations across all supported chains & wallet types:
 * - Native BCH & CashTokens: ['bch-balance'], ['bch-tokens']
 * - External wallets (WizardConnect HD, WalletConnect, extensions): ['ext-bch-balance'], ['wiz-hd-balance']
 * - Cross-chain: ['evm-balances'], ['sol-balances'], ['btc-balances']
 * - Aggregated portfolio: ['portfolio']
 *
 * Fires immediately, followed by a second pass after delayMs (default: 2200ms) to catch
 * mempool / Electrum indexing propagation.
 */

import { queryClient } from './queryClient';

export const BALANCE_QUERY_KEYS = [
    ['bch-balance'],
    ['bch-tokens'],
    ['ext-bch-balance'],
    ['wiz-hd-balance'],
    ['evm-balances'],
    ['sol-balances'],
    ['btc-balances'],
    ['portfolio'],
] as const;

export function triggerBalanceRefresh(opts?: { delayMs?: number }) {
    const run = () => {
        for (const key of BALANCE_QUERY_KEYS) {
            void queryClient.invalidateQueries({ queryKey: key });
        }
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('app:refresh-balances'));
        }
    };

    // Immediate invalidation across all components and queries
    run();

    // Delayed follow-up invalidation for unconfirmed UTXO / mempool propagation
    const delay = opts?.delayMs ?? 2200;
    setTimeout(run, delay);
}
