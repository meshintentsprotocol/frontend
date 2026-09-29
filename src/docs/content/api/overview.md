---
title: API overview
description: The Mesh Server exposes a JSON REST API under /api/v1 and a WebSocket stream at /ws for quotes, intents, pools and market data.
status: ready
updated: 2026-09-28
sources: BCHMesh/meshserver/src/api/server.ts, MeshDocs/MeshServer/03-api-and-websocket-specification.md
---

## Base URL

```text
$MESH_URL/api/v1
```

Locally the server listens on port `3001`. See [Networks & endpoints](get-started/networks).

## Conventions

- JSON in, JSON out. Send `Content-Type: application/json` on writes.
- **Amounts are integer strings** in base units (sats for BCH). Never floats.
- **BCH is `0x`** in requests and `BCH` in responses; tokens are 64-hex category ids.
- **Times** are unix seconds. Covenant times are chain time (MTP).
- Errors are `{ "error": "message" }` with a meaningful HTTP status. See [Errors](api/errors).

## Endpoints

| Group | Endpoints |
| --- | --- |
| Quotes | `POST /quote` |
| Intents | `POST /intent/create` · `GET /intent/:id` · `GET /intent` · `GET /intent/active` · `GET /intent/all` · `POST /intent/:id/cancel` · `POST /intent/:id/refund` · `POST /intent/match` |
| TWAP | `POST /twap/quote` · `POST /twap/submit` · `GET /twap/active` · `GET /twap/address/:address` · `GET /twap/:orderId` · `POST /twap/:orderId/cancel` |
| Pools | `GET /positions` · `GET /positions/:ownerPkh` · `POST /positions` · `POST /positions/batch` · `GET /positions/utxo/:txid/:vout` · `GET /positions/:txid/fills` · `GET /positions/address/:address/fills` · `POST /positions/dock` · `POST /positions/dock-all` |
| Market data | `GET /orderbook` · `GET /orderbook/pairs` · `GET /tokens` · `GET /bcmr/:category` · `POST /bcmr/batch` · `GET /oracle/prices` · `GET /oracle/pairs` · `GET /oracle/payload` |
| LP tools | `POST /rebalance/quote` |
| Cauldron | `POST /cauldron/build-trade` · `POST /cauldron/record-swap` |
| Admin | `GET/POST /admin/*` (requires `x-admin-key`) |
| Health | `GET /health` · `GET /api/v1/stats` |

## Stream

```text
ws(s)://<host>/ws        # also /ws/v1/liquidity-stream
```

Intent lifecycle events are broadcast to every client; `orderbook:<pair>` and `fills` are subscription channels. See [WebSocket stream](api/websocket).

> [!NOTE] Legacy aliases
> For older frontends the server also mounts `/intent`, `/tokens`, `/bcmr`, `/cauldron`, `/admin` and `/router/quote` without the `/api/v1` prefix. New integrations should use `/api/v1`.
