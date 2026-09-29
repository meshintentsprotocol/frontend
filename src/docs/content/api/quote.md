---
title: Get a quote
description: Price a swap across Mesh pools and Cauldron, with the route and the Mesh / Cauldron split.
status: ready
updated: 2026-09-28
sources: BCHMesh/meshserver/src/api/routes/quote.ts, BCHMesh/meshserver/src/router/routeFinder.ts, BCHMesh/meshserver/src/types/orderbook.ts
---

```endpoint
{
  "method": "POST",
  "path": "/api/v1/quote",
  "summary": "Finds the best route for amountIn of tokenIn into tokenOut across Mesh strategy pools and Cauldron pools. Mesh pools are priced with the exact covenant formula.",
  "params": [
    { "name": "tokenIn", "in": "body", "type": "string", "required": true, "description": "Category id, or 0x for BCH." },
    { "name": "tokenOut", "in": "body", "type": "string", "required": true, "description": "Category id, or 0x for BCH." },
    { "name": "amountIn", "in": "body", "type": "string", "required": true, "description": "Positive integer in base units of tokenIn." },
    { "name": "minAmountOut", "in": "body", "type": "string", "description": "Optional floor; routes below it are ignored." }
  ],
  "body": { "tokenIn": "<pUSD category>", "tokenOut": "0x", "amountIn": "10" },
  "responses": [
    {
      "status": 200,
      "description": "Best route found.",
      "body": {
        "tokenIn": "<pUSD category>",
        "tokenOut": "0x",
        "amountIn": "10",
        "amountOut": "19940",
        "effectivePrice": "1994",
        "feeBps": 0,
        "route": [{ "type": "MESH_UTXO", "txid": "0fcba1fc…", "vout": 1, "fillAmount": "10" }],
        "estimatedTxBytes": 462,
        "estimatedFeeSats": "462",
        "validUntil": 1790000000,
        "meshPct": 100,
        "cauldronPct": 0,
        "routeReason": "Pure Mesh"
      }
    },
    { "status": 400, "body": { "error": "Required fields: tokenIn, tokenOut, amountIn" } },
    { "status": 404, "description": "No venue can fill this pair and size right now.", "body": { "error": "No route found for the requested pair and amount" } }
  ]
}
```

## Response fields

| Field | Meaning |
| --- | --- |
| `amountOut` | What the route pays out, in base units of `tokenOut` |
| `route[]` | Hops: `MESH_UTXO` (with `txid`/`vout`) or `CAULDRON_POOL` (with `poolId`), each with `fillAmount` |
| `meshPct` / `cauldronPct` | How the input splits between venues |
| `routeReason` | Human-readable explanation of the split |
| `estimatedFeeSats` | Miner fee estimate for the fill (paid by the solver) |
| `validUntil` | Unix time after which you should re-quote |

## Using a quote

A quote is a price check, not a reservation. To trade, [create an intent](api/intents/create) with a minimum slightly under `amountOut`; the difference becomes [surplus](intents/settlement/surplus).
