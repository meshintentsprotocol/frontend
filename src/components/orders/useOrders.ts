/**
 * Every order of the active wallet, in one list: BCH orders (market, limit and
 * cross-chain), TWAP orders and the swap server's records.
 *
 * It only gathers. BCH orders come from BCHSwapContext (live over the relayer's
 * WebSocket), the swap server's rows from its provider, and TWAP orders are read
 * here, once for however many places show them.
 */

import { useCallback, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useBCHSwapOptional } from '@/context/BCHSwapContext';
import { useBCHWallet } from '@/context/BCHWalletProvider';
import { useWDK } from '@/context/WDKProvider';
import { useActiveWallet } from '@/hooks/useActiveWallet';
import { pkhOfAddress } from '@/hooks/useTWAP';
import { useTokenInfo } from '@/components/mesh/pools/shared';
import { BCH_MESH_SERVER_URL } from '@/lib/config';
import { localChain } from '@/swap-server/cctpChains';
import { useSwapServerOptional } from '@/swap-server/context';
import type { TwapOrderRecord } from '@/types';
import { fromActivity, fromBchOrder, fromTwapOrder, type AssetInfo, type OrderItem } from './model';

const BCH_ICON = '/logos/bitcoin-cash-bch-logo.svg';
const serverChain = (key: string) => (key === 'solana' ? 'solana' : localChain(key)?.tokenChain ?? null);

/** The TWAP orders of one address. Polls faster while one of them is still running. */
export function useTwapOrders(enabled = true) {
    const wdk = useWDK();
    const bchWallet = useBCHWallet();
    const { isMainActive, activeExtWallet } = useActiveWallet();
    const network = wdk.bchNetwork === 'mainnet' ? 'mainnet' : 'chipnet';
    const address = (isMainActive ? bchWallet?.address || wdk.bchAddress : activeExtWallet?.address) || '';
    const pkh = pkhOfAddress(address, network);

    return useQuery({
        queryKey: ['twap-orders', network, pkh],
        queryFn: async ({ signal }): Promise<TwapOrderRecord[]> => {
            const res = await fetch(`${BCH_MESH_SERVER_URL}/api/v1/twap/address/${pkh}`, { signal });
            if (!res.ok) throw new Error(`TWAP orders: HTTP ${res.status}`);
            const data = await res.json();
            return Array.isArray(data) ? data : [];
        },
        enabled: enabled && !!pkh,
        refetchInterval: q => (q.state.data?.some(o => o.status === 'RUNNING' || o.status === 'AWAITING_FUNDING') ? 5_000 : 30_000),
        staleTime: 3_000,
        retry: 1,
    });
}

export function useOrders() {
    const wdk = useWDK();
    const isMainnet = wdk.bchNetwork === 'mainnet';
    const swap = useBCHSwapOptional();
    const server = useSwapServerOptional();
    const twap = useTwapOrders();

    // The swap server fetches nothing until something asks to see its records.
    const activate = server?.activate;
    useEffect(() => { activate?.(); }, [activate]);

    const twapOrders = twap.data;
    const categories = useMemo(() => (twapOrders ?? []).flatMap(o => [o.tokenIn, o.tokenOut]), [twapOrders]);
    const tokens = useTokenInfo(categories);
    const asset = useCallback((category: string): AssetInfo => {
        if (category === '0x' || category === 'BCH') return { symbol: 'BCH', decimals: 8, icon: BCH_ICON };
        const t = tokens.get(category);
        return { symbol: t.symbol, decimals: t.decimals, icon: t.icon };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tokens.loading, categories]);

    const pending = swap?.pendingOrders;
    const completed = swap?.completedOrders;
    const rows = server?.rows;

    const items = useMemo<OrderItem[]>(() => [
        ...[...(pending ?? []), ...(completed ?? [])].map(o => fromBchOrder(o, { isMainnet })),
        ...(twapOrders ?? []).map(o => fromTwapOrder(o, asset)),
        ...(rows ?? []).map(r => fromActivity(r, serverChain)),
    ], [pending, completed, twapOrders, rows, isMainnet, asset]);

    const refreshBch = swap?.refreshOrders;
    const refreshServer = server?.refresh;
    const refetchTwap = twap.refetch;
    const refresh = useCallback(() => {
        void refreshBch?.();
        refreshServer?.();
        void refetchTwap();
    }, [refreshBch, refreshServer, refetchTwap]);

    return {
        items,
        asset,
        isMainnet,
        refresh,
        loading: !!swap?.isLoading || !!server?.rowsLoading || twap.isFetching,
        /** Set when the TWAP server could not be read; the other sources still show. */
        twapError: twap.error ? (twap.error as Error).message : undefined,
    };
}
