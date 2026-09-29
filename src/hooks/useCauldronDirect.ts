/**
 * useCauldronDirect — hook to execute client-side direct Cauldron CPMM swaps
 * via the MeshServer `/api/v1/cauldron/build-trade` and `/api/v1/cauldron/record-swap` endpoints.
 */
import { useState, useCallback } from 'react';
import { BCH_MESH_SERVER_URL } from '@/lib/config';

export interface CauldronTradeParams {
  userAddress: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  slippageBps?: number;
  network?: 'chipnet' | 'mainnet';
}

export interface CauldronTradeBuildResult {
  success: boolean;
  route: string;
  network: string;
  poolAddress: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  expectedAmountOut: string;
  minAmountOut: string;
  effectivePrice: string;
  priceImpactBps: number;
  feeBps: number;
  protocolFeeSats: string;
  treasuryAddress: string;
  hops: string[];
}

export interface RecordCauldronSwapParams {
  txid: string;
  userAddress: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  protocolFeeSats?: string;
  priceImpactBps?: number;
  network?: 'chipnet' | 'mainnet';
}

export function useCauldronDirect() {
  const [isBuilding, setIsBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Request trade configuration & dual-payout rules from MeshServer.
   */
  const buildTrade = useCallback(async (params: CauldronTradeParams): Promise<CauldronTradeBuildResult | null> => {
    setIsBuilding(true);
    setError(null);
    try {
      const res = await fetch(`${BCH_MESH_SERVER_URL}/api/v1/cauldron/build-trade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(body?.error || `HTTP ${res.status}`);
      }

      const data: CauldronTradeBuildResult = await res.json();
      return data;
    } catch (err: any) {
      const msg = err?.message || 'Failed to build Cauldron trade';
      setError(msg);
      return null;
    } finally {
      setIsBuilding(false);
    }
  }, []);

  /**
   * Record swap for analytics and intent tracking.
   */
  const recordSwap = useCallback(async (params: RecordCauldronSwapParams): Promise<boolean> => {
    try {
      const res = await fetch(`${BCH_MESH_SERVER_URL}/api/v1/cauldron/record-swap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      return res.ok;
    } catch (err) {
      console.warn('[useCauldronDirect] Failed to record swap:', err);
      return false;
    }
  }, []);

  return {
    buildTrade,
    recordSwap,
    isBuilding,
    error,
  };
}
