/**
 * The Mesh server's view of an intent, and how it maps onto the order the app shows.
 *
 * The server owns the lifecycle (meshserver src/intents/format.ts, displayStatus):
 *
 *   awaiting_funding → active → filled
 *                             → expired → refund_pending → refunded
 *                             → cancelled          (maker cancelEarly, limit only)
 *                             → closed_external    (spent by a transaction it did not build)
 *   awaiting_funding → expired_unfunded            (never funded; nothing locked)
 *   underfunded      → expired → refunded          (funding short of the order: refunded in full)
 *   scheduled                                      (a TWAP slice whose window has not opened)
 *
 * GET /intent/:id and every `intent:*` WebSocket event carry this same view, so the
 * poll and the socket go through `applyMeshIntent` and cannot disagree.
 */
import type { BCHOrder, BCHOrderStatus } from '@/types';
import { isTerminalOrderStatus } from '@/types';

/** The fields of the server's intent view the app reads. */
export interface MeshIntentView {
    id?: string;
    intentId?: string;
    status?: string;
    type?: 'limit' | 'dutch';
    /** Wall-clock expiry the order was created with (unix seconds). */
    expiryTimestamp?: number;
    /** Chain-time (MTP) deadline after which the covenant can no longer be filled. */
    covenantDeadline?: number;
    /** Wall-clock estimate of when the refund can be broadcast (unix seconds). */
    refundEligibleAt?: number;
    fillTxid?: string;
    refundTxid?: string;
    closedTxid?: string;
    explorerUrl?: string;
    fillExplorerUrl?: string;
    refundExplorerUrl?: string;
    fillMethod?: 'MESH_POOL' | 'CAULDRON' | 'SOLVER_INVENTORY' | 'SPLIT';
    lastFillError?: string;
    unfillableSince?: number;
    fundedAt?: number;
    filledAt?: number;
    fill?: { makerPaid?: string; method?: string };
    /** Only on `intent:unfillable` events. */
    reason?: string;
}

/** Server display status → app status. Null for a status this mapping does not know. */
export function meshStatus(status: string | undefined): BCHOrderStatus | null {
    switch ((status ?? '').toLowerCase()) {
        case 'awaiting_funding': return 'awaiting_funding';
        case 'active':
        case 'scheduled':
        case 'pending': return 'pending';
        case 'underfunded': return 'underfunded';
        // Past the deadline and not filled: the refund is due or on its way. Neither is final.
        case 'expired':
        case 'refund_pending': return 'expired';
        case 'expired_unfunded':
        case 'abandoned': return 'abandoned';
        case 'filled': return 'filled';
        case 'refunded': return 'refunded';
        case 'cancelled': return 'cancelled';
        case 'closed_external': return 'closed';
        case 'failed': return 'failed';
        default: return null;
    }
}

/** Fill method → the route label the app already uses in toasts and rows. */
const ROUTE_OF: Record<string, string> = {
    MESH_POOL: 'MESH_POOL',
    CAULDRON: 'CAULDRON_AMM',
    SOLVER_INVENTORY: 'SOLVER_ROUTE',
    SPLIT: 'WATERFALL_BLENDED',
};

/**
 * Copy the server's view onto `order`. Returns true when anything the user sees changed.
 *
 * A settled order is never moved back to an open state: right after a maker's
 * cancelEarly the server may still report the order active until its next scan.
 */
export function applyMeshIntent(order: BCHOrder, intent: MeshIntentView, txUrl: (txid: string) => string): boolean {
    const before = JSON.stringify([order.status, order.fillTxid, order.refundTxid, order.cancelTxid, order.lastSkipCategory,
        order.lastSkipReason, order.refundableFrom, order.expiryTime, order.receivedUnits]);

    const next = meshStatus(intent.status);
    if (next && !(isTerminalOrderStatus(order.status) && !isTerminalOrderStatus(next))) order.status = next;

    if (intent.expiryTimestamp) order.expiryTime = intent.expiryTimestamp;
    if (intent.refundEligibleAt) {
        order.refundableFrom = intent.refundEligibleAt;
        order.fillableUntil = intent.refundEligibleAt;
    }
    if (intent.fillMethod) order.routeType = ROUTE_OF[intent.fillMethod] ?? intent.fillMethod;

    if (intent.fillTxid && order.status === 'filled') {
        order.fillTxid = intent.fillTxid;
        order.destExplorerUrl = intent.fillExplorerUrl ?? txUrl(intent.fillTxid);
        if (intent.fill?.makerPaid) order.receivedUnits = intent.fill.makerPaid;
    }
    if (intent.refundTxid && order.status === 'refunded') {
        order.refundTxid = intent.refundTxid;
        order.destExplorerUrl = intent.refundExplorerUrl ?? txUrl(intent.refundTxid);
    }
    if (intent.closedTxid && (order.status === 'cancelled' || order.status === 'closed')) {
        order.cancelTxid = intent.closedTxid;
        order.destExplorerUrl = txUrl(intent.closedTxid);
    }

    // Why an open order has not filled yet.
    if (isTerminalOrderStatus(order.status)) {
        order.lastSkipCategory = undefined;
        order.lastSkipReason = undefined;
    } else if (intent.unfillableSince || intent.reason) {
        order.lastSkipCategory = order.orderType === 'limit' ? 'unprofitable_spread' : 'no_route';
        order.lastSkipReason = intent.reason ?? intent.lastFillError;
    } else if (intent.lastFillError) {
        order.lastSkipCategory = 'other';
        order.lastSkipReason = intent.lastFillError;
    } else if (intent.status) {
        order.lastSkipCategory = undefined;
        order.lastSkipReason = undefined;
    }

    const after = JSON.stringify([order.status, order.fillTxid, order.refundTxid, order.cancelTxid, order.lastSkipCategory,
        order.lastSkipReason, order.refundableFrom, order.expiryTime, order.receivedUnits]);
    return before !== after;
}
