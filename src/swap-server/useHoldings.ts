/**
 * What the in-app wallet holds on the swap server's chains, as rows for the portfolio and the wallet's token list:
 * USDC on every cross-chain USDC chain of the current mode, and in Mainnet mode every Solana token.
 *
 * The rows the portfolio already reads itself are left out, so nothing is counted twice.
 */
import { useQuery } from '@tanstack/react-query';
import { swapServerApiFor, swapServerConfigured } from './api';
import { cctpInMode, localChain } from './cctpChains';
import { USDC_ICON } from './tokens';
import type { ChainBalance, SolanaBalance, SwapServerConfig } from './types';

/** The shape of a portfolio row (PortfolioToken in hooks/usePortfolio.ts). */
export interface Holding {
    symbol: string;
    name: string;
    chain: string;
    icon: string;
    balance: number;
    price: number;
    valueUsd: number;
    change24h: number;
    decimals?: number;
}

/** Chains whose USDC the portfolio reads itself: Sepolia through its EVM query, Solana through its own. */
const READ_BY_PORTFOLIO = new Set(['eth-sepolia', 'solana-devnet', 'solana']);
/** Solana mints the portfolio already shows in Mainnet mode: SOL, USDC and USDT. */
const SOLANA_SHOWN = new Set([
    'So11111111111111111111111111111111111111112',
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
]);

/**
 * Symbols other screens look up in the portfolio by symbol alone (the send form reads its balances that way).
 * A row from here never carries one of them bare: it would be taken for the balance on another chain.
 */
const RESERVED = new Set(['BCH', 'BTC', 'ETH', 'BNB', 'SOL', 'USDC', 'USDT', 'MOVE', 'XMR']);

/** The chains whose USDC balance is worth asking for: this mode's, signable here, not already in the portfolio. */
export function holdingChains(config: SwapServerConfig | undefined, isMainnet: boolean) {
    if (!config || !cctpInMode(config, isMainnet)) return [];
    return config.cctp.chains.filter(c => !READ_BY_PORTFOLIO.has(c.key) && !!localChain(c.key));
}

export function holdingsFrom(
    config: SwapServerConfig | undefined, usdc: ChainBalance[], solana: SolanaBalance[], opts: { isMainnet: boolean; usdcPrice: number; usdcChange24h?: number },
): Holding[] {
    const rows: Holding[] = [];
    for (const b of usdc) {
        const chain = config?.cctp.chains.find(c => c.key === b.chain);
        const balance = Number(b.display);
        if (!chain || !(balance > 0)) continue;
        rows.push({
            symbol: `USDC (${chain.name})`, name: `USD Coin on ${chain.name}`, chain: chain.name, icon: USDC_ICON, decimals: 6,
            balance, price: opts.usdcPrice, valueUsd: balance * opts.usdcPrice, change24h: opts.usdcChange24h ?? 0,
        });
    }
    if (opts.isMainnet) {
        for (const b of solana) {
            const balance = Number(b.display);
            if (b.native || SOLANA_SHOWN.has(b.mint) || !(balance > 0)) continue;
            // A token Jupiter does not know has no symbol and no price: it is listed by its mint and counts as 0.
            const symbol = b.symbol ?? `${b.mint.slice(0, 4)}…${b.mint.slice(-4)}`;
            rows.push({
                symbol: RESERVED.has(symbol.toUpperCase()) ? `${symbol} (SOL)` : symbol, name: b.name ?? 'Unknown token', chain: 'Solana', icon: b.icon ?? '',
                decimals: b.decimals, balance, price: b.usdPrice ?? 0, valueUsd: b.usdValue ?? 0, change24h: 0,
            });
        }
    }
    return rows;
}

/** Type-guard to check if an address is non-null, defined, and non-empty. */
export function hasAddress(addr?: string | null): addr is string {
    return Boolean(addr && addr.trim() !== '');
}

export function useSwapServerHoldings(p: {
    evmAddress?: string | null; solanaAddress?: string | null; isMainnet: boolean; usdcPrice: number; usdcChange24h?: number; refetchInterval?: number | false;
}) {
    const api = swapServerApiFor(p.isMainnet);
    const on = swapServerConfigured;
    // Same key as the provider's query: one fetch serves both.
    const config = useQuery({
        queryKey: ['swap-server', 'config', api.baseUrl],
        queryFn: ({ signal }) => api.getConfig({ signal }),
        enabled: on && (hasAddress(p.evmAddress) || hasAddress(p.solanaAddress)),
        staleTime: 30_000, retry: 1,
    }).data;

    const chains = holdingChains(config, p.isMainnet);
    const usdc = useQuery({
        queryKey: ['swap-server', 'holdings-usdc', api.baseUrl, chains.map(c => c.key).join(), p.evmAddress, p.solanaAddress],
        enabled: on && chains.length > 0 && (hasAddress(p.evmAddress) || hasAddress(p.solanaAddress)),
        queryFn: async ({ signal }): Promise<ChainBalance[]> => {
            const asked = chains.flatMap(c => { const owner = c.kind === 'evm' ? p.evmAddress : p.solanaAddress; return hasAddress(owner) ? [{ key: c.key, owner }] : []; });
            // A chain whose RPC is down is left out; the others still show.
            const got = await Promise.allSettled(asked.map(a => api.getChainBalance(a.key, a.owner, { signal })));
            return got.flatMap(r => (r.status === 'fulfilled' ? [r.value] : []));
        },
        staleTime: 15_000, refetchInterval: p.refetchInterval ?? false, retry: 1,
    });

    const solana = useQuery({
        queryKey: ['swap-server', 'sol-balances', p.solanaAddress],
        queryFn: ({ signal }) => api.getSolBalances(p.solanaAddress!, { signal }),
        enabled: on && p.isMainnet && hasAddress(p.solanaAddress) && !!config?.solana.enabled,
        staleTime: 15_000, refetchInterval: p.refetchInterval ?? false, retry: 1,
    });

    return {
        holdings: holdingsFrom(config, usdc.data ?? [], solana.data?.balances ?? [], p),
        isFetching: usdc.isFetching || solana.isFetching,
        refetch: () => {
            if (on && (hasAddress(p.evmAddress) || hasAddress(p.solanaAddress))) void usdc.refetch();
            if (on && p.isMainnet && hasAddress(p.solanaAddress) && !!config?.solana.enabled) void solana.refetch();
        },
    };
}
