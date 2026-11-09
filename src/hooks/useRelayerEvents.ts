/**
 * useRelayerEvents — live order updates from the CashToken relayer's WebSocket.
 *
 * The relayer has always broadcast `intent:*` events on /ws and nothing listened;
 * order status was polled at 15-30s instead. Since the relayer rework fills land in
 * 8-24s, so polling was the dominant source of perceived latency — the swap was
 * done long before the UI said so.
 *
 * This is deliberately *additive*: callers keep a slow poll as a safety net. A
 * dropped socket must degrade to "slightly stale" rather than "silently frozen",
 * which is the failure mode of replacing polling outright.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { CASHTOKEN_RELAYER_URL, CASHTOKEN_RELAYER_MAINNET_URL } from '@/lib/config';

/**
 * Event types. The Mesh server (meshserver src/intents/lifecycle.ts) sends the intent:*
 * events in the first two lines, each with the full intent view as `data`; the rest
 * are the older CashToken relayer's.
 */
export type RelayerEventType =
    | 'intent:created' | 'intent:funded' | 'intent:underfunded' | 'intent:unfillable' | 'intent:routable'
    | 'intent:filled' | 'intent:refund_pending' | 'intent:refund_failed' | 'intent:refunded' | 'intent:cancelled' | 'intent:closed'
    | 'intent:updated' | 'intent:failed' | 'intent:abandoned'
    | 'router:fill' | 'router:sniped' | 'router:paused' | 'router:resumed';

export interface RelayerEvent {
    type: RelayerEventType | string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any;
}

const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;

export interface UseRelayerEventsResult {
    /** True while the socket is open — surface this so "live" vs "polling" is visible. */
    connected: boolean;
    /** Timestamp of the last event received, for staleness display. */
    lastEventAt: number | null;
}

export function useRelayerEvents(opts: {
    network: 'mainnet' | 'chipnet';
    enabled?: boolean;
    onEvent: (event: RelayerEvent) => void;
}): UseRelayerEventsResult {
    const { network, enabled = true, onEvent } = opts;
    const [connected, setConnected] = useState(false);
    const [lastEventAt, setLastEventAt] = useState<number | null>(null);

    // Kept in a ref so a new callback identity does not tear down the socket —
    // onEvent is typically an inline closure and would otherwise reconnect on
    // every render.
    const onEventRef = useRef(onEvent);
    onEventRef.current = onEvent;

    const wsRef = useRef<WebSocket | null>(null);
    const retryRef = useRef(0);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const closedByUsRef = useRef(false);

    const connect = useCallback(() => {
        if (!enabled) return;
        const httpUrl = network === 'mainnet' ? CASHTOKEN_RELAYER_MAINNET_URL : CASHTOKEN_RELAYER_URL;
        const wsUrl = `${httpUrl.replace(/^http/, 'ws').replace(/\/$/, '')}/ws`;

        let ws: WebSocket;
        try {
            ws = new WebSocket(wsUrl);
        } catch {
            scheduleReconnect();
            return;
        }
        wsRef.current = ws;

        ws.onopen = () => {
            retryRef.current = 0;      // a successful connect resets the backoff
            setConnected(true);
        };

        ws.onmessage = (evt) => {
            try {
                const parsed = JSON.parse(String(evt.data));
                if (!parsed?.type) return;
                setLastEventAt(Date.now());
                onEventRef.current(parsed as RelayerEvent);
            } catch { /* ignore malformed frames */ }
        };

        ws.onerror = () => { /* onclose always follows; reconnect handled there */ };

        ws.onclose = () => {
            setConnected(false);
            wsRef.current = null;
            if (!closedByUsRef.current) scheduleReconnect();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [network, enabled]);

    const scheduleReconnect = useCallback(() => {
        if (closedByUsRef.current || !enabled) return;
        const attempt = retryRef.current++;
        // Capped exponential backoff with jitter, so a relayer restart does not get
        // hammered by every open tab at the same instant.
        const delay = Math.min(RECONNECT_BASE_MS * 2 ** attempt, RECONNECT_MAX_MS);
        const jittered = delay * (0.7 + Math.random() * 0.6);
        timerRef.current = setTimeout(() => connect(), jittered);
    }, [connect, enabled]);

    useEffect(() => {
        closedByUsRef.current = false;
        if (enabled) connect();
        return () => {
            closedByUsRef.current = true;
            if (timerRef.current) clearTimeout(timerRef.current);
            const ws = wsRef.current;
            wsRef.current = null;
            try { ws?.close(); } catch { /* already gone */ }
            setConnected(false);
        };
    }, [connect, enabled]);

    return { connected, lastEventAt };
}
