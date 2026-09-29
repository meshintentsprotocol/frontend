---
title: 5-minute quickstart
description: Quote a swap, create a limit order, fund it from a chipnet wallet and watch it fill, using nothing but HTTP.
status: ready
updated: 2026-09-28
sources: MeshDocs/BetaLaunch/03-v2-implementation-and-e2e-flows.md, BCHMesh/meshserver/src/api/routes/intent.ts
---

You'll need a Mesh Server URL (a local one on port `3001` works) and a chipnet wallet holding a little tBCH. All amounts are strings of base units: sats for BCH, token base units for CashTokens.

```codegroup
@@ Hosted | bash
export MESH_URL="https://<your-mesh-server>"
@@ Local | bash
cd BCHMesh/meshserver && npm install && npm run dev
export MESH_URL="http://localhost:3001"
```

## 1. Get a quote

Ask what 20,000 sats buys in pUSD. `0x` means BCH; tokens are identified by their 32-byte category id.

```bash
curl -X POST "$MESH_URL/api/v1/quote" \
  -H "Content-Type: application/json" \
  -d '{ "tokenIn": "0x", "tokenOut": "<pUSD category>", "amountIn": "20000" }'
```

The response includes `amountOut`, the `route` and how it splits between Mesh and Cauldron (`meshPct`, `cauldronPct`). A `404` means no route has liquidity for that pair and size. See [Get a quote](api/quote).

## 2. Create the intent

Use a minimum a little below the quote so the order has room to fill.

```bash {6-7}
curl -X POST "$MESH_URL/api/v1/intent/create" \
  -H "Content-Type: application/json" \
  -d '{
    "orderType": "limit",
    "makerAddress": "bchtest:qr…",
    "sellToken": "0x",   "sellAmount": "20000",
    "buyToken": "<pUSD category>", "buyAmount": "9",
    "duration": 3600
  }'
```

```json title="201 Created (trimmed)"
{
  "success": true,
  "id": "…",
  "status": "awaiting_funding",
  "contractName": "LimitOrderSwapV2",
  "contractAddress": "bchtest:p…",
  "funding": { "to": "bchtest:p…", "satoshis": "20000" }
}
```

## 3. Fund it

Send exactly `funding.satoshis` to `funding.to` from your wallet. For a token sale, `funding` also has a `token` object: send that many tokens to the covenant's token address with 1,000 sats alongside.

> [!WARNING] Fund the whole order
> A UTXO that covers less than the sell amount is marked `underfunded`. It can never be filled and is refunded only after the deadline.

## 4. Watch it fill

Poll the intent, or subscribe on the WebSocket:

```codegroup
@@ Poll | bash
curl "$MESH_URL/api/v1/intent/<id>"
@@ WebSocket | typescript
const ws = new WebSocket(MESH_URL.replace(/^http/, 'ws') + '/ws');
ws.onmessage = (m) => {
  const e = JSON.parse(m.data);
  if (e.type?.startsWith('intent:')) console.log(e.type, e);
};
```

Within a solver cycle or two the status moves `active → filled` and the response carries `fillTxid` and `fillMethod` (`MESH_POOL`, `CAULDRON` or `SOLVER_INVENTORY`).

## What's next

```cards
[
  { "title": "Intent lifecycle", "description": "Every status and what moves an intent between them.", "href": "intents/lifecycle", "icon": "zap" },
  { "title": "Dutch auctions", "description": "Let the price decay until a route clears it.", "href": "intents/order-types/dutch", "icon": "timer" },
  { "title": "Earn frontend fees", "description": "Add frontendPkh and a surplus mode to your intents.", "href": "sdk/guides/frontend-fees", "icon": "key" },
  { "title": "API reference", "description": "Every endpoint, parameter and response.", "href": "api/overview", "icon": "server" }
]
```
