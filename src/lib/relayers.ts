// ============================================================================
// relayers.ts — Fetch + normalize intents from all 3 relayers
// Ported from bchintents-explorer/src/lib/api.ts for use in the frontend.
// ============================================================================

import { swapServerApiFor, swapServerConfigured } from '@/swap-server/api';
import type { ActivityItem } from '@/swap-server/types';
import {
    CASHTOKEN_RELAYER_URL,
    CASHTOKEN_RELAYER_MAINNET_URL,
    BCH_SOLANA_RELAYER_URL,
} from './config';

const BSC_BCH_SERVER_URL = import.meta.env.VITE_BSC_BCH_SERVER_URL || 'https://meshserver-production-9ed93ac9.up.railway.app';
const BSC_BCH_SERVER_MAINNET_URL = import.meta.env.VITE_BSC_BCH_SERVER_MAINNET_URL || 'https://meshserver-production-9ed93ac9.up.railway.app';

export type TxStatus = 'PENDING' | 'ACTIVE' | 'FILLED' | 'COMPLETED' | 'REFUNDED' | 'FAILED' | 'EXPIRED';
export type TxSource = 'cashtoken' | 'bsc-bch' | 'sol-bch' | 'cctp' | 'jupiter';

export interface ProtocolTx {
    id: string;
    source: TxSource;
    direction: string;
    status: TxStatus;
    /** Normalized display symbol: 'BCH', 'SOL', 'BNB', 'USDC', or 'CT:a9ca91aa…' */
    sellToken: string;
    buyToken: string;
    /** Raw value from API — 64-char hex for CashTokens, 'BCH' for native */
    sellTokenRaw: string;
    buyTokenRaw: string;
    sellAmount: string;
    buyAmount: string;
    makerAddress: string;
    createdAt: number;
    fillTxid?: string;
    fundingTxid?: string;
    explorerUrl?: string;
}

async function safeFetch<T>(url: string, fallback: T): Promise<T> {
    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) return fallback;
        return (await res.json()) as T;
    } catch {
        return fallback;
    }
}

function toSec(ts: number): number {
    return ts > 1e12 ? Math.floor(ts / 1000) : ts;
}

function shortToken(t: string): string {
    if (!t) return 'TOKEN';
    if (t.length >= 60) return `CT:${t.slice(0, 8)}…`;
    return t;
}

// ─── CashToken ────────────────────────────────────────────────────────────────

interface RawCashIntent {
    id: string;
    type: string;
    makerAddress: string;
    contractAddress: string;
    sellToken: string;
    buyToken: string;
    sellAmount: string;
    buyAmount: string;
    status: string;
    fundingTxid?: string;
    fillTxid?: string;
    explorerUrl?: string;
    createdAt: number;
    expiryTime?: number;
    duration?: number;
    startBuyAmount?: string;
    endBuyAmount?: string;
}

function mapCashStatus(s: string): TxStatus {
    const m: Record<string, TxStatus> = {
        pending: 'PENDING', active: 'ACTIVE', filled: 'COMPLETED',
        failed: 'FAILED', cancelled: 'FAILED', expired: 'EXPIRED', refunded: 'REFUNDED',
    };
    return m[s.toLowerCase()] ?? 'FAILED';
}

function normalizeCash(r: RawCashIntent): ProtocolTx {
    const isBchSell = !r.sellToken || r.sellToken === 'BCH' || r.sellToken.length < 60;
    return {
        id: r.id,
        source: 'cashtoken',
        direction: isBchSell ? 'BCH_TO_TOKEN' : 'TOKEN_TO_BCH',
        status: mapCashStatus(r.status),
        sellToken: shortToken(r.sellToken),
        buyToken: shortToken(r.buyToken),
        sellTokenRaw: r.sellToken || 'BCH',
        buyTokenRaw: r.buyToken || 'BCH',
        sellAmount: r.sellAmount,
        buyAmount: r.buyAmount,
        makerAddress: r.makerAddress,
        createdAt: toSec(r.createdAt),
        fundingTxid: r.fundingTxid,
        fillTxid: r.fillTxid,
        explorerUrl: r.explorerUrl,
    };
}

// ─── BSC-BCH ─────────────────────────────────────────────────────────────────

interface RawBscIntent {
    id: string;
    direction: string;
    status: string;
    sellAmount: string;
    buyAmount: string;
    makerAddress?: string;
    createdAt: number;
    sourceLockTx?: string;
    destFillTx?: string;
}

function mapBscStatus(s: string): TxStatus {
    const m: Record<string, TxStatus> = {
        PENDING: 'PENDING', SOURCE_LOCKED: 'ACTIVE', DEST_FILLED: 'FILLED',
        GENERATING_PROOF: 'ACTIVE', DEST_CLAIMED: 'FILLED',
        COMPLETED: 'COMPLETED', FAILED: 'FAILED', REFUNDED: 'REFUNDED',
    };
    return m[s] ?? 'FAILED';
}

function normalizeBsc(r: RawBscIntent): ProtocolTx {
    const isBscToBch = r.direction === 'BSC_TO_BCH';
    const sell = isBscToBch ? 'BNB' : 'BCH';
    const buy = isBscToBch ? 'BCH' : 'BNB';
    return {
        id: r.id,
        source: 'bsc-bch',
        direction: r.direction,
        status: mapBscStatus(r.status),
        sellToken: sell,
        buyToken: buy,
        sellTokenRaw: sell,
        buyTokenRaw: buy,
        sellAmount: r.sellAmount,
        buyAmount: r.buyAmount,
        makerAddress: r.makerAddress ?? '',
        createdAt: toSec(r.createdAt),
        fillTxid: r.destFillTx,
    };
}

// ─── SOL-BCH ─────────────────────────────────────────────────────────────────

interface RawSolIntent {
    id: string;
    direction: string;
    status: string;
    sellAmount: string;
    buyAmount: string;
    makerAddress?: string;
    takerAddress?: string;
    createdAt: number;
    destFillTx?: string;
    destClaimTx?: string;
    solanaTxSig?: string;
}

function mapSolStatus(s: string): TxStatus {
    const m: Record<string, TxStatus> = {
        PENDING: 'PENDING', SOURCE_LOCKED: 'ACTIVE', DEST_FILLED: 'FILLED',
        PROOF_GENERATED: 'ACTIVE', DEST_CLAIMED: 'FILLED',
        COMPLETED: 'COMPLETED', FAILED: 'FAILED', REFUNDED: 'REFUNDED',
    };
    return m[s] ?? 'FAILED';
}

function normalizeSol(r: RawSolIntent): ProtocolTx {
    let sell = 'BCH', buy = 'SOL';
    const dir = r.direction;
    if (dir === 'BCH_TO_SOL') { sell = 'BCH'; buy = 'SOL'; }
    if (dir === 'SOL_TO_BCH') { sell = 'SOL'; buy = 'BCH'; }
    if (dir === 'BCH_TO_USDC') { sell = 'BCH'; buy = 'USDC'; }
    if (dir === 'USDC_TO_BCH') { sell = 'USDC'; buy = 'BCH'; }
    return {
        id: r.id,
        source: 'sol-bch',
        direction: dir,
        status: mapSolStatus(r.status),
        sellToken: sell,
        buyToken: buy,
        sellTokenRaw: sell,
        buyTokenRaw: buy,
        sellAmount: r.sellAmount,
        buyAmount: r.buyAmount,
        makerAddress: r.makerAddress ?? r.takerAddress ?? '',
        createdAt: toSec(r.createdAt),
        fillTxid: r.destClaimTx ?? r.destFillTx,
    };
}

// ─── Swap server: cross-chain USDC (Circle CCTP) and Solana swaps (Jupiter) ────

const SWAP_SERVER_STATUS: Record<ActivityItem['phase'], TxStatus> = {
    awaiting_signature: 'PENDING', processing: 'ACTIVE', action_needed: 'ACTIVE', completed: 'COMPLETED', failed: 'FAILED', expired: 'EXPIRED',
};

/** One row of the swap server's public feed in the shape of this list. The explorer link comes with the row. */
export function normalizeSwapServer(i: ActivityItem): ProtocolTx {
    return {
        id: i.id,
        source: i.product === 'cctp' ? 'cctp' : 'jupiter',
        direction: i.kind === 'transfer' ? `${i.sell.chainName} → ${i.buy.chainName}` : 'Solana',
        status: SWAP_SERVER_STATUS[i.phase] ?? 'FAILED',
        sellToken: i.sell.symbol ?? 'TOKEN',
        buyToken: i.buy.symbol ?? 'TOKEN',
        sellTokenRaw: i.sell.token,
        buyTokenRaw: i.buy.token,
        sellAmount: i.sell.display ?? '0',
        buyAmount: i.buy.display ?? '0',
        makerAddress: i.owner,
        createdAt: toSec(i.createdAt),
        explorerUrl: i.links.destination ?? i.links.source,
    };
}

export async function fetchSwapServerTxs(isMainnet: boolean): Promise<ProtocolTx[]> {
    if (!swapServerConfigured) return [];
    const network = isMainnet ? 'mainnet' : 'testnet';
    try {
        // No address: the public feed, which leaves out records that never reached a chain.
        const page = await swapServerApiFor(isMainnet).getActivity([], { limit: 100 }, { timeoutMs: 8000 });
        return page.items.filter(i => i.network === network).map(normalizeSwapServer);
    } catch {
        return [];
    }
}

// ─── Public fetch functions ───────────────────────────────────────────────────

export async function fetchCashTokenTxs(isMainnet: boolean): Promise<ProtocolTx[]> {
    const base = isMainnet ? CASHTOKEN_RELAYER_MAINNET_URL : CASHTOKEN_RELAYER_URL;
    const data = await safeFetch<{ active?: RawCashIntent[]; completed?: RawCashIntent[] }>(
        `${base}/intents`, { active: [], completed: [] }
    );
    return [...(data.active ?? []), ...(data.completed ?? [])].map(normalizeCash);
}

export async function fetchBscBchTxs(isMainnet: boolean): Promise<ProtocolTx[]> {
    const base = isMainnet ? BSC_BCH_SERVER_MAINNET_URL : BSC_BCH_SERVER_URL;
    const network = isMainnet ? 'mainnet' : 'testnet';
    const data = await safeFetch<{ active?: RawBscIntent[]; completed?: RawBscIntent[] }>(
        `${base}/orders?network=${network}`, { active: [], completed: [] }
    );
    return [...(data.active ?? []), ...(data.completed ?? [])].map(normalizeBsc);
}

export async function fetchSolBchTxs(isMainnet: boolean): Promise<ProtocolTx[]> {
    const base = BCH_SOLANA_RELAYER_URL;
    const network = isMainnet ? 'mainnet' : 'testnet';
    const data = await safeFetch<{ active?: RawSolIntent[]; completed?: RawSolIntent[] }>(
        `${base}/orders?network=${network}`, { active: [], completed: [] }
    );
    return [...(data.active ?? []), ...(data.completed ?? [])].map(normalizeSol);
}

export async function fetchAllProtocolTxs(isMainnet: boolean): Promise<ProtocolTx[]> {
    const [cash, bsc, sol, swapServer] = await Promise.all([
        fetchCashTokenTxs(isMainnet),
        fetchBscBchTxs(isMainnet),
        fetchSolBchTxs(isMainnet),
        fetchSwapServerTxs(isMainnet),
    ]);
    return [...cash, ...bsc, ...sol, ...swapServer].sort((a, b) => b.createdAt - a.createdAt);
}
