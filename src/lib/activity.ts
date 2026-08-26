export type ActivityType = 'send' | 'receive' | 'swap' | 'bridge';

export interface ActivityRecord {
    id: string;
    type: ActivityType;
    asset?: string;           // E.g. 'MOVE' for sending/receiving
    amount?: number;          // Amount sent/received
    assetIn?: string;         // E.g. 'USDC' for swapping
    assetOut?: string;        // E.g. 'MOVE' for swapping
    amountIn?: number;
    amountOut?: number;
    valueUsd?: number;        // Estimated USD value at time of tx
    txHash: string;
    network?: string;         // e.g. 'Movement', 'Solana', 'Bitcoin Cash'
    timestamp: number;        // Unix timestamp
    explorerUrl?: string;     // Link to view tx
    description?: string;     // Human-readable summary of the activity
    status?: string;          // e.g. 'confirmed', 'pending', 'failed'
    metadata?: Record<string, any>; // Extra contextual key-values
}

const STORAGE_KEY = 'intent_protocol_activity_history';

export const ActivityService = {
    /**
     * Get all historical activity records stored locally.
     */
    getHistory: (): ActivityRecord[] => {
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
     */
    addActivity: (record: Omit<ActivityRecord, 'id' | 'timestamp'>): void => {
        try {
            const history = ActivityService.getHistory();
            const newRecord: ActivityRecord = {
                ...record,
                id: Math.random().toString(36).substr(2, 9),
                timestamp: Date.now()
            };

            // Add to front of array
            history.unshift(newRecord);

            // Keep only the last 50 transactions to prevent localStorage bloat
            if (history.length > 50) {
                history.pop();
            }

            localStorage.setItem(STORAGE_KEY, JSON.stringify(history));

            // Optionally dispatch a custom event so UI can update immediately
            window.dispatchEvent(new Event('activity_history_updated'));

        } catch (err) {
            console.error('Failed to save activity history:', err);
        }
    },

    /**
     * Clear all local activity history.
     */
    clearHistory: (): void => {
        localStorage.removeItem(STORAGE_KEY);
        window.dispatchEvent(new Event('activity_history_updated'));
    }
};
