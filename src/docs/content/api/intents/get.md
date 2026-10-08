---
title: Get an intent
description: Fetch one intent with its derived status, deadlines and settlement transactions.
status: ready
updated: 2026-09-28
sources: BCHMesh/meshserver/src/api/routes/intent.ts, BCHMesh/meshserver/src/intents/format.ts
---

```endpoint
{
  "method": "GET",
  "path": "/api/v1/intent/:id",
  "params": [
    { "name": "id", "in": "path", "type": "string", "required": true, "description": "The intent id returned by create.", "example": "a3f1…" }
  ],
  "responses": [
    {
      "status": 200,
      "description": "A filled limit order.",
      "body": {
        "id": "a3f1…",
        "type": "limit",
        "status": "filled",
        "makerAddress": "bchtest:qr…",
        "contractAddress": "bchtest:p…",
        "fundingOutpoint": "9c2e…:0",
        "sellToken": "<pUSD category>",
        "buyToken": "BCH",
        "sellAmount": "10",
        "minAmountOut": "17000",
        "covenantDeadline": 1790003600,
        "refundEligibleAt": 1790007200,
        "fillTxid": "5b7d…",
        "fillMethod": "MESH_POOL",
        "fillExplorerUrl": "https://chipnet.imaginary.cash/tx/5b7d…",
        "userSurplusShareBps": 10000
      }
    },
    { "status": 404, "body": { "error": "Intent a3f1… not found" } }
  ]
}
```

The `status` field is derived on every request for open intents. See the [Status reference](intents/status) for every value and the fields that accompany it.

## While the intent waits for funds

An intent in `awaiting_funding` also carries `funding`, the same object [create](api/intents/create) returned. A client that did not create the intent can fund it from this: the app's `/fund?intent=<id>` page does, for orders prepared through the [MCP server](api/mcp/funding).

```json
{
  "id": "intent_1791381284264_5s3bcvy",
  "status": "awaiting_funding",
  "funding": { "to": "bchtest:p0073l…qvp0yda", "satoshis": "100000" }
}
```

A token order's `funding` has the covenant's token address in `to`, `"satoshis": "1000"` and a `token` object with `category` and `amount`. The field is gone once the intent is funded, underfunded, closed or past its deadline. List routes never carry it.
