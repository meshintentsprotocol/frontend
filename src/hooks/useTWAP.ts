import { useState, useCallback, useEffect } from 'react';
import type { TwapQuoteResponse, TwapOrderRecord } from '@/types';
import { useWDK } from '@/context/WDKProvider';
import { useBCHWallet } from '@/context/BCHWalletProvider';
import { BCH_MESH_SERVER_URL } from '@/lib/config';
import { toast } from 'sonner';

const MESH_API_URL = BCH_MESH_SERVER_URL;

export function useTWAP(pollIntervalMs: number = 5000) {
  const wdk = useWDK();
  const bchWallet = useBCHWallet();
  const [orders, setOrders] = useState<TwapOrderRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [currentQuote, setCurrentQuote] = useState<TwapQuoteResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const userAddress = bchWallet?.address || wdk?.bchAddress || '';

  // ── Fetch TWAP Quote ────────────────────────────────────────────────────────
  const fetchQuote = useCallback(async (params: {
    tokenIn: string;
    tokenOut: string;
    totalAmountIn: string;
    numSlices: number;
    intervalSec: number;
    maxPricePerUnit?: string;
  }): Promise<TwapQuoteResponse | null> => {
    setQuoteLoading(true);
    setError(null);
    try {
      const res = await fetch(`${MESH_API_URL}/api/v1/twap/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }
      const data: TwapQuoteResponse = await res.json();
      setCurrentQuote(data);
      return data;
    } catch (e: any) {
      console.error('[TWAP] Quote error:', e);
      setError(e.message || 'Failed to fetch TWAP quote');
      return null;
    } finally {
      setQuoteLoading(false);
    }
  }, []);

  // ── Submit TWAP Order ───────────────────────────────────────────────────────
  const submitOrder = useCallback(async (params: {
    creatorPkh: string;
    creatorAddress: string;
    side: 'BUY' | 'SELL';
    tokenIn: string;
    tokenOut: string;
    totalAmountIn: string;
    numSlices: number;
    intervalSec: number;
    maxPricePerUnit?: string;
    sliceFills?: any[];
  }): Promise<TwapOrderRecord | null> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${MESH_API_URL}/api/v1/twap/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }
      const data: TwapOrderRecord = await res.json();
      setOrders(prev => [data, ...prev.filter(o => o.orderId !== data.orderId)]);
      return data;
    } catch (e: any) {
      console.error('[TWAP] Submit error:', e);
      setError(e.message || 'Failed to submit TWAP order');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Fetch User Orders ───────────────────────────────────────────────────────
  const refreshOrders = useCallback(async () => {
    if (!userAddress) return;
    try {
      const res = await fetch(`${MESH_API_URL}/api/v1/twap/address/${encodeURIComponent(userAddress)}`);
      if (res.ok) {
        const data: TwapOrderRecord[] = await res.json();
        setOrders(data);
      }
    } catch (e: any) {
      console.error('[TWAP] Refresh error:', e);
    }
  }, [userAddress]);

  // ── Cancel Order ────────────────────────────────────────────────────────────
  const cancelOrder = useCallback(async (orderId: string): Promise<boolean> => {
    try {
      const res = await fetch(`${MESH_API_URL}/api/v1/twap/${encodeURIComponent(orderId)}/cancel`, {
        method: 'POST',
      });
      if (res.ok) {
        const updated: TwapOrderRecord = await res.json();
        setOrders(prev => prev.map(o => o.orderId === orderId ? updated : o));
        return true;
      }
      return false;
    } catch (e: any) {
      console.error('[TWAP] Cancel error:', e);
      return false;
    }
  }, []);

  // Poll for status updates on active orders
  useEffect(() => {
    refreshOrders();
    const interval = setInterval(refreshOrders, pollIntervalMs);
    return () => clearInterval(interval);
  }, [refreshOrders, pollIntervalMs]);

  // Real-time WebSocket event listener for slice fills & completion
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: any = null;

    const connectWs = () => {
      try {
        const wsUrl = `${MESH_API_URL.replace(/^http/, 'ws')}/ws`;
        ws = new WebSocket(wsUrl);

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'twap:slice_filled' && msg.data) {
              const d = msg.data;
              toast.success(`TWAP Slice #${d.sliceIndex + 1}/${d.numSlices} Filled!`, {
                description: d.txid && !d.txid.startsWith('sim_') ? `Tx: ${d.txid.slice(0, 12)}…` : 'Slice executed on-chain',
                action: d.explorerUrl ? {
                  label: 'View Tx',
                  onClick: () => window.open(d.explorerUrl, '_blank'),
                } : undefined,
                duration: 6000,
              });
              void refreshOrders();
            } else if (msg.type === 'twap:completed' && msg.data) {
              const d = msg.data;
              toast.success(`🎉 TWAP Order #${d.orderId.slice(0, 8)} Completed!`, {
                description: `All ${d.numSlices} slices successfully executed on-chain.`,
                duration: 8000,
              });
              void refreshOrders();
            }
          } catch {}
        };

        ws.onclose = () => {
          reconnectTimeout = setTimeout(connectWs, 5000);
        };
      } catch {
        reconnectTimeout = setTimeout(connectWs, 5000);
      }
    };

    connectWs();
    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [refreshOrders]);

  return {
    orders,
    loading,
    quoteLoading,
    currentQuote,
    error,
    fetchQuote,
    submitOrder,
    refreshOrders,
    cancelOrder,
  };
}
