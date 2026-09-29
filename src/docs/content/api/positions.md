---
title: Positions
description: List, register and reconcile Mesh strategy pools, and read their fill history.
status: ready
updated: 2026-09-28
sources: BCHMesh/meshserver/src/api/routes/positions.ts, MeshDocs/meshpoolapi/03-positions-api-reference.md
---

```endpoint
{
  "method": "GET",
  "path": "/api/v1/positions/:ownerPkh",
  "summary": "Live StrategyCovenantV2 pools owned by one LP. The index follows each pool to its recreated outpoint after every fill.",
  "params": [
    { "name": "ownerPkh", "in": "path", "type": "string", "required": true, "description": "20-byte hex (40 chars).", "example": "3f5a…" }
  ],
  "responses": [
    {
      "status": 200,
      "body": {
        "ownerPkh": "3f5a…",
        "activeCount": 1,
        "positions": [{
          "txid": "0fcba1fc…", "vout": 1, "address": "bchtest:p…",
          "contractType": "StrategyCovenantV2", "ownerPkh": "3f5a…",
          "reserveSats": "480060", "tokenCategoryIn": "<pUSD category>", "tokenCategoryOut": "0x",
          "tokenAmountIn": "10", "priceNum": 1994, "priceDen": 1, "feeBps": 0
        }]
      }
    },
    { "status": 400, "body": { "error": "Invalid ownerPkh — expected 20-byte hex (40 chars)" } }
  ]
}
```

```endpoint
{
  "method": "POST",
  "path": "/api/v1/positions",
  "summary": "Register a pool you funded. The address is recomputed from the params and the outpoint must be unspent there; reserves come from chain.",
  "params": [
    { "name": "txid", "in": "body", "type": "string", "required": true, "description": "Funding txid." },
    { "name": "vout", "in": "body", "type": "number", "description": "Output index. Default 0." },
    { "name": "ownerPkh", "in": "body", "type": "string", "required": true, "description": "Dock key hash." },
    { "name": "tokenCategoryIn", "in": "body", "type": "string", "required": true, "description": "What the pool receives." },
    { "name": "tokenCategoryOut", "in": "body", "type": "string", "required": true, "description": "What the pool gives." },
    { "name": "priceNum", "in": "body", "type": "number", "required": true, "description": "Price numerator." },
    { "name": "priceDen", "in": "body", "type": "number", "required": true, "description": "Price denominator." },
    { "name": "feeBps", "in": "body", "type": "number", "description": "Default 30." }
  ],
  "body": { "txid": "0fcba1fc…", "vout": 1, "ownerPkh": "3f5a…", "tokenCategoryIn": "<pUSD category>", "tokenCategoryOut": "0x", "priceNum": 1994, "priceDen": 1, "feeBps": 0 },
  "responses": [
    { "status": 201, "body": { "success": true, "registeredCount": 1, "utxoId": "0fcba1fc…:1", "utxoIds": ["0fcba1fc…:1"], "errors": [] } },
    { "status": 404, "description": "Outpoint isn't an unspent output at the computed address.", "body": { "success": false, "registeredCount": 0, "errors": [{ "index": 0, "error": "… not an unspent …" }] } },
    { "status": 400, "description": "V1 contract type or invalid params.", "body": { "success": false, "registeredCount": 0, "errors": [{ "index": 0, "error": "StrategyCovenant pools are not accepted (drainable V1); deploy StrategyCovenantV2" }] } }
  ]
}
```

## More endpoints

| Endpoint | Purpose |
| --- | --- |
| `GET /api/v1/positions` | Every live pool, with indexer stats |
| `POST /api/v1/positions/batch` | Register several pools: an array or `{ positions: [...] }` |
| `GET /api/v1/positions/utxo/:txid/:vout` | One pool by outpoint |
| `GET /api/v1/positions/:txid/fills` | Fill history for a pool |
| `GET /api/v1/positions/address/:address/fills` | Fill history for a covenant address |
| `POST /api/v1/positions/dock` | `{ txid, vout }`: re-read chain after the LP broadcast `dock()`. `200` gone, `409` still live |
| `POST /api/v1/positions/dock-all` | `{ ownerPkh? }`: reconcile every pool address for an owner |
