---
title: Orderbook
description: Aggregated Mesh depth for a pair, grouped into price levels.
status: ready
updated: 2026-09-28
sources: BCHMesh/meshserver/src/api/routes/orderbook.ts, MeshDocs/MeshServer/03-api-and-websocket-specification.md
---

```endpoint
{
  "method": "GET",
  "path": "/api/v1/orderbook",
  "summary": "Depth built from live strategy pools. Each level aggregates the pools quoting that price.",
  "params": [
    { "name": "pair", "in": "query", "type": "string", "required": true, "description": "Pair name, e.g. BCH-pUSD.", "example": "BCH-pUSD" },
    { "name": "depth", "in": "query", "type": "number", "description": "Number of levels per side. Default 20.", "example": 20 }
  ],
  "responses": [
    {
      "status": 200,
      "body": {
        "pair": "BCH-pUSD",
        "timestamp": 1790000000,
        "bids": [{ "price": "1994", "amountBch": "480060", "amountToken": "0", "utxoCount": 1, "utxoIds": ["0fcba1fc…:1"] }],
        "asks": [{ "price": "2222", "amountBch": "0", "amountToken": "9", "utxoCount": 1, "utxoIds": ["8d21…:0"] }],
        "spread": 228
      }
    },
    { "status": 400, "body": { "error": "`pair` query parameter is required. Example: ?pair=BCH-pUSD" } }
  ]
}
```

`GET /api/v1/orderbook/pairs` lists every pair with at least one live pool.

```screenshot
{ "src": "/docs/screenshots/orderbook.png", "url": "/orderbook", "caption": "The app's orderbook view is built from this endpoint and the orderbook:<pair> stream." }
```

For live depth changes, subscribe to `orderbook:<pair>` on the [WebSocket stream](api/websocket).
