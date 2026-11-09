/**
 * orderStatus — the single source of truth for how an order status is presented.
 *
 * There were four independent status→badge maps (LimitOrderHistory, WalletOrdersTab,
 * BCHOrderTracker, PortfolioActivity), each hand-maintained. None knew about
 * `abandoned`, and every one of them described `expired` as a final state, which it
 * is not. Adding a status meant remembering four files; nobody did.
 *
 * `STATUS_META` is typed `Record<BCHOrderStatus, …>`, so a new status becomes a
 * compile error here rather than a wrong badge in four places — which is exactly how
 * the missing `abandoned` entry was caught.
 *
 * Kept out of the component file so `react-refresh` stays happy: a module exporting
 * both components and helpers breaks fast refresh.
 */
import {
    CheckCircle2, XCircle, Clock, Loader2, RotateCcw, AlertTriangle,
    Sparkles, HelpCircle, Hourglass, Ban,
} from 'lucide-react';
import type { BCHOrderStatus } from '@/types';
import { isTerminalOrderStatus } from '@/types';
import { cn } from '@/lib/utils';

export interface StatusMeta {
    label: string;
    /** One-line explanation shown on hover — several of these states are unobvious. */
    hint: string;
    /** Tailwind classes for the badge surface. */
    cls: string;
    icon: React.ReactNode;
    /** True while the order can still change on its own. */
    inFlight: boolean;
}

const ICON = 'h-3 w-3 lg:h-3.5 lg:w-3.5';

export const STATUS_META: Record<BCHOrderStatus, StatusMeta> = {
    pending: {
        label: 'Pending', inFlight: true,
        hint: 'Waiting for a solver to fill this order.',
        cls: 'border-yellow-500/50 text-yellow-400',
        icon: <Loader2 className={cn(ICON, 'animate-spin')} />,
    },
    source_locked: {
        label: 'Funds Locked', inFlight: true,
        hint: 'Your funds are locked on the source chain.',
        cls: 'border-blue-500/50 text-blue-400',
        icon: <Clock className={ICON} />,
    },
    proving: {
        label: 'Generating Proof', inFlight: true,
        hint: 'A zero-knowledge proof is being generated for this swap.',
        cls: 'border-violet-500/50 text-violet-400',
        icon: <Sparkles className={ICON} />,
    },
    claimable: {
        label: 'Claim Ready', inFlight: true,
        hint: 'Ready for you to claim on the destination chain.',
        cls: 'border-blue-500/50 text-blue-400',
        icon: <Sparkles className={ICON} />,
    },
    claimed: {
        label: 'Claimed', inFlight: false,
        hint: 'You have claimed the destination funds.',
        cls: 'border-teal-500/50 text-teal-400',
        icon: <CheckCircle2 className={ICON} />,
    },
    filled: {
        label: 'Filled', inFlight: false,
        hint: 'A solver filled this order.',
        cls: 'border-emerald-500/50 text-emerald-400',
        icon: <CheckCircle2 className={ICON} />,
    },
    cancelled: {
        label: 'Cancelled', inFlight: false,
        hint: 'You cancelled this order and your funds were returned.',
        cls: 'border-red-500/50 text-red-400',
        icon: <XCircle className={ICON} />,
    },
    // NOT terminal. The relayer uses this for "past the fill window, refund attempted
    // but not yet broadcast, retrying" — the order still becomes 'refunded'. Calling it
    // a flat "Expired" told users their money was gone while it was on its way back.
    expired: {
        label: 'Refund Pending', inFlight: true,
        hint: 'Past its fill window. The refund is being broadcast and will land shortly.',
        cls: 'border-amber-500/50 text-amber-400',
        icon: <Hourglass className={ICON} />,
    },
    refunded: {
        label: 'Refunded', inFlight: false,
        hint: 'This order was not filled, so your funds were returned.',
        cls: 'border-orange-500/50 text-orange-400',
        icon: <RotateCcw className={ICON} />,
    },
    // Also not terminal: the covenant is still funded and the relayer is retrying on
    // an exponential backoff.
    failed: {
        label: 'Retrying', inFlight: true,
        hint: 'Execution failed; the solver is retrying. Your funds are still locked in the contract.',
        cls: 'border-red-500/50 text-red-400',
        icon: <AlertTriangle className={ICON} />,
    },
    awaiting_funding: {
        label: 'Funding', inFlight: true,
        hint: 'Your funding transaction was sent. The order opens once the server sees it, usually within a minute.',
        cls: 'border-blue-500/50 text-blue-400',
        icon: <Loader2 className={cn(ICON, 'animate-spin')} />,
    },
    underfunded: {
        label: 'Underfunded', inFlight: true,
        hint: 'The funding does not cover the order, so it cannot fill. Everything sent is refunded at expiry.',
        cls: 'border-amber-500/50 text-amber-400',
        icon: <AlertTriangle className={ICON} />,
    },
    closed: {
        label: 'Closed', inFlight: false,
        hint: 'The order was closed by a transaction outside this app (for example a cancel from another device).',
        cls: 'border-zinc-500/50 text-zinc-400',
        icon: <Ban className={ICON} />,
    },
    abandoned: {
        label: 'Not Funded', inFlight: false,
        hint: 'This order was created but never funded, so it was dropped. Nothing was locked.',
        cls: 'border-zinc-500/50 text-zinc-400',
        icon: <Ban className={ICON} />,
    },
    unknown: {
        label: 'Unknown', inFlight: false,
        hint: 'The relayer no longer has a record of this order. Check the explorer link.',
        cls: 'border-zinc-500/50 text-zinc-500',
        icon: <HelpCircle className={ICON} />,
    },
};

export function statusMeta(status?: BCHOrderStatus): StatusMeta {
    return (status && STATUS_META[status]) || STATUS_META.pending;
}

/** True when the order can still change without user action. */
export function isOrderInFlight(status?: BCHOrderStatus): boolean {
    return !!status && !isTerminalOrderStatus(status);
}
