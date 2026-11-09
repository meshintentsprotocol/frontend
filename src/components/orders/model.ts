/**
 * One shape for every order the app knows about, so they can sit in one list.
 *
 *   BCH orders         market swaps (Dutch auction), limit orders and the cross-chain swaps (BCHSwapContext)
 *   TWAP orders        the mesh server's records, one per order with its slices (hooks/useTWAP)
 *   swap-server rows   USDC bridges through Circle CCTP and Solana swaps through Jupiter (swap-server)
 *
 * Pure: records go in, rows and steps come out. No React, no fetching. The board
 * (OrdersHub), the row (OrderRow) and the step card (OrderDetailsDialog) all read these.
 */

import type { BCHOrder, BCHOrderStatus, TwapOrderRecord, TwapSliceView } from '@/types';
import type { ActivityItem, ActivityPhase } from '@/swap-server/types';
import type { DialogStep } from '@/swap-server/steps';

export type OrderKind = 'swap' | 'limit' | 'twap' | 'bridge';
export type OrderFilter = 'all' | OrderKind;
export type OrderSort = 'newest' | 'oldest' | 'status' | 'pair';

/**
 * How a status reads at a glance. Also the order of the "needs attention first" sort.
 *   action     the user has something to do (claim, sign, pay a fee)
 *   waiting    it is held up, but not by the user (refund on its way, awaiting funding)
 *   progress   moving by itself
 */
export type OrderTone = 'action' | 'waiting' | 'progress' | 'failed' | 'refunded' | 'done' | 'idle';

export interface OrderSide {
    symbol: string;
    amount: string;
    icon?: string;
    /** Any spelling components/common/TokenChainIcon understands. */
    chain?: string | null;
}

export interface OrderLink { label: string; href: string }

export interface OrderItem {
    /** Unique across sources. */
    key: string;
    id: string;
    source: 'bch' | 'twap' | 'server';
    kind: OrderKind;
    /** Still moving, or waiting on the user. */
    open: boolean;
    /** Milliseconds. */
    createdAt: number;
    sell: OrderSide;
    buy: OrderSide;
    /** The buy amount is a quote or a minimum, not what arrived. */
    buyApprox: boolean;
    status: { label: string; tone: OrderTone; hint?: string };
    /** Where it runs: "Bitcoin Cash · Dutch auction", "Ethereum Sepolia → Arc Testnet". */
    route: string;
    progress?: { done: number; total: number; refunded?: number };
    note?: { text: string; tone: 'amber' | 'red' | 'muted' };
    links: OrderLink[];
    bch?: BCHOrder;
    twap?: TwapOrderRecord;
    server?: ActivityItem;
}

export const KIND_LABEL: Record<OrderKind, string> = { swap: 'Swap', limit: 'Limit', twap: 'TWAP', bridge: 'Bridge' };

/** Tailwind classes of a kind pill. */
export const KIND_CLASS: Record<OrderKind, string> = {
    swap: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
    limit: 'bg-violet-500/10 text-violet-300 border-violet-500/20',
    twap: 'bg-teal-500/10 text-teal-300 border-teal-500/20',
    bridge: 'bg-sky-500/10 text-sky-300 border-sky-500/20',
};

/** Tailwind classes of a status pill. */
export const TONE_CLASS: Record<OrderTone, string> = {
    action: 'bg-blue-500/10 text-blue-300 border-blue-500/25',
    waiting: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
    progress: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    failed: 'bg-red-500/10 text-red-400 border-red-500/20',
    refunded: 'bg-orange-500/10 text-orange-300 border-orange-500/20',
    done: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    idle: 'bg-white/[0.04] text-white/50 border-white/[0.08]',
};

const TONE_RANK: Record<OrderTone, number> = { action: 0, waiting: 1, progress: 2, failed: 3, refunded: 4, done: 5, idle: 6 };

// ── formatting ───────────────────────────────────────────────────────────────

/** A token amount for a row: no trailing zeros, no more digits than are useful. */
export function formatAmount(value: number | string | undefined, maxDigits = 6): string {
    const n = Number(value);
    if (value === undefined || value === '' || !Number.isFinite(n)) return '?';
    if (n === 0) return '0';
    const digits = Math.abs(n) >= 1000 ? 2 : Math.abs(n) >= 1 ? Math.min(maxDigits, 4) : maxDigits;
    return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

export function formatDuration(seconds: number): string {
    if (seconds <= 0) return '0s';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}

// ── explorers ────────────────────────────────────────────────────────────────

export function bchTxUrl(txid: string, isMainnet: boolean): string {
    return isMainnet ? `https://blockchair.com/bitcoin-cash/transaction/${txid}` : `https://chipnet.chaingraph.cash/tx/${txid}`;
}

const CHAIN_NAME: Record<string, string> = { bch: 'Bitcoin Cash', solana: 'Solana', movement: 'Movement', eth: 'Ethereum', xmr: 'Monero' };

/** [source chain, destination chain] of a BCH swap type, as short chain ids. */
export function chainsOfSwapType(swapType: string): [string, string] {
    if (swapType === 'same-chain') return ['bch', 'bch'];
    const id = (s: string) => (s === 'sol' ? 'solana' : s === 'mov' ? 'movement' : s);
    const [a, b] = swapType.split('-to-');
    return [id(a ?? 'bch'), id(b ?? 'bch')];
}

function txUrlOn(chain: string, txid: string, isMainnet: boolean): string | undefined {
    switch (chain) {
        case 'bch': return bchTxUrl(txid, isMainnet);
        case 'solana': return `https://explorer.solana.com/tx/${txid}${isMainnet ? '' : '?cluster=devnet'}`;
        case 'movement': return `https://explorer.movementnetwork.xyz/txn/${txid}?network=${isMainnet ? 'mainnet' : 'testnet'}`;
        case 'eth': return `${isMainnet ? 'https://etherscan.io' : 'https://sepolia.etherscan.io'}/tx/${txid}`;
        default: return undefined;
    }
}

const isUrl = (v?: string): v is string => !!v && /^https?:\/\//.test(v);

/** The transactions of a BCH order worth linking to: where it was locked, and where it ended. */
export function bchOrderLinks(order: BCHOrder, isMainnet: boolean): OrderLink[] {
    const [src, dst] = chainsOfSwapType(order.swapType);
    const links: OrderLink[] = [];
    const source = isUrl(order.explorerUrl) ? order.explorerUrl
        : order.txid ? txUrlOn(src, order.txid, isMainnet)
        : order.contractAddress && src === 'bch' && !isMainnet ? `https://chipnet.chaingraph.cash/address/${order.contractAddress}` : undefined;
    if (source) links.push({ label: 'Source', href: source });

    const refunded = order.status === 'refunded';
    const closed = order.status === 'cancelled' || order.status === 'closed';
    const endTx = refunded ? (order.refundTxid ?? order.fillTxid) : closed ? (order.cancelTxid ?? order.fillTxid) : order.fillTxid;
    // A refund or a cancel returns the funds on the chain they were locked on.
    const endChain = refunded || closed ? src : dst;
    const end = isUrl(order.destExplorerUrl) ? order.destExplorerUrl : endTx ? txUrlOn(endChain, endTx, isMainnet) : undefined;
    if (end && end !== source) links.push({ label: refunded ? 'Refund' : order.status === 'cancelled' ? 'Cancel' : order.status === 'closed' ? 'Close' : 'Fill', href: end });
    return links;
}

// ── BCH orders ───────────────────────────────────────────────────────────────

const BCH_STATUS: Record<BCHOrderStatus, { label: string; tone: OrderTone; hint: string }> = {
    pending: { label: 'Pending', tone: 'progress', hint: 'Waiting for a solver to fill this order.' },
    source_locked: { label: 'Funds locked', tone: 'progress', hint: 'Your funds are locked on the source chain.' },
    proving: { label: 'Generating proof', tone: 'progress', hint: 'A zero-knowledge proof is being generated for this swap.' },
    claimable: { label: 'Claim ready', tone: 'action', hint: 'Ready for you to claim on the destination chain.' },
    claimed: { label: 'Claimed', tone: 'done', hint: 'You have claimed the destination funds.' },
    filled: { label: 'Filled', tone: 'done', hint: 'A solver filled this order.' },
    cancelled: { label: 'Cancelled', tone: 'idle', hint: 'You cancelled this order and your funds were returned.' },
    // Not terminal: past the fill window, refund attempted, still to land.
    expired: { label: 'Refund pending', tone: 'waiting', hint: 'Past its fill window. The refund is being broadcast and will land shortly.' },
    refunded: { label: 'Refunded', tone: 'refunded', hint: 'This order was not filled, so your funds were returned.' },
    // Not terminal either: the covenant is still funded and the solver retries.
    failed: { label: 'Retrying', tone: 'waiting', hint: 'Execution failed; the solver is retrying. Your funds are still locked in the contract.' },
    abandoned: { label: 'Not funded', tone: 'idle', hint: 'This order was created but never funded, so it was dropped. Nothing was locked.' },
    awaiting_funding: { label: 'Funding', tone: 'progress', hint: 'Your funding transaction was sent. The order opens once the server sees it, usually within a minute.' },
    underfunded: { label: 'Underfunded', tone: 'waiting', hint: 'The funding does not cover the order, so it cannot fill. Everything sent is refunded at expiry.' },
    closed: { label: 'Closed', tone: 'idle', hint: 'The order was closed by a transaction outside this app (for example a cancel from another device).' },
    unknown: { label: 'Unknown', tone: 'idle', hint: 'The relayer no longer has a record of this order. Check the explorer link.' },
};

const TERMINAL: ReadonlySet<BCHOrderStatus> = new Set(['filled', 'claimed', 'cancelled', 'refunded', 'abandoned', 'closed', 'unknown']);

/** An open limit order reads "Open"; an open market order "Filling". Other statuses as listed. */
function bchStatusMeta(order: BCHOrder) {
    if (order.status === 'pending' && order.swapType === 'same-chain') {
        return order.orderType === 'limit'
            ? { label: 'Open', tone: 'progress' as OrderTone, hint: 'Live on chain. It fills as soon as a route pays your price, until it expires.' }
            : { label: 'Filling', tone: 'progress' as OrderTone, hint: 'Dutch auction running. The price steps down until a solver fills it.' };
    }
    return BCH_STATUS[order.status] ?? BCH_STATUS.pending;
}

/** Human phrasing for the relayer's skip categories. */
export const SKIP_REASON_LABEL: Record<string, string> = {
    unprofitable_spread: 'Waiting for a better price',
    slippage_too_high: 'Pool too thin right now',
    insufficient_capital: 'Waiting on solver liquidity',
    no_pool: 'No liquidity pool for this token',
    quote_error: 'Could not price this route',
    no_route: 'No route at this price yet',
    other: 'Waiting for a solver',
};

// BCH's median-time-past lags wall-clock time by about 2h, and the covenant's cancel() needs
// tx.time >= expiryTime, so the refund cannot broadcast until MTP reaches the expiry.
const MTP_LAG_SECONDS = 7200;

/** The clock of an open BCH order: time to expiry, time to the refund, or how far the auction has run. */
export function bchOrderTimer(order: BCHOrder, nowSec: number): { text: string; tone: 'amber' | 'red' | 'muted' } | null {
    if (TERMINAL.has(order.status)) return null;
    const createdSec = Math.floor(order.createdAt / 1000);
    if (order.orderType === 'limit' && order.expiryTime) {
        const remaining = order.expiryTime - nowSec;
        if (remaining > 0) return { text: `expires in ${formatDuration(remaining)}`, tone: 'amber' };
        const refundAt = order.refundableFrom && order.refundableFrom >= order.expiryTime ? order.refundableFrom : order.expiryTime + MTP_LAG_SECONDS;
        const refundEta = refundAt - nowSec;
        return refundEta > 0 ? { text: `expired · refund in ~${formatDuration(refundEta)}`, tone: 'red' } : { text: 'expired · refunding…', tone: 'red' };
    }
    if (order.orderType === 'market' && order.duration) {
        const elapsed = Math.max(0, Math.min(nowSec - createdSec, order.duration));
        const pct = Math.round((elapsed / order.duration) * 100);
        return { text: `auction ${formatDuration(elapsed)} / ${formatDuration(order.duration)} (${pct}%)`, tone: order.duration - elapsed <= 60 ? 'amber' : 'muted' };
    }
    return { text: `${formatDuration(Math.max(0, nowSec - createdSec))} elapsed`, tone: 'muted' };
}

/** True when the user can claim this order on the destination chain. */
export function bchOrderClaimable(order: BCHOrder): boolean {
    return order.status === 'claimable'
        || (!!order.claimData?.secret && (order.status === 'pending' || order.status === 'proving'
            || (order.status === 'claimed' && !!order.destExplorerUrl?.includes('relayer-claim-submitted'))));
}

/** True when the maker can cancel this limit order now, without waiting for its expiry. */
export const bchOrderCancellable = (order: BCHOrder): boolean =>
    order.swapType === 'same-chain' && order.orderType === 'limit' && order.status === 'pending'
    && !(order.expiryTime && Date.now() / 1000 > order.expiryTime);

/**
 * True when the locked funds can be asked back. A same-chain order refunds by itself
 * once chain time passes its deadline; the button only nudges the server, so it shows
 * from then on and not before.
 */
export function bchOrderRefundable(order: BCHOrder, nowSec: number): boolean {
    if (order.swapType === 'same-chain') {
        if (order.status !== 'expired' && order.status !== 'underfunded' && order.status !== 'pending') return false;
        const from = order.refundableFrom ?? (order.expiryTime ? order.expiryTime + MTP_LAG_SECONDS : undefined);
        return !!from && nowSec >= from;
    }
    return order.status === 'failed' || order.status === 'expired' || (order.status === 'pending' && !!order.expiryTime && nowSec > order.expiryTime);
}

/** What arrived, when the server reported it; else the order's own buy amount. */
function bchBuyAmount(order: BCHOrder): number | string {
    if (order.status === 'filled' && order.receivedUnits && order.buyToken) {
        return Number(order.receivedUnits) / 10 ** (order.buyToken.decimals || 0);
    }
    return order.buyAmount;
}

export function fromBchOrder(order: BCHOrder, opts: { isMainnet: boolean }): OrderItem {
    const [src, dst] = chainsOfSwapType(order.swapType);
    const meta = bchStatusMeta(order);
    const same = order.swapType === 'same-chain';
    const settled = order.status === 'filled' || order.status === 'claimed';
    const open = !TERMINAL.has(order.status);
    const skip = open && order.lastSkipCategory ? SKIP_REASON_LABEL[order.lastSkipCategory] : undefined;
    return {
        key: `bch:${order.id}`, id: order.id, source: 'bch',
        kind: order.orderType === 'limit' ? 'limit' : 'swap',
        open,
        createdAt: order.createdAt,
        sell: { symbol: order.sellToken?.symbol ?? '?', amount: formatAmount(order.sellAmount), icon: order.sellToken?.icon, chain: order.sellToken?.chain ?? src },
        buy: { symbol: order.buyToken?.symbol ?? '?', amount: formatAmount(bchBuyAmount(order)), icon: order.buyToken?.icon, chain: order.buyToken?.chain ?? dst },
        buyApprox: !settled && order.orderType !== 'limit',
        status: bchOrderClaimable(order) && order.status !== 'claimable' ? { ...BCH_STATUS.claimable } : meta,
        route: same
            ? `Bitcoin Cash · ${order.orderType === 'limit' ? 'limit order' : 'Dutch auction'}`
            : `${CHAIN_NAME[src] ?? src} → ${CHAIN_NAME[dst] ?? dst}`,
        note: skip ? { text: skip, tone: 'amber' } : undefined,
        links: bchOrderLinks(order, opts.isMainnet),
        bch: order,
    };
}

// ── TWAP orders ──────────────────────────────────────────────────────────────

export interface AssetInfo { symbol: string; decimals: number; icon?: string | null }

const TWAP_STATUS: Record<TwapOrderRecord['status'], { label: string; tone: OrderTone; hint: string }> = {
    AWAITING_FUNDING: { label: 'Awaiting funding', tone: 'waiting', hint: 'The slices have not been funded yet. Unfunded slices never start.' },
    RUNNING: { label: 'Running', tone: 'progress', hint: 'Slices open one after another and fill on chain.' },
    COMPLETED: { label: 'Completed', tone: 'done', hint: 'Every slice was filled.' },
    PARTIALLY_FILLED: { label: 'Partly filled', tone: 'refunded', hint: 'Some slices were filled; the rest were refunded after their window.' },
    REFUNDED: { label: 'Refunded', tone: 'refunded', hint: 'No slice was filled, so every slice was refunded.' },
};

/** What a slice paid out: the sum of its fill sources. */
export const sliceReceived = (s: TwapSliceView): bigint =>
    s.fillSources ? BigInt(s.fillSources.mesh) + BigInt(s.fillSources.cauldron) + BigInt(s.fillSources.solver) : 0n;

const fromBase = (v: bigint | string, decimals: number) => Number(v) / 10 ** decimals;

export function fromTwapOrder(order: TwapOrderRecord, asset: (category: string) => AssetInfo): OrderItem {
    const sell = asset(order.tokenIn);
    const buy = asset(order.tokenOut);
    const meta = TWAP_STATUS[order.status] ?? TWAP_STATUS.RUNNING;
    const received = order.slices.reduce((a, s) => a + sliceReceived(s), 0n);
    const minimum = order.slices.reduce((a, s) => a + BigInt(s.minAmountOut || '0'), 0n);
    const open = order.status === 'RUNNING' || order.status === 'AWAITING_FUNDING';
    const created = order.slices.map(s => s.createdAt ?? s.startTime ?? 0).filter(t => t > 0);
    const lastError = open ? order.slices.find(s => s.lastFillError && s.status !== 'filled')?.lastFillError : undefined;
    return {
        key: `twap:${order.orderId}`, id: order.orderId, source: 'twap', kind: 'twap', open,
        createdAt: created.length ? Math.min(...created) * 1000 : 0,
        sell: { symbol: sell.symbol, amount: formatAmount(fromBase(order.totalAmountIn, sell.decimals), Math.min(sell.decimals, 8)), icon: sell.icon ?? undefined, chain: 'bch' },
        // Until something has filled, the least the order can pay out; after that, what arrived.
        buy: { symbol: buy.symbol, amount: formatAmount(fromBase(received > 0n ? received : minimum, buy.decimals), Math.min(buy.decimals, 8)), icon: buy.icon ?? undefined, chain: 'bch' },
        buyApprox: received === 0n || open,
        status: meta,
        route: `Bitcoin Cash · ${order.numSlices} slices`,
        progress: { done: order.slicesFilled, total: order.numSlices, refunded: order.slicesRefunded },
        note: lastError ? { text: lastError, tone: 'amber' } : undefined,
        links: [],
        twap: order,
    };
}

// ── swap-server rows ─────────────────────────────────────────────────────────

const PHASE_TONE: Record<ActivityPhase, OrderTone> = {
    awaiting_signature: 'action', action_needed: 'action', processing: 'progress', completed: 'done', failed: 'failed', expired: 'idle',
};

const PHASE_TEXT: Record<ActivityPhase, string> = {
    awaiting_signature: 'Needs signature', processing: 'In progress', action_needed: 'Fee needed', completed: 'Completed', failed: 'Failed', expired: 'Expired',
};

function activityStatus(i: ActivityItem): string {
    if (i.kind === 'swap' && i.phase === 'awaiting_signature') return 'Not signed';
    if (i.phase !== 'processing' || i.kind !== 'transfer') return PHASE_TEXT[i.phase];
    return i.status === 'BURN_SUBMITTED' ? 'Confirming' : i.status === 'BURN_CONFIRMED' ? 'Attesting' : 'Delivering';
}

export function fromActivity(item: ActivityItem, chainOf: (key: string) => string | null = k => k): OrderItem {
    const transfer = item.kind === 'transfer';
    const links: OrderLink[] = [];
    if (item.links.source) links.push({ label: 'Source', href: item.links.source });
    if (item.links.destination) links.push({ label: transfer ? 'Delivery' : 'Swap', href: item.links.destination });
    const feeNote = item.fee && item.phase !== 'awaiting_signature'
        ? `fee ${item.fee.display ?? ''} ${item.fee.symbol ?? ''}`.trim() + (item.fee.status === 'paid' ? '' : ` (${item.fee.status === 'awaiting' ? 'not received' : item.fee.status})`)
        : undefined;
    return {
        key: `server:${item.id}`, id: item.id, source: 'server',
        kind: transfer ? 'bridge' : 'swap',
        open: !item.terminal,
        createdAt: item.createdAt,
        sell: { symbol: item.sell.symbol ?? '', amount: item.sell.display ?? '?', icon: item.sell.icon, chain: chainOf(item.sell.chain) },
        buy: { symbol: item.buy.symbol ?? '', amount: item.buy.display ?? '?', icon: item.buy.icon, chain: chainOf(item.buy.chain) },
        buyApprox: !!item.buy.estimated && !item.terminal,
        status: { label: activityStatus(item), tone: PHASE_TONE[item.phase] },
        route: transfer ? `${item.sell.chainName} → ${item.buy.chainName} · Circle CCTP` : 'Solana · Jupiter',
        note: item.failReason ? { text: item.failReason, tone: 'red' } : feeNote ? { text: feeNote, tone: 'muted' } : undefined,
        links,
        server: item,
    };
}

// ── the board ────────────────────────────────────────────────────────────────

export function filterOrders(items: OrderItem[], filter: OrderFilter): OrderItem[] {
    return filter === 'all' ? items : items.filter(i => i.kind === filter);
}

export function countByKind(items: OrderItem[]): Record<OrderFilter, number> {
    const counts: Record<OrderFilter, number> = { all: items.length, swap: 0, limit: 0, twap: 0, bridge: 0 };
    for (const i of items) counts[i.kind]++;
    return counts;
}

export function sortOrders(items: OrderItem[], sort: OrderSort): OrderItem[] {
    const newest = (a: OrderItem, b: OrderItem) => b.createdAt - a.createdAt || a.key.localeCompare(b.key);
    const by: Record<OrderSort, (a: OrderItem, b: OrderItem) => number> = {
        newest,
        oldest: (a, b) => a.createdAt - b.createdAt || a.key.localeCompare(b.key),
        status: (a, b) => TONE_RANK[a.status.tone] - TONE_RANK[b.status.tone] || newest(a, b),
        pair: (a, b) => `${a.sell.symbol}/${a.buy.symbol}`.localeCompare(`${b.sell.symbol}/${b.buy.symbol}`) || newest(a, b),
    };
    return [...items].sort(by[sort]);
}

// ── steps, for the order card ────────────────────────────────────────────────

const sourceLink = (links: OrderLink[]) => links.find(l => l.label === 'Source')?.href;
const endLink = (links: OrderLink[]) => links.find(l => l.label !== 'Source')?.href;

/** The steps of a BCH order as the order card draws them. */
export function bchOrderSteps(order: BCHOrder, opts: { isMainnet: boolean; nowSec: number }): DialogStep[] {
    const [src, dst] = chainsOfSwapType(order.swapType);
    const links = bchOrderLinks(order, opts.isMainnet);
    const s = order.status;
    const same = order.swapType === 'same-chain';
    const srcName = CHAIN_NAME[src] ?? src;
    const dstName = CHAIN_NAME[dst] ?? dst;
    const settled = s === 'filled' || s === 'claimed';
    const returned = s === 'refunded' || s === 'cancelled' || s === 'closed';
    const neverFunded = s === 'abandoned';
    const funding = s === 'awaiting_funding';
    const funded = !neverFunded && !funding && (!!order.txid || s !== 'pending' || same);
    const timer = bchOrderTimer(order, opts.nowSec);
    const skip = order.lastSkipCategory ? SKIP_REASON_LABEL[order.lastSkipCategory] : undefined;
    const got = `${formatAmount(bchBuyAmount(order))} ${order.buyToken?.symbol ?? ''}`.trim();

    const steps: DialogStep[] = [
        { key: 'create', label: 'Order created', state: 'done' },
        {
            key: 'fund', label: same ? 'Funds locked in the covenant' : `Funds locked on ${srcName}`, link: sourceLink(links),
            state: neverFunded ? 'failed' : s === 'underfunded' ? 'attention' : funded ? 'done' : 'active',
            note: neverFunded ? 'Never funded, so nothing was locked.'
                : funding ? 'Waiting for the server to see your funding transaction.'
                : s === 'underfunded' ? BCH_STATUS.underfunded.hint : undefined,
        },
    ];

    if (same) {
        const waiting = !settled && !returned && !neverFunded;
        steps.push({
            key: 'fill',
            label: order.orderType === 'limit' ? 'Waiting for your price' : 'Dutch auction',
            state: neverFunded || funding || s === 'underfunded' ? 'pending' : settled ? 'done' : returned ? 'done' : s === 'expired' || s === 'failed' ? 'attention' : 'active',
            note: !waiting ? (returned ? 'Not filled.' : undefined)
                : funding || s === 'underfunded' ? undefined
                : s === 'expired' ? [BCH_STATUS.expired.hint, timer?.text].filter(Boolean).join(' · ')
                : s === 'failed' ? BCH_STATUS.failed.hint
                : [skip, timer?.text].filter(Boolean).join(' · ') || undefined,
        });
    } else {
        const claim = bchOrderClaimable(order);
        steps.push({
            key: 'fill', label: s === 'proving' ? 'Generating the proof' : `Solver fills on ${dstName}`,
            state: neverFunded ? 'pending' : settled || claim || returned ? 'done' : s === 'expired' || s === 'failed' ? 'attention' : 'active',
            note: returned ? 'Not filled.' : s === 'failed' ? BCH_STATUS.failed.hint : s === 'expired' ? BCH_STATUS.expired.hint : undefined,
        });
        if (claim || order.claimData?.secret) {
            steps.push({
                key: 'claim', label: `Claim on ${dstName}`,
                state: settled ? 'done' : claim ? 'attention' : 'pending',
                note: claim && !settled ? 'Ready for you to claim.' : undefined,
            });
        }
    }

    steps.push(returned
        ? { key: 'end', label: s === 'cancelled' ? 'Cancelled, funds returned' : s === 'closed' ? 'Closed outside this app' : 'Refunded', state: 'done', link: endLink(links) }
        : { key: 'end', label: settled ? (s === 'claimed' ? 'Claimed' : 'Filled') : 'Received', state: settled ? 'done' : 'pending', link: settled ? endLink(links) : undefined, note: settled ? `${got} arrived` : undefined });
    return steps;
}

/** One line under the order card's title. */
export function bchOrderHeadline(order: BCHOrder): string {
    return bchStatusMeta(order).hint;
}

const SLICE_STATE: Record<string, DialogStep['state']> = {
    filled: 'done', active: 'active', scheduled: 'pending', awaiting_funding: 'pending',
    refunded: 'attention', refund_pending: 'attention', expired: 'attention', expired_unfunded: 'failed', underfunded: 'failed',
    cancelled: 'failed', closed_external: 'done',
};

const SLICE_TEXT: Record<string, string> = {
    filled: 'Filled', active: 'Open for fills', scheduled: 'Scheduled', awaiting_funding: 'Awaiting funding',
    refunded: 'Refunded', refund_pending: 'Refund on its way', expired: 'Window over, refund pending',
    expired_unfunded: 'Never funded', underfunded: 'Underfunded', cancelled: 'Cancelled', closed_external: 'Closed outside this app',
};

/** One step per slice of a TWAP order. */
export function twapSteps(order: TwapOrderRecord, asset: (category: string) => AssetInfo, time: (unixSec: number) => string): DialogStep[] {
    const sell = asset(order.tokenIn);
    const buy = asset(order.tokenOut);
    const amt = (v: bigint | string, a: AssetInfo) => `${formatAmount(fromBase(v, a.decimals), Math.min(a.decimals, 8))} ${a.symbol}`;
    return order.slices.map((s, i) => {
        const filled = s.status === 'filled';
        const notes = [SLICE_TEXT[s.status] ?? s.status];
        if (s.fillMethod) notes.push(`via ${s.fillMethod}`);
        if (s.status === 'scheduled' && s.startTime) notes.push(`opens ${time(s.startTime)}`);
        if (s.status === 'active' && s.refundEligibleAt) notes.push(`refunds after ${time(s.refundEligibleAt)}`);
        if (s.lastFillError && !filled) notes.push(s.lastFillError);
        return {
            key: s.intentId,
            label: `Slice ${(s.twapSliceIndex ?? i) + 1} · ${amt(s.sellAmount, sell)} → ${filled ? amt(sliceReceived(s), buy) : `min ${amt(s.minAmountOut, buy)}`}`,
            state: SLICE_STATE[s.status] ?? 'pending',
            note: notes.join(' · '),
            link: s.explorerUrl,
        };
    });
}

export function twapHeadline(order: TwapOrderRecord): string {
    return (TWAP_STATUS[order.status] ?? TWAP_STATUS.RUNNING).hint;
}
