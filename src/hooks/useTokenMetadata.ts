import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { BcmrClient, normalizeCategory, type TokenMetadata } from '@/lib/bcmr';
import { useWDK } from '@/context/WDKProvider';

const STALE_MS = 30 * 60 * 1000;

/** BCMR metadata for a single CashToken category on the active BCH network. */
export function useTokenMetadata(category: string | null | undefined) {
    const { bchNetwork } = useWDK();
    const isMainnet = bchNetwork === 'mainnet';
    const normalized = normalizeCategory(category);
    return useQuery<TokenMetadata | null>({
        queryKey: ['bcmr', bchNetwork, normalized],
        enabled: !!normalized,
        staleTime: STALE_MS,
        queryFn: () => BcmrClient.get(normalized as string, isMainnet),
    });
}

/** BCMR metadata for many categories, keyed by lowercase category. */
export function useTokenMetadataMany(categories: string[], isMainnet: boolean) {
    const normalized = [...new Set(categories.map(normalizeCategory).filter((c): c is string => !!c))].sort();
    return useQuery<Record<string, TokenMetadata | null>>({
        queryKey: ['bcmr-many', isMainnet ? 'mainnet' : 'chipnet', normalized.join(',')],
        enabled: normalized.length > 0,
        staleTime: STALE_MS,
        placeholderData: keepPreviousData,
        queryFn: () => BcmrClient.getMany(normalized, isMainnet),
    });
}
