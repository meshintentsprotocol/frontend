---
title: List intents
description: Query intents by maker, status and type, or fetch the open and completed sets.
status: ready
updated: 2026-09-28
sources: BCHMesh/meshserver/src/api/routes/intent.ts
---

```endpoint
{
  "method": "GET",
  "path": "/api/v1/intent",
  "summary": "All intents known to the server, filtered by any combination of query parameters.",
  "params": [
    { "name": "maker", "in": "query", "type": "string", "description": "Maker cashaddr or 20-byte pkh.", "example": "bchtest:qr…" },
    { "name": "status", "in": "query", "type": "string", "description": "Any status value, e.g. active, filled, refunded." },
    { "name": "type", "in": "query", "type": "string", "description": "limit or dutch." }
  ],
  "responses": [
    { "status": 200, "body": { "count": 1, "intents": [{ "id": "a3f1…", "type": "limit", "status": "active" }] } }
  ]
}
```

## Shortcuts

| Endpoint | Returns |
| --- | --- |
| `GET /api/v1/intent/active` | `{ count, intents }` for open intents the solver is working on |
| `GET /api/v1/intent/all` | `{ active, completed }`, where active covers `awaiting_funding`, `underfunded`, `active`, `scheduled`, `expired` and `refund_pending` |

For live updates, prefer the [WebSocket stream](api/websocket) over polling.
