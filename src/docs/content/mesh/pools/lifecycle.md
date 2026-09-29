---
title: Pool lifecycle
description: Configure, fund, register, trade and dock a Mesh strategy pool, with the API call and on-chain check at each step.
status: ready
updated: 2026-09-28
sources: MeshDocs/BetaLaunch/03-v2-implementation-and-e2e-flows.md, MeshDocs/meshpoolapi/03-positions-api-reference.md, BCHMesh/meshserver/src/api/routes/positions.ts
---

```diagram pool-lifecycle
```

```screenshot
{ "src": "/docs/screenshots/mesh-create-pool.png", "url": "/mesh", "caption": "Creating a strategy pool from the Mesh page: pair, price, fee and deposit." }
```

## 1. Configure

Pick the pair, direction, price and fee. The price is a ratio of integers in base units: `priceNumerator / priceDenominator` of the **out** asset per unit of the **in** asset, before the fee.

The SDK (or your own CashScript code) instantiates `StrategyCovenantV2` with `ownerPkh` and those five values and gives you the P2SH32 address.

## 2. Fund

Send the reserve to the covenant address.

> [!DANGER] Don't use `wallet.send()` for covenants
> Some wallet libraries silently route a send to a P2SH32 cashaddr to the wrong output script. Build the funding output with `TransactionBuilder` using the covenant's raw **locking bytecode**, and verify the output script before broadcasting.

## 3. Register

Tell the server where the pool is:

```bash
curl -X POST "$MESH_URL/api/v1/positions" \
  -H "Content-Type: application/json" \
  -d '{
    "txid": "<funding txid>", "vout": 0,
    "ownerPkh": "<20-byte hex>",
    "tokenCategoryIn": "<pUSD category>", "tokenCategoryOut": "0x",
    "priceNum": 1994, "priceDen": 1, "feeBps": 30
  }'
```

The server **recomputes the address** from the params and requires the outpoint to be unspent at that address. Reserves are read from chain, never from the request.

| Response | Meaning |
| --- | --- |
| `201` | Registered; the pool appears in `/positions`, `/orderbook` and `/quote` |
| `404` | Outpoint is not an unspent output at the address computed from the params |
| `400` | V1 contract type or invalid params |

`POST /api/v1/positions/batch` accepts an array (or `{ positions: [...] }`) and reports `utxoIds` plus per-item `errors`.

## 4. Trade

Every fill spends the pool and recreates it at the same covenant address with `+amountIn` and `−amountOut`. The index follows the new outpoint on each sweep, so `GET /positions/:ownerPkh` always shows the current UTXO. Fill history is at `GET /positions/:txid/fills`.

## 5. Dock

Sign `dock(ownerPk, ownerSig)` and spend the pool to your own address. Then:

```bash
curl -X POST "$MESH_URL/api/v1/positions/dock" \
  -H "Content-Type: application/json" \
  -d '{ "txid": "<current pool txid>", "vout": 0 }'
```

The server only re-reads chain: `200` once the pool is spent, `409` while it's still live. It never marks a pool docked on request.
