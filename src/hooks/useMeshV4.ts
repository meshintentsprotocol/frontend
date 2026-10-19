/**
 * React Query hooks for Mesh V4 positions (NFT-owned bins).
 * Query keys live under ['mesh', …] so useInvalidateMesh() refreshes them too.
 */
import { useQuery } from '@tanstack/react-query';
import { meshApi } from '@/hooks/useMesh';
import { MeshApiError } from '@/lib/mesh/meshApi';

import type { V4PositionView } from '@/lib/mesh/v4/types';

/** Positions whose NFT this (token-aware) address holds, read from the chain by the server. */
export function useV4Held(holder: string | null | undefined) {
  return useQuery({
    queryKey: ['mesh', 'v4', 'held', holder ?? ''],
    queryFn: () => meshApi.v4Held(holder!),
    enabled: !!holder,
    refetchInterval: 20_000,
    // a server without the V4 routes answers 404: show nothing rather than an error
    retry: (n, e) => !(e instanceof MeshApiError && e.status === 404) && n < 2,
  });
}

/** Positions held across multiple token-aware addresses (e.g. for WizardConnect HD wallets). */
export function useV4HeldMulti(holders: string[] | null | undefined) {
  const list = holders?.filter(Boolean) ?? [];
  return useQuery({
    queryKey: ['mesh', 'v4', 'heldMulti', list.slice().sort().join(',')],
    queryFn: async () => {
      const results = await Promise.all(
        list.map(async h => {
          try {
            return (await meshApi.v4Held(h)).positions;
          } catch (e: any) {
            if (e instanceof MeshApiError && e.status === 404) return [];
            throw e;
          }
        })
      );
      const seen = new Set<string>();
      const combined: V4PositionView[] = [];
      for (const posList of results) {
        for (const p of posList) {
          if (!seen.has(p.category)) {
            seen.add(p.category);
            combined.push(p);
          }
        }
      }
      return { positions: combined };
    },
    enabled: list.length > 0,
    refetchInterval: 20_000,
    retry: (n, e) => !(e instanceof MeshApiError && e.status === 404) && n < 2,
  });
}

/** One position; with `holder`, the server also says whether that address holds the NFT. */
export function useV4Position(category: string | undefined, holder?: string | null) {
  return useQuery({
    queryKey: ['mesh', 'v4', 'position', category ?? '', holder ?? ''],
    queryFn: () => meshApi.v4Position(category!, holder ?? undefined),
    enabled: !!category,
    refetchInterval: 12_000,
    retry: (n, e) => !(e instanceof MeshApiError && e.status === 404) && n < 2,
  });
}

export function useV4Activity(category: string | undefined, limit = 100) {
  return useQuery({
    queryKey: ['mesh', 'v4', 'activity', category ?? '', limit],
    queryFn: () => meshApi.v4Activity(category!, limit),
    enabled: !!category,
    refetchInterval: 30_000,
    retry: (n, e) => !(e instanceof MeshApiError && e.status === 404) && n < 2,
  });
}
