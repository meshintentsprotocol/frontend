import { useState, useCallback, useEffect } from 'react';
import { cashAddressToLockingBytecode, binToHex } from '@bitauth/libauth';
import type { TwapOrderRecord } from '@/types';
import { useWDK } from '@/context/WDKProvider';
import { useBCHWallet } from '@/context/BCHWalletProvider';
import { useFundCovenants } from '@/hooks/useFundCovenants';
import { useActiveWallet } from '@/hooks/useActiveWallet';
import { BCH_MESH_SERVER_URL } from '@/lib/config';

const MESH_API_URL = BCH_MESH_SERVER_URL;

/** 20-byte hex pkh of a P2PKH cashaddr (with or without prefix), or '' */
export function pkhOfAddress(address: string, network: 'mainnet' | 'chipnet' = 'chipnet'): string {
  if (!address) return '';
  if (/^[0-9a-fA-F]{40}$/.test(address)) return address.toLowerCase();
  const full = address.includes(':') ? address : `${network === 'mainnet' ? 'bitcoincash' : 'bchtest'}:${address}`;
  const r = cashAddressToLockingBytecode(full);
  if (typeof r === 'string' || r.bytecode.length !== 25) return '';
  return binToHex(r.bytecode.slice(3, 23));
}

/** Executable quote for one slice (same fill planner the solver uses). */
export interface SliceQuote {
  buyAmount: string;
  routeName?: string;
  executionMode?: string;
}

export interface TwapSubmitParams {
  creatorAddress: string;
  creatorPkh: string;
  tokenIn: string;            // '0x' or 64-hex category
  tokenOut: string;
  totalAmountIn: string;      // sats / token base units
  numSlices: number;
  intervalSec: number;
  startAmountOutPerSlice: string;
  minAmountOutPerSlice: string;
}

export function useTWAP(pollIntervalMs: number = 5000) {
  const wdk = useWDK();
  const bchWallet = useBCHWallet();
  const fund = useFundCovenants();
  const [orders, setOrders] = useState<TwapOrderRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { isMainActive, activeExtWallet } = useActiveWallet();
  const network = wdk?.bchNetwork === 'mainnet' ? 'mainnet' : 'chipnet';
  const userAddress = (isMainActive ? bchWallet?.address || wdk?.bchAddress : activeExtWallet?.address) || '';
  const userPkh = pkhOfAddress(userAddress, network);

  // ── Quote one slice ────────────────────────────────────────────────────────
  const quoteSlice = useCallback(async (tokenIn: string, tokenOut: string, sliceAmountIn: string): Promise<SliceQuote> => {
    const res = await fetch(`${MESH_API_URL}/router/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sellToken: tokenIn === '0x' ? 'BCH' : tokenIn,
        buyToken: tokenOut === '0x' ? 'BCH' : tokenOut,
        sellAmount: sliceAmountIn,
        network,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.buyAmount || data.buyAmount === '0') throw new Error(data.reason || data.error || `no route (HTTP ${res.status})`);
    return { buyAmount: String(data.buyAmount), routeName: data.routeName, executionMode: data.executionMode };
  }, [network]);

  // ── Fetch the user's orders ────────────────────────────────────────────────
  const refreshOrders = useCallback(async () => {
    if (!userPkh) return;
    try {
      const res = await fetch(`${MESH_API_URL}/api/v1/twap/address/${userPkh}`);
      if (res.ok) setOrders(await res.json());
    } catch (e: any) {
      console.error('[TWAP] Refresh error:', e);
    }
  }, [userPkh]);

  // ── Submit and fund ────────────────────────────────────────────────────────
  /**
   * Creates the slice intents on the server, then funds all of them in one
   * transaction. Returns the order and the funding txid; slices that are never
   * funded simply never start.
   */
  const submitOrder = useCallback(async (params: TwapSubmitParams): Promise<{ order: TwapOrderRecord; fundingTxid: string } | null> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${MESH_API_URL}/api/v1/twap/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      const order = data as TwapOrderRecord;
      if (!order.funding?.length) throw new Error('server returned no funding outputs');
      const fundingTxid = await fund(order.funding, `Fund ${order.numSlices} TWAP slices`);
      await refreshOrders();
      return { order, fundingTxid };
    } catch (e: any) {
      console.error('[TWAP] Submit error:', e);
      setError(e.message || 'Failed to submit TWAP order');
      return null;
    } finally {
      setLoading(false);
    }
  }, [fund, refreshOrders]);

  // Poll for slice status (filled / refunded) on chain
  useEffect(() => {
    void refreshOrders();
    const interval = setInterval(refreshOrders, pollIntervalMs);
    return () => clearInterval(interval);
  }, [refreshOrders, pollIntervalMs]);

  return { orders, loading, error, quoteSlice, submitOrder, refreshOrders };
}
