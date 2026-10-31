import { ethers } from 'ethers';

export const BSC_BCH_URL = import.meta.env.VITE_BSC_BCH_SERVER_URL || 'https://meshserver.onrender.com';

export interface EVMToBCHRequest {
    makerAddress: string;
    recipientAddress: string;
    sellAmount: string;      // wei or token units (string to avoid bigint issues)
    buyAmount: string;       // satoshis
    evmEscrowId: string;
    useStark?: boolean;
    hashlock?: string;
    evmTokenAddress?: string;
    chainName?: string;      // bsc-bch-server chain key e.g. "Sepolia", "BSCTestnet"
    expiryTime?: number;
}

export interface BCHToEVMRequest {
    makerAddress: string;
    recipientAddress: string;
    sellAmount: string;       // satoshis (BCH dust) locked with the token
    buyAmount: string;        // wei
    hashlock: string;         // "dummy" for STARK/ZK path
    timelock: number;
    bchContractAddress: string;
    evmTokenAddress?: string;
    chainName?: string;      // bsc-bch-server chain key e.g. "Sepolia", "BSCTestnet"
    expiryTime?: number;
    useStark?: boolean;      // ZK route — server delivers EVM funds directly, no hashlock escrow
    /** Present when selling a BCH CashToken (e.g. PUSD) instead of native BCH */
    bchToken?: { category: string; amount: string };
}

export interface ETHOrderStatus {
    status: string;
    fillTxid?: string;
    sourceTxid?: string;
    evmEscrowId?: string;
    /** EVM→BCH: tx that delivered BCH to user (intent.destFillTx) */
    bchTxHash?: string;
    /** BCH→EVM: tx that delivered EVM funds to user (intent.destFillTx) */
    evmFillTxHash?: string;
    /** EVM→BCH: tx that claimed the STARK/FRI escrow on-chain (intent.sourceClaimTx) */
    evmClaimTxHash?: string;
    error?: string;
    /** Raw intent for advanced use */
    raw?: Record<string, unknown>;
}

async function request<T>(path: string, isMainnet: boolean, options?: RequestInit): Promise<T> {
    // Append ?network=mainnet without clobbering any query params already on the path.
    let fullPath = path;
    if (isMainnet) {
        const sep = path.includes('?') ? '&' : '?';
        fullPath = `${path}${sep}network=mainnet`;
    }
    const url = `${BSC_BCH_URL}${fullPath}`;
    const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
    });
    if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        throw new Error(`BSC-BCH server error ${res.status}: ${text}`);
    }
    return res.json();
}

export async function getStarkCovenantAddress(
    isMainnet = false,
    userAddress?: string,
    timelock?: number,
): Promise<{ address: string; tokenAddress?: string; timelock?: number }> {
    const params = new URLSearchParams();
    if (userAddress) params.set('userAddress', userAddress);
    if (timelock)    params.set('timelock', timelock.toString());
    const qs = params.toString() ? `?${params.toString()}` : '';
    return request<{ address: string; tokenAddress?: string; timelock?: number }>(`/stark/address${qs}`, isMainnet);
}

// Server responds with { success, network, intent: CrossChainIntent } — extract intentId.
async function extractIntentId(raw: any): Promise<{ intentId: string }> {
    const id = raw?.intentId ?? raw?.intent?.id ?? raw?.id;
    if (!id) throw new Error('Server did not return an intentId');
    return { intentId: id };
}

export async function createEVMToBCHIntent(req: EVMToBCHRequest, isMainnet = false): Promise<{ intentId: string }> {
    const raw = await request<any>('/swap/evm-to-bch', isMainnet, { method: 'POST', body: JSON.stringify(req) });
    return extractIntentId(raw);
}

export async function createBCHToEVMIntent(req: BCHToEVMRequest, isMainnet = false): Promise<{ intentId: string }> {
    const raw = await request<any>('/swap/bch-to-evm', isMainnet, { method: 'POST', body: JSON.stringify(req) });
    return extractIntentId(raw);
}

export async function getOrder(id: string, isMainnet = false): Promise<ETHOrderStatus> {
    // Server returns { intent: CrossChainIntent } — unwrap and normalise field names.
    const resp = await request<{ intent?: Record<string, any> } | ETHOrderStatus>(`/orders/${id}`, isMainnet);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const intent: Record<string, any> = (resp as any).intent ?? resp;
    return {
        status:         intent.status         ?? 'PENDING',
        evmEscrowId:    intent.bscEscrowId,
        // ETH→BCH: BCH delivery tx is destFillTx; BCH→ETH: EVM delivery tx is destFillTx
        bchTxHash:      intent.destFillTx,
        evmFillTxHash:  intent.destFillTx,
        evmClaimTxHash: intent.sourceClaimTx,
        sourceTxid:     intent.sourceLockTx,
        error:          intent.failReason,
        raw:            intent,
    };
}

export async function getSolverInfo(isMainnet = false): Promise<{
    wallets: { evm: { address: string }; bch: { address: string } };
}> {
    return request('/solver', isMainnet);
}

export interface RefundBCHInfo {
    unsignedTxHex: string;
    sighashHex:    string;
    utxoTxid:      string;
    utxoVout:      number;
    utxoSats:      string;
    timelock:      number;
    timelockPassed: boolean;
}

export async function getRefundBCH(intentId: string, isMainnet = false): Promise<RefundBCHInfo> {
    return request(`/intents/${intentId}/refund-bch`, isMainnet);
}

export async function postRefundBCH(
    intentId: string,
    body: { userPk: string; userSig: string },
    isMainnet = false,
): Promise<{ success: boolean; txid: string }> {
    return request(`/intents/${intentId}/refund-bch`, isMainnet, {
        method: 'POST',
        body: JSON.stringify(body),
    });
}

export async function postClaim(
    intentId: string,
    secret: string,
    chain?: string,
    isMainnet = false,
): Promise<{ success: boolean; message: string; intentId: string }> {
    const query = chain ? `?chain=${chain}` : '';
    return request(`/claim${query}`, isMainnet, {
        method: 'POST',
        body: JSON.stringify({ intentId, secret }),
    });
}

// Converts a decimal ETH/USDT amount string to wei/token-units string
export function toWei(amount: string, decimals: number): string {
    return ethers.parseUnits(amount, decimals).toString();
}
