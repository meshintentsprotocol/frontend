---
title: TWAP orders
description: Quote, submit and track TWAP orders made of Dutch-auction slices.
status: ready
updated: 2026-10-02
sources: BCHMesh/meshserver/src/api/routes/twap.ts, MeshDocs/BetaLaunch/03-v2-implementation-and-e2e-flows.md
---

```endpoint
{
  "method": "POST",
  "path": "/api/v1/twap/submit",
  "summary": "Creates numSlices DutchAuctionSwapV2 intents. Slice k starts at chain time start + k·intervalSec. Up to 48 slices.",
  "params": [
    { "name": "creatorAddress", "in": "body", "type": "string", "required": true, "description": "Maker cashaddr for payouts and refunds." },
    { "name": "tokenIn", "in": "body", "type": "string", "required": true, "description": "0x for BCH, or a category." },
    { "name": "tokenOut", "in": "body", "type": "string", "required": true, "description": "0x for BCH, or a category." },
    { "name": "totalAmountIn", "in": "body", "type": "string", "required": true, "description": "Split evenly across slices." },
    { "name": "numSlices", "in": "body", "type": "number", "description": "1–48. Default 4." },
    { "name": "intervalSec", "in": "body", "type": "number", "description": "Seconds between slice starts, ≥ 60. Default 600." },
    { "name": "minAmountOutPerSlice", "in": "body", "type": "string", "required": true, "description": "Each slice's endBuyAmount (price protection)." },
    { "name": "startAmountOutPerSlice", "in": "body", "type": "string", "description": "Each slice's startBuyAmount. Defaults to the minimum." },
    { "name": "sliceWindowSec", "in": "body", "type": "number", "description": "How long each slice stays fillable, in chain time. Default max(intervalSec, 3600); at least 1800 (400 otherwise), because chain time moves a block at a time." },
    { "name": "frontendPkh", "in": "body", "type": "string", "description": "Applied to every slice." },
    { "name": "userSurplusShareBps", "in": "body", "type": "number", "description": "Applied to every slice." }
  ],
  "body": {
    "creatorAddress": "bchtest:qr…",
    "tokenIn": "0x",
    "tokenOut": "<pUSD category>",
    "totalAmountIn": "400000",
    "numSlices": 4,
    "intervalSec": 600,
    "minAmountOutPerSlice": "48",
    "startAmountOutPerSlice": "52"
  },
  "responses": [
    {
      "status": 201,
      "description": "One funding entry per slice, in slice order. Fund them all in one transaction.",
      "body": {
        "orderId": "7c0e…",
        "status": "AWAITING_FUNDING",
        "creatorAddress": "bchtest:qr…",
        "tokenIn": "0x",
        "tokenOut": "<pUSD category>",
        "numSlices": 4,
        "slicesFilled": 0,
        "slicesRefunded": 0,
        "totalAmountIn": "400000",
        "slices": [{ "id": "…", "type": "dutch", "status": "awaiting_funding", "twapSliceIndex": 0 }],
        "intervalSec": 600,
        "sliceWindowSec": 3600,
        "funding": [{ "to": "bchtest:p…", "satoshis": "100000" }]
      }
    },
    { "status": 400, "body": { "error": "numSlices must be 1..48" } }
  ]
}
```

## Other endpoints

| Endpoint | Purpose |
| --- | --- |
| `POST /api/v1/twap/quote` | `{ tokenIn, tokenOut, totalAmountIn, numSlices?, intervalSec?, maxPricePerUnit? }` → per-slice estimate |
| `GET /api/v1/twap/:orderId` | Order summary with per-slice status |
| `GET /api/v1/twap/address/:address` | Orders for a maker |
| `GET /api/v1/twap/active` | All running orders |
| `POST /api/v1/twap/:orderId/cancel` | Returns the automatic refund schedule (no early exit) |

Order status is derived from the slices: `AWAITING_FUNDING`, `RUNNING`, `COMPLETED`, `PARTIALLY_FILLED` or `REFUNDED`.
