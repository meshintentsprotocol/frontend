/**
 * usePortfolio — composed, cached, multi-chain portfolio.
 *
 * Parallel balance queries (EVM / Solana / BCH / BTC / Movement) run independently,
 * so a slow chain never blocks the others. Prices come from a single shared
 * source (`usePrices`). The token list and `totalValue` are derived from the
 * exact same data, so the header total is always the strict aggregate of the
 * displayed token rows.
 *
 * Scope: 'main' (the default) is the built-in wallet on every chain — what
 * sending and cross-chain swaps spend from. 'active' follows the wallet chosen
 * in the header: the built-in wallet as above, or an external BCH wallet's
 * BCH and CashTokens only (it has no other chains).
 *
 * All queries share the app-wide QueryClient: the wallet popup, portfolio page
 * and send modal de-duplicate onto one set of requests and one cache.
 */

import { useMemo, useCallback, useRef, useEffect } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { useWDK } from '@/context/WDKProvider';
import { getEvmConfig, USDT_BSC, USDT_SEPOLIA, USDC_SEPOLIA, USDC_BSC } from '@/lib/intentHTLC';
import { usePrices } from '@/hooks/usePrices';
import { useBchBalances } from '@/hooks/useBchBalances';
import { CauldronService } from '@/lib/cauldron';
import { resolveTokenIconUri } from '@/lib/tokenIcons';
import { useTokenMetadataMany } from '@/hooks/useTokenMetadata';
import { readPersisted } from '@/lib/persist';
import { useSwapServerHoldings } from '@/swap-server/useHoldings';
import { useActiveWallet } from '@/hooks/useActiveWallet';
import { useActiveAccounts } from '@/hooks/useActiveAccounts';
import { useBchAddressBalance } from '@/hooks/useBchAddressBalance';
import { recordPortfolioPoint, getPortfolioHistory } from '@/lib/portfolioHistory';

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
    /** Set on rows read through the swap server: USDC on its cross-chain chains, Solana mainnet tokens. */
    swapServer?: boolean;
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

interface MovementBalances {
    move: number;
    usdc: number;
    usdt: number;
    weth: number;
}

const SOL_TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const SOL_USDC_MINTS = [
    '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU', // devnet
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // mainnet
];
const SOL_USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';

export function usePortfolio(options?: { pollingMs?: number; scope?: 'main' | 'active' }) {
    const pollingMs = options?.pollingMs ?? 0;
    const refetchInterval = pollingMs > 0 ? pollingMs : (false as const);

    const { connection: solanaConnection } = useConnection();
    const { evmAddress, solanaAddress, movementAddress, bchNetwork, isInitialized: wdkConnected, bchAddress, btcAddress, btcAccount } = useWDK();
    const isMainnet = bchNetwork === 'mainnet';

    // Active accounts per family (P4)
    const activeAccounts = useActiveAccounts();
    const useActive = options?.scope === 'active';

    const bchAccount = useActive ? activeAccounts.bch : undefined;
    const evmAccount = useActive ? activeAccounts.evm : undefined;
    const solanaAccount = useActive ? activeAccounts.solana : undefined;
    const btcAccountAcc = useActive ? activeAccounts.btc : undefined;

    const bchOwner = bchAccount?.address || bchAddress;
    const extBchActive = bchAccount && bchAccount.kind !== 'main';
    const extQuery = useBchAddressBalance({
        address: extBchActive ? bchAccount.address : null,
        isMainnet,
        refetchMs: pollingMs,
    });

    const currentEvmAddress = evmAccount?.address || evmAddress;
    const currentSolanaAddress = solanaAccount?.address || solanaAddress;
    const currentBtcAddress = btcAccountAcc?.address || btcAddress;

    const { prices, isLoading: pricesLoading, isFetching: pricesFetching } = usePrices();

    // ── EVM (Sepolia testnet / BSC mainnet) ──────────────────────────────────
    const evmKey = ['evm-balances', evmAddress ?? '', isMainnet] as const;
    const evmQuery = useQuery<EvmBalances>({
        queryKey: evmKey,
        enabled: !!evmAddress,
        staleTime: 5_000,
        refetchInterval,
        placeholderData: (prev, prevQuery) => (prevQuery?.queryKey[1] === (evmAddress ?? '') ? prev : undefined),
        initialData: () => readPersisted<EvmBalances>([...evmKey])?.data,
        initialDataUpdatedAt: () => readPersisted([...evmKey])?.updatedAt,
        queryFn: async (): Promise<EvmBalances> => {
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
        placeholderData: (prev, prevQuery) => (prevQuery?.queryKey[1] === (solanaAddress ?? '') ? prev : undefined),
        initialData: () => readPersisted<SolBalances>([...solKey])?.data,
        initialDataUpdatedAt: () => readPersisted([...solKey])?.updatedAt,
        queryFn: async (): Promise<SolBalances> => {
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

    // ── Movement (Porto / Bardock testnet) ──────────────────────────────────
    const movKey = ['movement-balances', movementAddress ?? ''] as const;
    const movementQuery = useQuery<MovementBalances>({
        queryKey: movKey,
        enabled: !!movementAddress,
        staleTime: 5_000,
        refetchInterval,
        placeholderData: (prev, prevQuery) => (prevQuery?.queryKey[1] === (movementAddress ?? '') ? prev : undefined),
        initialData: () => readPersisted<MovementBalances>([...movKey])?.data,
        initialDataUpdatedAt: () => readPersisted([...movKey])?.updatedAt,
        queryFn: async (): Promise<MovementBalances> => {
            const movRpcUrl = 'https://testnet.movementnetwork.xyz/v1';
            const res = await fetch(`${movRpcUrl}/accounts/${movementAddress}/resources`);
            if (!res.ok) {
                if (res.status === 404) return { move: 0, usdc: 0, usdt: 0, weth: 0 };
                throw new Error(`Movement RPC error: ${res.statusText}`);
            }
            const resources = await res.json();
            let moveBal = 0;
            let usdcBal = 0;
            let usdtBal = 0;
            let wethBal = 0;

            const USDC_MOVE_TYPE = '0x45142fb00dde90b950183d8ac2815597892f665c254c3f42b5768bc6ae4c8489';
            const USDT_MOVE_TYPE = '0xa663e903b11931807045423e25847425466a0c9777021464e104e845e1123963';
            const WETH_MOVE_TYPE = '0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::WETH';

            for (const r of resources) {
                const type = r.type || '';
                if (type.includes('CoinStore<0x1::aptos_coin::AptosCoin>')) {
                    moveBal = Number(r.data?.coin?.value || 0) / 1e8;
                } else if (type.includes(`CoinStore<${USDC_MOVE_TYPE}>`) || type.toLowerCase().includes('usdc')) {
                    usdcBal = Number(r.data?.coin?.value || 0) / 1e6;
                } else if (type.includes(`CoinStore<${USDT_MOVE_TYPE}>`) || type.toLowerCase().includes('usdt')) {
                    usdtBal = Number(r.data?.coin?.value || 0) / 1e6;
                } else if (type.includes(`CoinStore<${WETH_MOVE_TYPE}>`) || type.toLowerCase().includes('weth')) {
                    wethBal = Number(r.data?.coin?.value || 0) / 1e8;
                }
            }

            return { move: moveBal, usdc: usdcBal, usdt: usdtBal, weth: wethBal };
        },
    });

    // ── Bitcoin (via WDK btc account) ─────────────────────────────────────────
    const btcKey = ['btc-balance', btcAddress ?? ''] as const;
    const btcQuery = useQuery<number>({
        queryKey: btcKey,
        enabled: !!btcAccount && !!btcAddress,
        staleTime: 5_000,
        refetchInterval,
        placeholderData: (prev, prevQuery) => (prevQuery?.queryKey[1] === (btcAddress ?? '') ? prev : undefined),
        initialData: () => readPersisted<number>([...btcKey])?.data,
        initialDataUpdatedAt: () => readPersisted([...btcKey])?.updatedAt,
        queryFn: async (): Promise<number> => {
            const sats = Number(await btcAccount.getBalance());
            if (!Number.isFinite(sats)) throw new Error('BTC getBalance returned a non-numeric value');
            return sats;
        },
    });

    // ── BCH (shared query) ────────────────────────────────────────────────────
    const bchQuery = useBchBalances(pollingMs > 0 ? pollingMs : undefined);
    const bchHeld = extBchActive ? extQuery.data : bchQuery.data;

    // ── Cauldron CashToken metadata + USD prices (for held CashTokens) ────────
    const cauldronQuery = useQuery({
        queryKey: ['cauldron-tokens', isMainnet] as const,
        enabled: !!bchOwner,
        staleTime: 60_000,
        refetchInterval: refetchInterval ? Math.max(Number(refetchInterval), 60_000) : (false as const),
        placeholderData: keepPreviousData,
        queryFn: () => CauldronService.getTopCashTokens(50, isMainnet),
    });

    // ── BCMR metadata for held CashTokens Cauldron doesn't list ───────────────
    // Without it an unlisted token falls back to decimals=0 and its balance is
    // shown in raw base units (e.g. 10^8× too large for an 8-decimal token).
    const unlistedHeldCategories = useMemo(() => {
        const listed = new Set((cauldronQuery.data ?? []).map(t => t.token_id.toLowerCase()));
        return Object.keys(bchHeld.tokens ?? {}).filter(c => !listed.has(c.toLowerCase()));
    }, [cauldronQuery.data, bchHeld.tokens]);
    const bcmrQuery = useTokenMetadataMany(unlistedHeldCategories, isMainnet);

    // ── Compose tokens ────────────────────────────────────────────────────────
    // USDC on the swap server's chains and, in Mainnet mode, every Solana token the wallet holds.
    const swapServer = useSwapServerHoldings({
        evmAddress: currentEvmAddress, solanaAddress: currentSolanaAddress, isMainnet, refetchInterval,
        usdcPrice: prices['USDC']?.price || 1, usdcChange24h: prices['USDC']?.change24h,
    });
    const swapServerKey = JSON.stringify(swapServer.holdings);

    const tokens = useMemo<PortfolioToken[]>(() => {
        const list: PortfolioToken[] = [];
        const networkLabel = isMainnet ? 'BSC Mainnet' : 'Sepolia';

        // EVM
        if (currentEvmAddress && evmQuery.data) {
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
        if (currentSolanaAddress && solQuery.data) {
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

        // Movement
        if (movementAddress && movementQuery.data) {
            const movePrice = prices['MOVE']?.price || prices['APT']?.price || 0.5;
            list.push({
                symbol: 'MOVE',
                name: 'Movement',
                chain: 'Movement',
                icon: '/logos/movement.svg',
                balance: movementQuery.data.move,
                price: movePrice,
                valueUsd: movementQuery.data.move * movePrice,
                change24h: prices['MOVE']?.change24h ?? 0,
            });

            if (movementQuery.data.usdc > 0) {
                const usdcPrice = prices['USDC']?.price || 1;
                list.push({
                    symbol: 'USDC (MOVE)',
                    name: 'USD Coin (Movement)',
                    chain: 'Movement',
                    icon: '/logos/usd-coin-usdc-logo.svg',
                    balance: movementQuery.data.usdc,
                    price: usdcPrice,
                    valueUsd: movementQuery.data.usdc * usdcPrice,
                    change24h: prices['USDC']?.change24h ?? 0,
                });
            }

            if (movementQuery.data.usdt > 0) {
                const usdtPrice = prices['USDT']?.price || 1;
                list.push({
                    symbol: 'USDT (MOVE)',
                    name: 'Tether USD (Movement)',
                    chain: 'Movement',
                    icon: '/logos/usdt-svgrepo-com.svg',
                    balance: movementQuery.data.usdt,
                    price: usdtPrice,
                    valueUsd: movementQuery.data.usdt * usdtPrice,
                    change24h: prices['USDT']?.change24h ?? 0,
                });
            }

            if (movementQuery.data.weth > 0) {
                const ethPrice = prices['ETH']?.price || 2800;
                list.push({
                    symbol: 'WETH (MOVE)',
                    name: 'Wrapped Ether (Movement)',
                    chain: 'Movement',
                    icon: '/logos/ethereum-eth-logo.svg',
                    balance: movementQuery.data.weth,
                    price: ethPrice,
                    valueUsd: movementQuery.data.weth * ethPrice,
                    change24h: prices['ETH']?.change24h ?? 0,
                });
            }
        }

        // Bitcoin Cash
        if (bchOwner) {
            const bchPrice = prices['BCH']?.price ?? 0;
            const bchBalance = bchHeld.sats / 1e8;
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

            const cauldronRaw = cauldronQuery.data ?? [];
            const cauldronMapped = CauldronService.mapToTokens(cauldronRaw);
            const metaByCategory = new Map(cauldronMapped.map(m => [m.categoryId, m]));
            const rawByCategory = new Map(cauldronRaw.map(t => [t.token_id, t]));
            const bcmrByCategory = bcmrQuery.data ?? {};
            for (const [category, amountStr] of Object.entries(bchHeld.tokens)) {
                const bcmr = bcmrByCategory[category.toLowerCase()];
                const meta = metaByCategory.get(category) ?? (bcmr ? {
                    symbol: bcmr.symbol,
                    name: bcmr.name,
                    decimals: bcmr.decimals,
                    icon: resolveTokenIconUri(bcmr.icon, category),
                } : undefined);
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
        if (currentBtcAddress) {
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

        for (const h of JSON.parse(swapServerKey) as PortfolioToken[]) {
            if (!list.some(t => t.chain === h.chain && t.symbol === h.symbol)) list.push({ ...h, swapServer: true });
        }

        list.sort((a, b) => b.valueUsd - a.valueUsd);
        return list;
    }, [swapServerKey, currentEvmAddress, currentSolanaAddress, movementAddress, bchOwner, bchHeld, currentBtcAddress, isMainnet, evmQuery.data, solQuery.data, movementQuery.data, btcQuery.data, cauldronQuery.data, bcmrQuery.data, prices]);

    // Total is the strict aggregate of the rendered token rows.
    const totalValue = useMemo(
        () => tokens.reduce((sum, t) => sum + t.valueUsd, 0),
        [tokens],
    );

    // Value-weighted 24h change (P4)
    const change24h = useMemo(() => {
        let totalVal = 0;
        let weightedSum = 0;
        for (const t of tokens) {
            if (t.valueUsd > 0 && typeof t.change24h === 'number') {
                totalVal += t.valueUsd;
                weightedSum += t.valueUsd * t.change24h;
            }
        }
        return totalVal > 0 ? weightedSum / totalVal : undefined;
    }, [tokens]);

    // Active addresses set for real hourly portfolio snapshots
    const activeAddresses = useMemo(() => {
        const addrs: string[] = [];
        if (bchOwner) addrs.push(bchOwner);
        if (currentEvmAddress) addrs.push(currentEvmAddress);
        if (currentSolanaAddress) addrs.push(currentSolanaAddress);
        if (currentBtcAddress) addrs.push(currentBtcAddress);
        return addrs;
    }, [bchOwner, currentEvmAddress, currentSolanaAddress, currentBtcAddress]);

    const activeAddressesKey = activeAddresses.join(';');

    useEffect(() => {
        if (totalValue > 0 && activeAddresses.length > 0) {
            recordPortfolioPoint(bchNetwork, activeAddresses, totalValue);
        }
    }, [bchNetwork, activeAddressesKey, totalValue]);

    const history = useMemo(() => {
        return getPortfolioHistory(bchNetwork, activeAddresses);
    }, [bchNetwork, activeAddressesKey, totalValue]);

    const chartData = useMemo(() => {
        return history.map(p => ({
            time: new Date(p.t).toISOString(),
            value: p.totalUsd,
        }));
    }, [history]);

    const refetch = useCallback(() => {
        evmQuery.refetch();
        solQuery.refetch();
        movementQuery.refetch();
        bchQuery.refetch();
        extQuery.refetch();
        btcQuery.refetch();
        cauldronQuery.refetch();
        swapServer.refetch();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [evmQuery.refetch, solQuery.refetch, movementQuery.refetch, bchQuery.refetch, extQuery.refetch, btcQuery.refetch, cauldronQuery.refetch]);

    const anyChainLoading = extBchActive ? (extQuery.isLoading || pricesLoading) :
        (!!currentEvmAddress && evmQuery.isLoading) ||
        (!!currentSolanaAddress && solQuery.isLoading) ||
        (!!movementAddress && movementQuery.isLoading) ||
        (!!bchOwner && bchQuery.isLoading) ||
        (!!currentBtcAddress && btcQuery.isLoading) ||
        pricesLoading;
    const loading = tokens.length === 0 && anyChainLoading;

    const isRefetching =
        extBchActive ? (extQuery.isFetching || pricesFetching) :
        evmQuery.isFetching || solQuery.isFetching || movementQuery.isFetching || bchQuery.isFetching || btcQuery.isFetching || pricesFetching;

    return {
        tokens,
        totalValue,
        change24h,
        chartData,
        history,
        loading,
        isRefetching,
        refetch,
        isConnected: wdkConnected || !!extBchActive,
    };
}
