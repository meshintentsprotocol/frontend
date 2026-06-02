/**
 * usePortfolio — composed, cached, multi-chain portfolio.
 *
 * Three balance queries (EVM / Solana / BCH) run in parallel and independently,
 * so a slow chain never blocks the others. Prices come from a single shared
 * source (`usePrices`). The token list and `totalValue` are derived from the
 * exact same data, so the header total is always the strict aggregate of the
 * displayed token rows.
 *
 * All queries share the app-wide QueryClient: the wallet popup, portfolio page
 * and send modal de-duplicate onto one set of requests and one cache.
 */

import { useMemo, useCallback, useRef } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { useWDK } from '@/context/WDKProvider';
import { getEvmConfig, USDT_BSC, USDT_SEPOLIA, USDC_SEPOLIA, USDC_BSC } from '@/lib/intentHTLC';
import { usePrices } from '@/hooks/usePrices';
import { useBchBalances } from '@/hooks/useBchBalances';
import { CauldronService } from '@/lib/cauldron';
import { readPersisted } from '@/lib/persist';

// Portfolio token structure
export interface PortfolioToken {
    symbol: string;
    name: string;
    chain: string;
    icon: string;
    balance: number;
    price: number;
    valueUsd: number;
    change24h: number;
    /** Token decimals — set for BCH CashTokens. */
    decimals?: number;
    /** CashToken category id — set for BCH CashTokens. */
    category?: string;
}

interface EvmBalances {
    native: number;
    usdt: number;
    usdc: number;
}

interface SolBalances {
    sol: number;
    usdc: number;
    usdt: number;
}

const SOL_TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const SOL_USDC_MINTS = [
    '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU', // devnet
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // mainnet
];
const SOL_USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';

// Deterministic offsets so the chart shape is stable across refetches and only
// the magnitude (totalValue) scales — prevents recharts re-animating on every
// poll-driven refresh.
const CHART_OFFSETS = [
    -0.018, -0.012, -0.005, 0.003, 0.011, 0.018, 0.015, 0.009,
    0.001, -0.007, -0.014, -0.016, -0.010, -0.003, 0.005, 0.013,
    0.019, 0.016, 0.010, 0.004, -0.002, -0.008, -0.013, -0.015, 0,
];

const generateChartData = (currentTotal: number, anchorMs: number) => {
    const out: { time: string; value: number }[] = [];
    for (let i = 24; i >= 0; i--) {
        const time = new Date(anchorMs - i * 60 * 60 * 1000);
        const volatility = 1 + CHART_OFFSETS[24 - i];
        out.push({
            time: time.toISOString(),
            value: currentTotal * volatility * (1 - i * 0.001),
        });
    }
    out[out.length - 1].value = currentTotal;
    return out;
};

export function usePortfolio(options?: { pollingMs?: number }) {
    const pollingMs = options?.pollingMs ?? 0;
    const refetchInterval = pollingMs > 0 ? pollingMs : (false as const);

    const { connection: solanaConnection } = useConnection();
    const { evmAddress, solanaAddress, bchNetwork, isInitialized: wdkConnected, bchAddress, btcAddress, btcAccount } = useWDK();
    const isMainnet = bchNetwork === 'mainnet';

    const chartAnchorRef = useRef<number>(Date.now());

    const { prices, isLoading: pricesLoading, isFetching: pricesFetching } = usePrices();

    // ── EVM (Sepolia testnet / BSC mainnet) ──────────────────────────────────
    const evmKey = ['evm-balances', evmAddress ?? '', isMainnet] as const;
    const evmQuery = useQuery<EvmBalances>({
        queryKey: evmKey,
        enabled: !!evmAddress,
        staleTime: 5_000,
        refetchInterval,
        placeholderData: keepPreviousData,
        initialData: () => readPersisted<EvmBalances>([...evmKey])?.data,
        initialDataUpdatedAt: () => readPersisted([...evmKey])?.updatedAt,
        queryFn: async (): Promise<EvmBalances> => {
            // A failed RPC call throws (not caught into 0) so react-query keeps
            // the previous balance instead of flashing 0 on a transient error.
            const evmCfg = getEvmConfig(isMainnet);
            const { JsonRpcProvider, Contract, formatUnits, formatEther } = await import('ethers');
            const provider = new JsonRpcProvider(evmCfg.rpc, evmCfg.chainId);
            const usdtContract = isMainnet ? USDT_BSC : USDT_SEPOLIA;
            const usdcContract = isMainnet ? USDC_BSC : USDC_SEPOLIA;
            const balanceOf = ['function balanceOf(address) view returns (uint256)'];

            const [nativeWei, usdtRaw, usdcRaw] = await Promise.all([
                provider.getBalance(evmAddress!),
                new Contract(usdtContract, balanceOf, provider).balanceOf(evmAddress!),
                new Contract(usdcContract, balanceOf, provider).balanceOf(evmAddress!),
            ]);

            return {
                native: Number(formatEther(nativeWei)),
                usdt: Number(formatUnits(usdtRaw, 6)),
                usdc: Number(formatUnits(usdcRaw, 6)),
            };
        },
    });

    // ── Solana ───────────────────────────────────────────────────────────────
    const solKey = ['sol-balances', solanaAddress ?? ''] as const;
    const solQuery = useQuery<SolBalances>({
        queryKey: solKey,
        enabled: !!solanaAddress,
        staleTime: 5_000,
        refetchInterval,
        placeholderData: keepPreviousData,
        initialData: () => readPersisted<SolBalances>([...solKey])?.data,
        initialDataUpdatedAt: () => readPersisted([...solKey])?.updatedAt,
        queryFn: async (): Promise<SolBalances> => {
            // A failed RPC call throws (not caught into 0) so react-query keeps
            // the previous balance instead of flashing 0 on a transient error.
            const owner = new PublicKey(solanaAddress!);
            const [lamports, parsed] = await Promise.all([
                solanaConnection.getBalance(owner),
                solanaConnection.getParsedTokenAccountsByOwner(owner, { programId: SOL_TOKEN_PROGRAM_ID }),
            ]);

            let usdc = 0;
            let usdt = 0;
            for (const account of parsed.value) {
                const info = account.account.data.parsed.info;
                const uiAmount = info.tokenAmount.uiAmount || 0;
                if (SOL_USDC_MINTS.includes(info.mint)) usdc += uiAmount;
                if (info.mint === SOL_USDT_MINT) usdt += uiAmount;
            }

            return { sol: lamports / 1e9, usdc, usdt };
        },
    });

    // ── Bitcoin (via WDK btc account) ─────────────────────────────────────────
    const btcKey = ['btc-balance', btcAddress ?? ''] as const;
    const btcQuery = useQuery<number>({
        queryKey: btcKey,
        enabled: !!btcAccount && !!btcAddress,
        staleTime: 5_000,
        refetchInterval,
        placeholderData: keepPreviousData,
        initialData: () => readPersisted<number>([...btcKey])?.data,
        initialDataUpdatedAt: () => readPersisted([...btcKey])?.updatedAt,
        queryFn: async (): Promise<number> => {
            // WDK btc account getBalance() returns bigint satoshis. Throwing on
            // failure keeps the previous balance instead of flashing 0.
            const sats = Number(await btcAccount.getBalance());
            if (!Number.isFinite(sats)) throw new Error('BTC getBalance returned a non-numeric value');
            return sats;
        },
    });

    // ── BCH (shared query) ────────────────────────────────────────────────────
    const bchQuery = useBchBalances(pollingMs > 0 ? pollingMs : undefined);

    // ── Cauldron CashToken metadata + USD prices (for held CashTokens) ────────
    const cauldronQuery = useQuery({
        queryKey: ['cauldron-tokens', isMainnet] as const,
        enabled: !!bchAddress,
        staleTime: 60_000,
        refetchInterval: refetchInterval ? Math.max(Number(refetchInterval), 60_000) : (false as const),
        placeholderData: keepPreviousData,
        queryFn: () => CauldronService.getTopCashTokens(50, isMainnet),
    });

    // ── Compose tokens ────────────────────────────────────────────────────────
    const tokens = useMemo<PortfolioToken[]>(() => {
        const list: PortfolioToken[] = [];
        const networkLabel = isMainnet ? 'BSC Mainnet' : 'Sepolia';

        // EVM
        if (evmAddress && evmQuery.data) {
            const nativeSymbol = isMainnet ? 'BNB' : 'ETH';
            const nativePrice = prices[nativeSymbol]?.price ?? 0;
            list.push({
                symbol: nativeSymbol,
                name: isMainnet ? `BNB (${networkLabel})` : `Ethereum (${networkLabel})`,
                chain: isMainnet ? 'BSC' : 'Ethereum',
                icon: isMainnet ? '/logos/bnb-bnb-logo.svg' : '/logos/ethereum-eth-logo.svg',
                balance: evmQuery.data.native,
                price: nativePrice,
                valueUsd: evmQuery.data.native * nativePrice,
                change24h: prices[nativeSymbol]?.change24h ?? 0,
            });

            if (evmQuery.data.usdt > 0) {
                const usdtPrice = prices['USDT']?.price || 1;
                list.push({
                    symbol: 'USDT',
                    name: `Tether USD (${networkLabel})`,
                    chain: isMainnet ? 'BSC' : 'Ethereum',
                    icon: '/logos/usdt-svgrepo-com.svg',
                    balance: evmQuery.data.usdt,
                    price: usdtPrice,
                    valueUsd: evmQuery.data.usdt * usdtPrice,
                    change24h: prices['USDT']?.change24h ?? 0,
                });
            }

            if (evmQuery.data.usdc > 0) {
                const usdcPrice = prices['USDC']?.price || 1;
                list.push({
                    symbol: 'USDC',
                    name: `USD Coin (${networkLabel})`,
                    chain: isMainnet ? 'BSC' : 'Ethereum',
                    icon: '/logos/usd-coin-usdc-logo.svg',
                    balance: evmQuery.data.usdc,
                    price: usdcPrice,
                    valueUsd: evmQuery.data.usdc * usdcPrice,
                    change24h: prices['USDC']?.change24h ?? 0,
                });
            }
        }

        // Solana
        if (solanaAddress && solQuery.data) {
            const solPrice = prices['SOL']?.price ?? 0;
            list.push({
                symbol: 'SOL',
                name: 'Solana',
                chain: 'Solana',
                icon: '/assets/solanaLogo.png',
                balance: solQuery.data.sol,
                price: solPrice,
                valueUsd: solQuery.data.sol * solPrice,
                change24h: prices['SOL']?.change24h ?? 0,
            });

            if (solQuery.data.usdc > 0) {
                const usdcPrice = prices['USDC']?.price || 1;
                list.push({
                    symbol: 'USDC',
                    name: 'USD Coin',
                    chain: 'Solana',
                    icon: '/logos/usd-coin-usdc-logo.svg',
                    balance: solQuery.data.usdc,
                    price: usdcPrice,
                    valueUsd: solQuery.data.usdc * usdcPrice,
                    change24h: prices['USDC']?.change24h ?? 0,
                });
            }

            if (solQuery.data.usdt > 0) {
                const usdtPrice = prices['USDT']?.price || 1;
                list.push({
                    symbol: 'USDT (SOL)',
                    name: 'Tether USD',
                    chain: 'Solana',
                    icon: '/logos/usdt-svgrepo-com.svg',
                    balance: solQuery.data.usdt,
                    price: usdtPrice,
                    valueUsd: solQuery.data.usdt * usdtPrice,
                    change24h: prices['USDT']?.change24h ?? 0,
                });
            }
        }

        // Bitcoin Cash
        if (bchAddress) {
            const bchPrice = prices['BCH']?.price ?? 0;
            const bchBalance = bchQuery.data.sats / 1e8;
            list.push({
                symbol: 'BCH',
                name: 'Bitcoin Cash',
                chain: 'Bitcoin Cash',
                icon: '/logos/bitcoin-cash-bch-logo.svg',
                balance: bchBalance,
                price: bchPrice,
                valueUsd: bchBalance * bchPrice,
                change24h: prices['BCH']?.change24h ?? 0,
            });

            // Held BCH CashTokens — Cauldron reports a ready USD price per whole
            // token (`price_now_usd`), so we use that directly. If it is ever
            // absent we fall back to converting the sats price (`price_now`,
            // satoshis per whole token) with the Pyth BCH rate.
            const cauldronRaw = cauldronQuery.data ?? [];
            const cauldronMapped = CauldronService.mapToTokens(cauldronRaw);
            const metaByCategory = new Map(cauldronMapped.map(m => [m.categoryId, m]));
            const rawByCategory = new Map(cauldronRaw.map(t => [t.token_id, t]));
            for (const [category, amountStr] of Object.entries(bchQuery.data.tokens)) {
                const meta = metaByCategory.get(category);
                const raw = rawByCategory.get(category);
                const decimals = meta?.decimals ?? 0;
                const balance = Number(amountStr) / Math.pow(10, decimals);
                if (!(balance > 0)) continue;

                let tokenPriceUsd = raw?.price_now_usd ?? 0;
                if (!(tokenPriceUsd > 0)) {
                    tokenPriceUsd = raw?.price_now ? (raw.price_now / 1e8) * bchPrice : 0;
                }

                list.push({
                    symbol: meta?.symbol ?? `${category.slice(0, 6)}…`,
                    name: meta?.name ?? 'CashToken',
                    chain: 'Bitcoin Cash',
                    icon: meta?.icon ?? `https://api.dicebear.com/7.x/identicon/svg?seed=${category}`,
                    balance,
                    price: tokenPriceUsd,
                    valueUsd: balance * tokenPriceUsd,
                    change24h: (raw?.change_24h_usd_bp ?? raw?.change_24h_bp ?? 0) / 100,
                    decimals,
                    category,
                });
            }
        }

        // Bitcoin
        if (btcAddress) {
            const btcPrice = prices['BTC']?.price ?? 0;
            const btcBalance = (btcQuery.data ?? 0) / 1e8;
            list.push({
                symbol: 'BTC',
                name: 'Bitcoin',
                chain: 'Bitcoin',
                icon: '/logos/bitcoin-btc-logo.svg',
                balance: btcBalance,
                price: btcPrice,
                valueUsd: btcBalance * btcPrice,
                change24h: prices['BTC']?.change24h ?? 0,
            });
        }

        list.sort((a, b) => b.valueUsd - a.valueUsd);
        return list;
    }, [evmAddress, solanaAddress, bchAddress, btcAddress, isMainnet, evmQuery.data, solQuery.data, bchQuery.data, btcQuery.data, cauldronQuery.data, prices]);

    // Total is the strict aggregate of the rendered token rows.
    const totalValue = useMemo(
        () => tokens.reduce((sum, t) => sum + t.valueUsd, 0),
        [tokens],
    );

    const chartData = useMemo(
        () => generateChartData(totalValue, chartAnchorRef.current),
        [totalValue],
    );

    const refetch = useCallback(() => {
        evmQuery.refetch();
        solQuery.refetch();
        bchQuery.refetch();
        btcQuery.refetch();
        cauldronQuery.refetch();
    }, [evmQuery.refetch, solQuery.refetch, bchQuery.refetch, btcQuery.refetch, cauldronQuery.refetch]);

    // Show the skeleton only while there is genuinely NOTHING to display. As
    // soon as any chain resolves a token, render what's ready rather than
    // blocking on the slowest chain (or on prices).
    const anyChainLoading =
        (!!evmAddress && evmQuery.isLoading) ||
        (!!solanaAddress && solQuery.isLoading) ||
        (!!bchAddress && bchQuery.isLoading) ||
        (!!btcAddress && btcQuery.isLoading) ||
        pricesLoading;
    const loading = tokens.length === 0 && anyChainLoading;

    const isRefetching =
        evmQuery.isFetching || solQuery.isFetching || bchQuery.isFetching || btcQuery.isFetching || pricesFetching;

    return {
        tokens,
        totalValue,
        chartData,
        loading,
        isRefetching,
        refetch,
        isConnected: wdkConnected,
    };
}
