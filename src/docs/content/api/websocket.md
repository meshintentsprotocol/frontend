---
title: WebSocket stream
description: One socket for intent lifecycle events, pool fills and orderbook changes.
status: ready
updated: 2026-09-28
sources: BCHMesh/meshserver/src/websocket/server.ts, BCHMesh/meshserver/src/intents/lifecycle.ts
---

```text
ws(s)://<host>/ws          (aliases: /ws/, /ws/v1/liquidity-stream, /)
```

On connect the server sends:

```json
{ "type": "connected", "message": "BCHMesh unified stream ready" }
```

## Intent events (broadcast to everyone)

Every intent status change is pushed to all clients as `{ type, data }`, where `data` is the full [intent view](api/intents/get) plus event-specific fields and a `timestamp`.

| `type` | Extra fields in `data` |
| --- | --- |
| `intent:created` | — |
| `intent:funded` | — |
| `intent:unfillable` | `reason`, `refundEligibleAt` |
| `intent:filled` | `external: true` when filled by someone else |
| `intent:refund_pending` | `reason` |
| `intent:refund_failed` | `error` |
| `intent:refunded` | `trigger` |
| `intent:cancelled` | — |
| `intent:closed` | `external: true` |

## Channels (subscribe first)

```json
{ "type": "subscribe", "channel": "fills" }
{ "type": "subscribe", "channel": "orderbook:BCH-pUSD" }
{ "type": "unsubscribe", "channel": "fills" }
{ "type": "ping" }
```

| Channel | Payload |
| --- | --- |
| `fills` | `{ type: "fill", channel: "fills", … }` for every pool fill |
| `orderbook:<pair>` | `{ channel, type: SHIP \| FILL \| DOCK \| SNAPSHOT, pair, utxoId, level?, timestamp }` |

## Example

```typescript title="stream.ts"
const ws = new WebSocket(`${MESH_WS_URL}/ws`);

ws.onopen = () => ws.send(JSON.stringify({ type: 'subscribe', channel: 'fills' }));

ws.onmessage = (msg) => {
  const e = JSON.parse(msg.data);
  if (e.type === 'intent:filled') showFilled(e.data.id, e.data.fillTxid);
  if (e.type === 'fill') bumpVolume(e);
};

// keep-alive
setInterval(() => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ type: 'ping' })), 30_000);
```

> [!TIP]
> The stream has no replay. On reconnect, re-fetch the intents you care about with `GET /intent/:id` before trusting new events.
