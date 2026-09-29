---
title: Tokens & BCMR
description: Token lists with market data and BCMR metadata (symbol, name, decimals, icon).
status: draft
updated: 2026-09-28
sources: BCHMesh/meshserver/src/api/routes/tokens.ts, BCHMesh/meshserver/src/api/routes/bcmr.ts, MeshDocs/TokenDataAPIdocs/03-api-reference.md
---

```endpoint
{
  "method": "GET",
  "path": "/api/v1/tokens",
  "summary": "Tradable tokens with market data. Metadata comes from a BCMR cache and is filled in the background, so a first call may return fewer fields.",
  "params": [
    { "name": "network", "in": "query", "type": "string", "description": "mainnet | chipnet | testnet. Default chipnet.", "example": "chipnet" },
    { "name": "limit", "in": "query", "type": "number", "description": "Max 500. Default 50." },
    { "name": "search", "in": "query", "type": "string", "description": "Filter by symbol or name." }
  ],
  "responses": [
    { "status": 200, "body": { "tokens": [{ "symbol": "pUSD", "name": "…", "decimals": 2, "icon": "https://…", "market": { "categoryId": "…" } }] } }
  ]
}
```

## BCMR

| Endpoint | Purpose |
| --- | --- |
| `GET /api/v1/bcmr/:category` | Metadata for one category |
| `POST /api/v1/bcmr/batch` | Metadata for many categories |
| `GET /api/v1/bcmr/stats` | Cache statistics |

## To document

- Full token object and market fields
- Cache behaviour and freshness
- Mainnet vs chipnet indexers
