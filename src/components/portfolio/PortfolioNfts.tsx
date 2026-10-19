/**
 * Mesh NFTs view of the portfolio: the active BCH wallet's Mesh V4 pool positions.
 *
 * Shows Mesh pool NFTs only (decision D6), for built-in and external wallets alike.
 * Other CashToken NFTs/collectibles have been retired from this view.
 *
 * Phase 4: Portfolio
 */

import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Gem } from 'lucide-react';
import { useActiveAccounts } from '@/hooks/useActiveAccounts';
import { useWDK } from '@/context/WDKProvider';
import { tokenAddressOf } from '@/lib/mesh/signer';
import { useV4HeldMulti } from '@/hooks/useMeshV4';
import { MyV4Positions } from '@/components/mesh/v4/MyV4Positions';
import { addressSet as wizAddressSet } from '@/lib/wallets/wizardconnect';

export function PortfolioNfts() {
    const { bch } = useActiveAccounts();
    const { bchNetwork } = useWDK();
    const isMainnet = bchNetwork === 'mainnet';

    // Token-aware addresses of whichever BCH wallet is active (all HD addresses for WizardConnect)
    const holders = useMemo(() => {
        if (!bch?.address) return [];
        if (bch.source === 'wizardconnect' && bch.walletId) {
            const addrs = wizAddressSet(bch.walletId);
            return addrs.map(a => tokenAddressOf(a, isMainnet));
        }
        return [tokenAddressOf(bch.address, isMainnet)];
    }, [bch?.address, bch?.source, bch?.walletId, isMainnet]);

    const held = useV4HeldMulti(holders);
    const positions = held.data?.positions ?? [];
    const isLoading = held.isLoading;

    if (!holders.length) {
        return (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
                <Gem className="mx-auto h-6 w-6 text-zinc-600" />
                <p className="mt-2 text-sm text-zinc-400">Connect a BCH wallet to view your Mesh positions.</p>
            </div>
        );
    }

    if (!isLoading && !positions.length) {
        return (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
                <Gem className="mx-auto h-6 w-6 text-zinc-600" />
                <p className="mt-2 text-sm font-medium text-zinc-300">No Mesh positions in this wallet.</p>
                <p className="mt-1 text-xs text-zinc-500">Positions you create or receive show here.</p>
                <div className="mt-4">
                    <Link
                        to="/mesh"
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors"
                    >
                        Explore Mesh Pools →
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <MyV4Positions holder={holders} />
        </div>
    );
}
