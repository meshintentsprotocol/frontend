import { useState, useEffect, useCallback } from 'react';

const MESH_BASE = import.meta.env.VITE_MESH_SERVER_URL ?? 'https://bchmesh-production.up.railway.app';

export interface PoolFillItem {
  id: string;
  txid: string;
  timestamp: number;
  type: 'SWAP_FILL' | 'DOCK' | 'TOP_UP' | 'DEPLOY';
  tokenInSymbol: string;
  tokenInAmount: string;
  tokenOutSymbol: string;
  tokenOutAmount: string;
  feeSats: string;
  feeUsd?: string;
  explorerUrl: string;
  raw?: any;
}

export interface PoolFillsSummary {
  fills: PoolFillItem[];
  totalFills: number;
  totalBchVolume: number;
  totalTokenVolume: number;
  totalFeesEarnedSats: number;
  totalFeesEarnedBch: number;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function usePoolFills(
  address?: string,
  txid?: string,
  tokenCategoryOut?: string,
  pollIntervalMs = 15_000
): PoolFillsSummary {
  const [fills, setFills] = useState<PoolFillItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFills = useCallback(async () => {
    if (!address && !txid) {
      setFills([]);
      setLoading(false);
      return;
    }

    try {
      const items: PoolFillItem[] = [];

      // 1. Try fetching indexed fills from MeshServer
      if (txid || address) {
        try {
          const endpoint = txid
            ? `${MESH_BASE}/api/v1/positions/${txid}/fills`
            : `${MESH_BASE}/api/v1/positions/address/${address}/fills`;

          const res = await fetch(endpoint);
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data.fills) && data.fills.length > 0) {
              for (const f of data.fills) {
                items.push({
                  id: f.id || `${f.fillTxid}:${f.strategyTxid}`,
                  txid: f.fillTxid || f.strategyTxid,
                  timestamp: f.timestamp || Date.now(),
                  type: 'SWAP_FILL',
                  tokenInSymbol: f.tokenCategoryIn === '0x' ? 'BCH' : 'pUSD',
                  tokenInAmount: f.tokenAmountIn || '0',
                  tokenOutSymbol: f.tokenCategoryOut === '0x' ? 'BCH' : 'pUSD',
                  tokenOutAmount: f.tokenAmountOut || '0',
                  feeSats: f.feeSats || '0',
                  explorerUrl: `https://chipnet.chaingraph.cash/tx/${f.fillTxid}`,
                  raw: f,
                });
              }
            }
          }
        } catch {
          // ignore meshserver network errors
        }
      }

      // 2. Fetch server-side aggregate fills if available
      if (txid || address) {
        try {
          const fillsEndpoint = `${MESH_BASE}/api/v1/admin/mesh-pools`;
          const res = await fetch(fillsEndpoint);
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data.pools)) {
              for (const pool of data.pools) {
                if (pool.address === address || pool.txid === txid) {
                  if (Array.isArray(pool.fills)) {
                    for (const f of pool.fills) {
                      if (items.some(i => i.txid === (f.fillTxid || f.txid))) continue;
                      items.push({
                        id: f.id || `${f.fillTxid}:${f.strategyTxid}`,
                        txid: f.fillTxid || f.txid || f.strategyTxid,
                        timestamp: f.timestamp || Date.now(),
                        type: 'SWAP_FILL',
                        tokenInSymbol: f.tokenCategoryIn === '0x' ? 'BCH' : 'pUSD',
                        tokenInAmount: f.tokenAmountIn || '0',
                        tokenOutSymbol: f.tokenCategoryOut === '0x' ? 'BCH' : 'pUSD',
                        tokenOutAmount: f.tokenAmountOut || '0',
                        feeSats: f.feeSats || '1000',
                        explorerUrl: `https://chipnet.chaingraph.cash/tx/${f.fillTxid || f.txid}`,
                        raw: f,
                      });
                    }
                  }
                }
              }
            }
          }
        } catch {
          // ignore
        }
      }

      // Sort by timestamp desc
      items.sort((a, b) => b.timestamp - a.timestamp);
      setFills(items);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch fills');
    } finally {
      setLoading(false);
    }
  }, [address, txid, tokenCategoryOut]);

  useEffect(() => {
    void fetchFills();
    if (pollIntervalMs <= 0) return;
    const interval = setInterval(fetchFills, pollIntervalMs);
    return () => clearInterval(interval);
  }, [fetchFills, pollIntervalMs]);

  // Aggregate statistics
  const totalFills = fills.filter(f => f.type === 'SWAP_FILL').length;
  const totalBchVolume = fills.reduce((acc, f) => acc + (parseFloat(f.tokenInAmount) || 0), 0);
  const totalTokenVolume = fills.reduce((acc, f) => acc + (parseFloat(f.tokenOutAmount) || 0), 0);
  const totalFeesEarnedSats = fills.reduce((acc, f) => acc + (parseInt(f.feeSats, 10) || 0), 0);
  const totalFeesEarnedBch = totalFeesEarnedSats / 1e8;

  return {
    fills,
    totalFills,
    totalBchVolume,
    totalTokenVolume,
    totalFeesEarnedSats,
    totalFeesEarnedBch,
    loading,
    error,
    refresh: fetchFills,
  };
}
