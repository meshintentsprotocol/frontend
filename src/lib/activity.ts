import { ChainFamily, AppNetwork } from './wallets/types';
import { getWalletContext } from './wallets/ambient';
import { norm } from './wallets/visibility';

export type ActivityType = 'send' | 'receive' | 'swap' | 'bridge';

export interface ActivityRecord {
    id: string;
    type: ActivityType;
    family?: ChainFamily;
    network?: AppNetwork | string;
    wallet?: string;          // Address of the wallet that performed this activity
    asset?: string;           // E.g. 'MOVE' for sending/receiving
    amount?: number;          // Amount sent/received
    assetIn?: string;         // E.g. 'USDC' for swapping
    assetOut?: string;        // E.g. 'MOVE' for swapping
    amountIn?: number;
    amountOut?: number;
    valueUsd?: number;        // Estimated USD value at time of tx
    txHash: string;
    timestamp: number;        // Unix timestamp
    explorerUrl?: string;     // Link to view tx
    description?: string;     // Human-readable summary of the activity
    status?: string;          // e.g. 'confirmed', 'pending', 'failed'
    metadata?: Record<string, any>; // Extra contextual key-values
}

const STORAGE_KEY = 'intent_protocol_activity_history';
const MAX_RECORDS = 200;

function generateId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `act-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export const ActivityService = {
    /**
     * Get all historical activity records stored locally.
     */
    getHistory: (): ActivityRecord[] => {
        if (typeof window === 'undefined' || !window.localStorage) return [];
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            if (!data) return [];
            return JSON.parse(data) as ActivityRecord[];
        } catch (err) {
            console.error('Failed to parse activity history:', err);
            return [];
        }
    },

    /**
     * Add a new activity record to the local history.
     * Fills missing family, network, and wallet from ambient context.
     */
    addActivity: (record: Omit<ActivityRecord, 'id' | 'timestamp'>): void => {
        if (typeof window === 'undefined' || !window.localStorage) return;
        try {
            const ctx = getWalletContext();
            const family: ChainFamily = record.family || 'bch';
            const network = record.network || ctx.network;
            const wallet = record.wallet || ctx.active[family] || ctx.builtIn[family] || undefined;

            const history = ActivityService.getHistory();
            const newRecord: ActivityRecord = {
                ...record,
                family,
                network,
                wallet,
                id: generateId(),
                timestamp: Date.now(),
            };

            // Add to front of array
            history.unshift(newRecord);

            // Keep up to 200 records across all connected wallets
            if (history.length > MAX_RECORDS) {
                history.length = MAX_RECORDS;
            }

            localStorage.setItem(STORAGE_KEY, JSON.stringify(history));

            // Dispatch custom event so UI updates immediately
            window.dispatchEvent(new Event('activity_history_updated'));
        } catch (err) {
            console.error('Failed to save activity history:', err);
        }
    },

    /**
     * Delete all activity records belonging to a forgotten wallet address.
     */
    forgetWallet: (address: string, family: ChainFamily = 'bch'): void => {
        if (typeof window === 'undefined' || !window.localStorage) return;
        try {
            const targetNorm = norm(address, family);
            const history = ActivityService.getHistory();
            const filtered = history.filter(rec => {
                const recWallet = rec.wallet;
                if (!recWallet) return true; // keep legacy untagged records
                return norm(recWallet, rec.family || family) !== targetNorm;
            });

            localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
            window.dispatchEvent(new Event('activity_history_updated'));
        } catch (err) {
            console.error('Failed to forget wallet activity:', err);
        }
    },

    /**
     * Clear all local activity history.
     */
    clearHistory: (): void => {
        if (typeof window === 'undefined' || !window.localStorage) return;
        localStorage.removeItem(STORAGE_KEY);
        window.dispatchEvent(new Event('activity_history_updated'));
    },
};
