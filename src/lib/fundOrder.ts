/**
 * A prepared order opened from a funding link: /fund?intent=<id> or /fund?twap=<id>.
 *
 * An order made outside this app (by an AI agent through the MCP server, or by
 * any other client of the Mesh API) is only a covenant address until its maker
 * funds it. This module turns the server's answer into one shape for the page
 * and checks that what the wallet is about to sign is that order and nothing else.
 *
 * Pure module: no React, no network.
 */
import { decodeCashAddress } from '@bitauth/libauth';
import type { FundingOutput } from '@/lib/fundCovenants';

export type FundNetwork = 'mainnet' | 'chipnet';

/** One covenant of the order: the order itself, or one TWAP slice. */
export interface FundPart {
    id: string;
    status: string;
    covenant: string;
    sellAmount: string;
    minReceive: string;
    /** TWAP slices: when the slice opens (chain time, unix seconds). */
    startTime?: number;
    fillTxid?: string;
    refundTxid?: string;
}

export interface FundTarget {
    kind: 'order' | 'twap';
    id: string;
    /** An intent status, or a TWAP status in lower case. */
    status: string;
    orderType: 'limit' | 'dutch' | 'twap';
    makerAddress: string;
    makerPkh: string;
    /** 'BCH' or a 64-hex CashToken category. */
    sellToken: string;
    buyToken: string;
    /** Totals over every part, in base units. */
    sellAmount: string;
    minReceive: string;
    /** Dutch orders: the amount asked when the auction opens. */
    startReceive?: string;
    parts: FundPart[];
    /** What the maker's wallet must send; empty once nothing waits for funds. */
    funding: FundingOutput[];
    /** Wall-clock expiry of the last part, unix seconds. */
    expiresAt?: number;
    refundEligibleAt?: number;
}

const token = (t: unknown): string => {
    const v = String(t ?? '').toLowerCase();
    return v === '0x' || v === 'bch' || v === '' ? 'BCH' : v;
};
const sum = (xs: Array<string | undefined>): string => xs.reduce((a, x) => a + BigInt(x ?? '0'), 0n).toString();
const max = (xs: Array<number | undefined>): number | undefined => {
    const v = xs.filter((x): x is number => typeof x === 'number' && x > 0);
    return v.length ? Math.max(...v) : undefined;
};

function part(o: any): FundPart {
    return {
        id: String(o.intentId ?? o.id),
        status: String(o.status),
        covenant: String(o.contractAddress ?? ''),
        sellAmount: String(o.sellAmount ?? '0'),
        minReceive: String(o.minAmountOut ?? o.buyAmount ?? '0'),
        startTime: typeof o.startTime === 'number' ? o.startTime : undefined,
        fillTxid: o.fillTxid || undefined,
        refundTxid: o.refundTxid || undefined,
    };
}

/** GET /api/v1/intent/:id */
export function targetFromIntent(o: any): FundTarget {
    const p = part(o);
    return {
        kind: 'order',
        id: p.id,
        status: p.status,
        orderType: o.type === 'limit' ? 'limit' : 'dutch',
        makerAddress: String(o.makerAddress ?? ''),
        makerPkh: String(o.makerPkh ?? '').toLowerCase(),
        sellToken: token(o.sellToken),
        buyToken: token(o.buyToken),
        sellAmount: p.sellAmount,
        minReceive: p.minReceive,
        startReceive: o.startBuyAmount ? String(o.startBuyAmount) : undefined,
        parts: [p],
        funding: o.funding ? [o.funding as FundingOutput] : [],
        expiresAt: typeof o.expiryTimestamp === 'number' ? o.expiryTimestamp : undefined,
        refundEligibleAt: typeof o.refundEligibleAt === 'number' ? o.refundEligibleAt : undefined,
    };
}

/** GET /api/v1/twap/:orderId */
export function targetFromTwap(t: any): FundTarget {
    const slices: any[] = Array.isArray(t.slices) ? t.slices : [];
    const parts = slices.map(part);
    return {
        kind: 'twap',
        id: String(t.orderId),
        status: String(t.status ?? '').toLowerCase(),
        orderType: 'twap',
        makerAddress: String(t.creatorAddress ?? ''),
        makerPkh: String(t.creatorPkh ?? '').toLowerCase(),
        sellToken: token(t.tokenIn),
        buyToken: token(t.tokenOut),
        sellAmount: String(t.totalAmountIn ?? sum(parts.map(p => p.sellAmount))),
        minReceive: sum(parts.map(p => p.minReceive)),
        parts,
        funding: Array.isArray(t.funding) ? (t.funding as FundingOutput[]) : [],
        expiresAt: max(slices.map(s => s.expiryTimestamp)),
        refundEligibleAt: max(slices.map(s => s.refundEligibleAt)),
    };
}

/** The parts that still wait for their funds. */
export const awaitingParts = (t: FundTarget): FundPart[] => t.parts.filter(p => p.status === 'awaiting_funding');

/** The network an address belongs to, from its prefix. */
export function networkOfAddress(address: string): FundNetwork | null {
    const prefix = address.split(':')[0];
    return prefix === 'bitcoincash' ? 'mainnet' : prefix === 'bchtest' ? 'chipnet' : null;
}

/** The script hash a covenant cashaddr commits to (the same for its plain and token-aware forms). */
function scriptHash(address: string): string | null {
    const d = decodeCashAddress(address);
    if (typeof d === 'string') return null;
    if (d.type !== 'p2sh' && d.type !== 'p2shWithTokens') return null;
    return Array.from(d.payload, b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Checks the funding list against the order it claims to fund. Returns what is
 * wrong, or null when every output pays one waiting covenant exactly its sold amount.
 *
 * The list and the order come from the same server, so this does not defend
 * against that server; it catches a mismatched or half-applied answer before a
 * wallet signs it.
 */
export function fundingProblem(t: FundTarget): string | null {
    const waiting = awaitingParts(t);
    if (!waiting.length) return 'This order is not waiting for funds.';
    if (t.funding.length !== waiting.length) {
        return `The server listed ${t.funding.length} funding output(s) for ${waiting.length} covenant(s).`;
    }
    const left = new Map<string, FundPart>();
    for (const p of waiting) {
        const h = scriptHash(p.covenant);
        if (!h) return `The covenant address ${p.covenant} is not a script address.`;
        left.set(h, p);
    }
    for (const out of t.funding) {
        const h = scriptHash(out.to);
        const p = h ? left.get(h) : undefined;
        if (!h || !p) return `A funding output pays ${out.to}, which is not one of this order's covenants.`;
        left.delete(h);
        if (!/^[1-9]\d*$/.test(out.satoshis)) return 'A funding output has no satoshi amount.';
        if (t.sellToken === 'BCH') {
            if (out.token) return 'This order sells BCH but a funding output carries a token.';
            if (out.satoshis !== p.sellAmount) return `A funding output pays ${out.satoshis} sats; the order sells ${p.sellAmount}.`;
        } else {
            if (!out.token || out.token.category.toLowerCase() !== t.sellToken) return 'A funding output does not carry the token this order sells.';
            if (out.token.amount !== p.sellAmount) return `A funding output pays ${out.token.amount} token units; the order sells ${p.sellAmount}.`;
        }
    }
    return null;
}

export type StatusTone = 'wait' | 'live' | 'done' | 'back' | 'dead';

/** How a status reads on the page. */
export function statusView(status: string): { label: string; tone: StatusTone; hint: string } {
    switch (status) {
        case 'awaiting_funding': return { label: 'Awaiting funding', tone: 'wait', hint: 'Nothing is locked yet.' };
        // the page's own state between sending the funding transaction and the server seeing it
        case 'funding_sent': return { label: 'Funding sent', tone: 'live', hint: 'Waiting for the server to see the funding transaction.' };
        case 'active': return { label: 'Open', tone: 'live', hint: 'Funded and open to solvers.' };
        case 'scheduled': return { label: 'Scheduled', tone: 'live', hint: 'Funded; opens at its start time.' };
        case 'running': return { label: 'Running', tone: 'live', hint: 'Slices open and fill one after another.' };
        case 'filled': return { label: 'Filled', tone: 'done', hint: 'The maker received the bought asset.' };
        case 'completed': return { label: 'Completed', tone: 'done', hint: 'Every slice filled.' };
        case 'partially_filled': return { label: 'Partly filled', tone: 'done', hint: 'Some slices filled; the rest went back to the maker.' };
        case 'refunded': return { label: 'Refunded', tone: 'back', hint: 'The sold asset went back to the maker.' };
        case 'refund_pending':
        case 'expired': return { label: 'Refund pending', tone: 'back', hint: 'Past its deadline. The funds are on their way back to the maker.' };
        case 'underfunded': return { label: 'Underfunded', tone: 'back', hint: 'Funded with less than the order needs. It will not fill; the funds return after the deadline.' };
        case 'expired_unfunded': return { label: 'Expired', tone: 'dead', hint: 'It was never funded. Nothing was locked.' };
        case 'cancelled': return { label: 'Cancelled', tone: 'dead', hint: 'Cancelled by the maker.' };
        case 'closed_external': return { label: 'Closed', tone: 'dead', hint: 'The covenant was spent by another transaction.' };
        default: return { label: status || 'Unknown', tone: 'dead', hint: '' };
    }
}

const OPEN = new Set(['awaiting_funding', 'active', 'scheduled', 'running', 'expired', 'refund_pending', 'underfunded']);
/** True while the order can still change on its own (keep polling). */
export const isOpen = (status: string): boolean => OPEN.has(status);

// ── Remembering a funding transaction ────────────────────────────────────────
// The server takes a few seconds to see a funding transaction. Until it does the
// order still reads "awaiting funding", and a reload must not offer to fund it twice.

const key = (t: Pick<FundTarget, 'kind' | 'id'>) => `fund-sent:${t.kind}:${t.id}`;

export function rememberFunding(t: Pick<FundTarget, 'kind' | 'id'>, txid: string): void {
    try { localStorage.setItem(key(t), txid); } catch { /* private mode: the session state still holds it */ }
}

export function recallFunding(t: Pick<FundTarget, 'kind' | 'id'>): string | null {
    try { return localStorage.getItem(key(t)); } catch { return null; }
}
