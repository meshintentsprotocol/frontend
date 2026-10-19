/**
 * The networks and tokens the Send flow can send on, and how a send is carried
 * out on each. EVM is one entry per chain we support (Ethereum, Base, Arbitrum,
 * Optimism, BNB) — the same key signs them all, with the chain's own RPC — so a
 * user picks the exact network they are sending on.
 *
 * Balances are read on demand for the chosen chain, so the token list is right
 * even on a chain the portfolio does not track.
 */

import { getEVMChainConfig, getEvmSignerForChain, type EVMChainConfig } from '@/lib/evmChains';

export type SendFamily = 'evm' | 'bch' | 'sol' | 'move' | 'btc';

export interface SendChain {
    /** Unique id, e.g. 'evm:base' or 'bch'. */
    id: string;
    family: SendFamily;
    /** EVM chain key when family is evm. */
    evmKey?: string;
    name: string;
    /** Network line, e.g. "Base · Mainnet". */
    sublabel: string;
    icon: string;
    /** Hex, tints the card and Cham. */
    color: string;
    /** Placeholder for the recipient field. */
    recipientHint: string;
}

export interface SendToken {
    id: string;
    symbol: string;
    name: string;
    icon: string;
    decimals: number;
    /** ERC-20 / coin contract, or BCH CashToken category. */
    address?: string;
    bchCategory?: string;
    /** Movement coin type override. */
    moveType?: string;
}

const ICON = {
    eth: '/logos/ethereum-eth-logo.svg',
    bnb: '/logos/bnb-bnb-logo.svg',
    bch: '/logos/bitcoin-cash-bch-logo.svg',
    btc: '/logos/bitcoin-btc-logo.svg',
    sol: '/assets/solanaLogo.png',
    move: '/logos/movement.svg',
    usdc: '/logos/usd-coin-usdc-logo.svg',
    usdt: '/logos/usdt-svgrepo-com.svg',
};

const EVM_META: Record<string, { color: string }> = {
    ethereum: { color: '#627eea' },
    base: { color: '#2f6fff' },
    arbitrum: { color: '#2d9bf0' },
    optimism: { color: '#fb5a5a' },
    bsc: { color: '#f0b90b' },
};

/** The EVM chains offered for the current network, in display order. */
const EVM_ORDER_TESTNET = ['ethereum', 'base', 'arbitrum', 'optimism'];
const EVM_ORDER_MAINNET = ['bsc', 'ethereum', 'base', 'arbitrum', 'optimism'];

function evmChain(key: string, isMainnet: boolean): SendChain | null {
    const cfg = getEVMChainConfig(key, isMainnet);
    if (!cfg) return null;
    const native = cfg.nativeCurrency;
    return {
        id: `evm:${key}`, family: 'evm', evmKey: key,
        name: cfg.name.replace(/ (Sepolia|Testnet|One|Mainnet)$/, '') || cfg.name,
        sublabel: cfg.name,
        icon: native === 'BNB' ? ICON.bnb : ICON.eth,
        color: EVM_META[key]?.color ?? '#627eea',
        recipientHint: '0x… address',
    };
}

/** Every network the built-in wallet can send from right now. */
export function sendChains(opts: {
    isMainnet: boolean;
    evmAddress?: string | null;
    bchConnected?: boolean;
    solanaAddress?: string | null;
    movementAddress?: string | null;
    btcAddress?: string | null;
}): SendChain[] {
    const list: SendChain[] = [];
    if (opts.bchConnected) {
        list.push({ id: 'bch', family: 'bch', name: 'Bitcoin Cash', sublabel: opts.isMainnet ? 'Mainnet' : 'Chipnet', icon: ICON.bch, color: '#0ac18e', recipientHint: opts.isMainnet ? 'bitcoincash:q…' : 'bchtest:q…' });
    }
    if (opts.evmAddress) {
        for (const key of opts.isMainnet ? EVM_ORDER_MAINNET : EVM_ORDER_TESTNET) {
            const c = evmChain(key, opts.isMainnet);
            if (c) list.push(c);
        }
    }
    if (opts.solanaAddress) {
        list.push({ id: 'sol', family: 'sol', name: 'Solana', sublabel: 'Devnet', icon: ICON.sol, color: '#9945ff', recipientHint: 'Solana address' });
    }
    if (opts.btcAddress) {
        list.push({ id: 'btc', family: 'btc', name: 'Bitcoin', sublabel: 'Testnet', icon: ICON.btc, color: '#f7931a', recipientHint: 'tb1q… or 2N…' });
    }
    return list;
}

/** The fixed (non-CashToken) tokens a chain offers. BCH CashTokens are added by the caller from live balances. */
export function tokensForChain(chain: SendChain, isMainnet: boolean): SendToken[] {
    if (chain.family === 'evm' && chain.evmKey) {
        const cfg = getEVMChainConfig(chain.evmKey, isMainnet);
        if (!cfg) return [];
        const tokens: SendToken[] = [{ id: `${chain.id}-native`, symbol: cfg.nativeCurrency, name: chain.name, icon: cfg.nativeCurrency === 'BNB' ? ICON.bnb : ICON.eth, decimals: 18 }];
        if (cfg.usdcAddress) tokens.push({ id: `${chain.id}-usdc`, symbol: 'USDC', name: 'USD Coin', icon: ICON.usdc, decimals: 6, address: cfg.usdcAddress });
        if (cfg.usdtAddress) tokens.push({ id: `${chain.id}-usdt`, symbol: 'USDT', name: 'Tether USD', icon: ICON.usdt, decimals: 6, address: cfg.usdtAddress });
        return tokens;
    }
    if (chain.family === 'bch') {
        return [{ id: 'bch-native', symbol: 'BCH', name: 'Bitcoin Cash', icon: ICON.bch, decimals: 8 }];
    }
    if (chain.family === 'sol') {
        return [
            { id: 'sol-native', symbol: 'SOL', name: 'Solana', icon: ICON.sol, decimals: 9 },
            { id: 'sol-usdc', symbol: 'USDC', name: 'USD Coin', icon: ICON.usdc, decimals: 6, address: 'usdc' },
            { id: 'sol-usdt', symbol: 'USDT', name: 'Tether USD', icon: ICON.usdt, decimals: 6, address: 'usdt' },
        ];
    }
    if (chain.family === 'move') {
        return [
            { id: 'move-native', symbol: 'MOVE', name: 'Movement', icon: ICON.move, decimals: 8 },
            { id: 'move-usdc', symbol: 'USDC', name: 'USD Coin', icon: ICON.usdc, decimals: 6, moveType: '0x45142fb00dde90b950183d8ac2815597892f665c254c3f42b5768bc6ae4c8489' },
            { id: 'move-usdt', symbol: 'USDT', name: 'Tether USD', icon: ICON.usdt, decimals: 6, moveType: '0xa663e903b11931807045423e25847425466a0c9777021464e104e845e1123963' },
        ];
    }
    if (chain.family === 'btc') {
        return [{ id: 'btc-native', symbol: 'BTC', name: 'Bitcoin', icon: ICON.btc, decimals: 8 }];
    }
    return [];
}

const ERC20_READ = ['function balanceOf(address) view returns (uint256)'];

/** Read the balances of a chain's tokens, for the picker. EVM reads from the chain's own RPC. */
export async function readBalances(chain: SendChain, tokens: SendToken[], ctx: {
    isMainnet: boolean;
    evmAddress?: string | null;
    bchSats?: number;
    bchTokenBalances?: Record<string, bigint>;
    portfolioBalance?: (symbol: string) => number | undefined;
}): Promise<Record<string, number>> {
    const out: Record<string, number> = {};
    if (chain.family === 'evm' && chain.evmKey && ctx.evmAddress) {
        const cfg = getEVMChainConfig(chain.evmKey, ctx.isMainnet)!;
        const { ethers } = await import('ethers');
        const provider = new ethers.JsonRpcProvider(cfg.rpc, cfg.chainId);
        await Promise.all(tokens.map(async t => {
            try {
                if (!t.address) {
                    const bal = await provider.getBalance(ctx.evmAddress!);
                    out[t.id] = Number(ethers.formatEther(bal));
                } else {
                    const erc = new ethers.Contract(t.address, ERC20_READ, provider);
                    const raw: bigint = await erc.balanceOf(ctx.evmAddress);
                    out[t.id] = Number(ethers.formatUnits(raw, t.decimals));
                }
            } catch { out[t.id] = NaN; }
        }));
        return out;
    }
    if (chain.family === 'bch') {
        out['bch-native'] = (ctx.bchSats ?? 0) / 1e8;
        for (const t of tokens) {
            if (t.bchCategory && ctx.bchTokenBalances && ctx.bchTokenBalances[t.bchCategory] !== undefined) {
                out[t.id] = Number(ctx.bchTokenBalances[t.bchCategory]);
            }
        }
        return out;
    }
    // Solana, Movement and Bitcoin balances come from the portfolio the wallet already tracks.
    const bySymbol: Record<string, string> = {
        'sol-native': 'SOL', 'sol-usdc': 'USDC', 'sol-usdt': 'USDT (SOL)',
        'move-native': 'MOVE', 'move-usdc': 'USDC (MOVE)', 'move-usdt': 'USDT (MOVE)',
        'btc-native': 'BTC',
    };
    for (const t of tokens) {
        const sym = bySymbol[t.id];
        out[t.id] = sym ? (ctx.portfolioBalance?.(sym) ?? 0) : 0;
    }
    return out;
}

export { getEvmSignerForChain, type EVMChainConfig };
