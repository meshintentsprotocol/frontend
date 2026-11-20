import { useTokenMetadataMany } from '@/hooks/useTokenMetadata';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Token } from '@/types';
import { CauldronService } from '@/lib/cauldron';
import { mergeTokenCatalog, tokensInMode } from '@/swap-server/tokens';

/** One network-keyed CashToken request shared by the card and every selector. */
export function useTokenCatalog(base: Token[], isMainnet: boolean, enabled = true) {
    const query = useQuery({
        queryKey: ['cash-token-catalog', isMainnet ? 'mainnet' : 'chipnet'],
        enabled,
        queryFn: async () => {
            const raw = await CauldronService.getTopCashTokens(50, isMainnet);
            return { raw,
                pending: raw.some(t => t.metadata_source === 'cauldron-listing') };
        },
        staleTime: 30_000,
        // Let background BCMR lookups finish, with at most two rapid follow-up requests.
        refetchInterval: q => q.state.data?.pending && q.state.dataUpdateCount < 3 ? 5000 : 30_000,
    });
    const categories = enabled ? query.data?.raw.map(t => t.token_id) ?? [] : [];
    const metadata = useTokenMetadataMany(categories, isMainnet);
    const cashTokens = useMemo(() => (query.data?.raw ?? []).map(t => CauldronService.applyMetadata(t, metadata.data?.[t.token_id])), [query.data, metadata.data]);
    const tokens = useMemo(() => {
        const dynamic = CauldronService.mapToTokens(cashTokens).map(t => ({ ...t, network: isMainnet ? 'mainnet' as const : 'testnet' as const }));
        return mergeTokenCatalog(tokensInMode(base, isMainnet), enabled ? dynamic : []);
    }, [base, isMainnet, enabled, cashTokens]);
    return { tokens, cashTokens, loading: enabled && query.isLoading, error: query.isError };
}
