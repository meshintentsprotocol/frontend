/**
 * useMeshQuote — debounced, reactive quote hook for the BCHMesh server.
 *
 * Calls `POST /api/v1/quote` whenever tokenIn/tokenOut/amountIn changes
 * (with a 350 ms debounce). The raw routing split (meshPct/cauldronPct) is
 * kept in the internal state but is intentionally NOT exposed in the public
 * return type — users only see the final output amount and fee, not how the
 * trade was decomposed internally.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { BCH_MESH_SERVER_URL } from '@/lib/config';

// ── Types (shape returned by POST /api/v1/quote) ─────────────────────────────

/** Public quote result — no internal routing split exposed. */
export interface MeshQuoteResult {
  /** Amount out in smallest token units (bigint-as-string). */
  amountOut: string;
  /** Effective price ratio (amountIn / amountOut × 10^7). */
  effectivePrice: string;
  /** Pool/strategy fee in basis points. */
  feeBps: number;
  /** Estimated transaction size in bytes. */
  estimatedTxBytes: number;
  /** Estimated miner fee in sats (string). */
  estimatedFeeSats: string;
  /** Unix seconds until this quote expires. */
  validUntil: number;
  /** Human-readable route type for logging/debug (not shown in swap UI). */
  routeType: string;
  /** True when a fill route exists with positive output. */
  fillable: boolean;
}

export interface UseMeshQuoteReturn {
  quote: MeshQuoteResult | null;
  loading: boolean;
  error: string | null;
  /** Call to bypass debounce and re-fetch immediately. */
  refresh: () => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DEBOUNCE_MS = 350;

// ── Internal full response shape (server side) ────────────────────────────────

interface _ServerQuoteResponse {
  tokenIn:           string;
  tokenOut:          string;
  amountIn:          string;
  amountOut:         string;
  effectivePrice:    string;
  feeBps:            number;
  route:             unknown[];
  estimatedTxBytes:  number;
  estimatedFeeSats:  string;
  validUntil:        number;
  /** Internal split — not exposed in the public API of this hook. */
  meshPct?:          number;
  cauldronPct?:      number;
  routeReason?:      string;
  routeType?:        string;
  fillable?:         boolean;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useMeshQuote(opts: {
  tokenIn:   string | null | undefined;
  tokenOut:  string | null | undefined;
  /** Amount in smallest units (sats for BCH, token-units otherwise). Pass '' or 0 to skip. */
  amountIn:  string | number | null | undefined;
  enabled?:  boolean;
}): UseMeshQuoteReturn {
  const { tokenIn, tokenOut, amountIn, enabled = true } = opts;

  const [quote, setQuote]     = useState<MeshQuoteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef    = useRef<AbortController | null>(null);
  const fetchSeqRef = useRef(0); // monotonic counter to discard stale responses

  const doFetch = useCallback(async () => {
    if (!enabled || !tokenIn || !tokenOut) {
      setQuote(null);
      setLoading(false);
      return;
    }

    const amtStr = String(amountIn ?? '').trim();
    if (!amtStr || amtStr === '0') {
      setQuote(null);
      setLoading(false);
      return;
    }

    // Cancel previous in-flight request
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const seq = ++fetchSeqRef.current;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${BCH_MESH_SERVER_URL}/api/v1/quote`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ tokenIn, tokenOut, amountIn: amtStr }),
        signal:  ctrl.signal,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }

      const data: _ServerQuoteResponse = await res.json();

      // Discard if a newer fetch has already landed
      if (seq !== fetchSeqRef.current) return;

      const amtOut = BigInt(data.amountOut ?? '0');

      setQuote({
        amountOut:        data.amountOut,
        effectivePrice:   data.effectivePrice,
        feeBps:           data.feeBps,
        estimatedTxBytes: data.estimatedTxBytes,
        estimatedFeeSats: data.estimatedFeeSats,
        validUntil:       data.validUntil,
        // Derive routeType from internal fields but keep it debug-only
        routeType: data.routeType
          ?? (data.meshPct === 100 ? 'MESH' : data.cauldronPct === 100 ? 'CAULDRON' : 'HYBRID'),
        fillable: data.fillable !== false && amtOut > 0n,
      });
    } catch (err: unknown) {
      if ((err as Error)?.name === 'AbortError') return;
      if (seq !== fetchSeqRef.current) return;
      const msg = (err as Error)?.message ?? 'Quote failed';
      setError(msg);
      setQuote(null);
    } finally {
      if (seq === fetchSeqRef.current) setLoading(false);
    }
  }, [enabled, tokenIn, tokenOut, amountIn]);

  // Debounced trigger on input changes
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { void doFetch(); }, DEBOUNCE_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [doFetch]);

  // Cleanup on unmount
  useEffect(() => () => { abortRef.current?.abort(); }, []);

  return { quote, loading, error, refresh: doFetch };
}
