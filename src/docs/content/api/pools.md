---
title: Pools
description: Preview, register and read StrategyCovenantV2 pools by covenant address, with chain-derived activity, stats and LP aggregates.
status: ready
updated: 2026-09-29
sources: BCHMesh/meshserver/src/api/routes/pools.ts, BCHMesh/meshserver/src/pools/poolLedger.ts, BCHMesh/meshserver/src/pools/poolStats.ts
---

A pool is identified by its **covenant address**. The address never changes; the pool's outpoint moves to a new transaction on every fill, so outpoint-keyed links go stale and address-keyed ones don't.

The server keeps a ledger per pool, built from the address's transaction history:

| Event | Meaning |
| --- | --- |
| `DEPOSIT` | The tx creates pool outputs without spending one (funding, top-up) |
| `FILL` | A pool input unlocked with `fill()`. `amountIn` / `amountOut` come from the pool's input vs its recreated output |
| `WITHDRAW` | Pool inputs unlocked with `dock()`. Outputs back to the address are the remainder of a partial withdraw |
| `REPRICE` | A `dock()` whose outputs fund another pool of the same owner. The two pools link via `successor` / `predecessor` |

Amounts are strings of base units (sats or token units). BCH is `'0x'`; token categories are 64-hex in display order.

```endpoint
{
  "method": "POST",
  "path": "/api/v1/pools/preview",
  "summary": "Compute the covenant for a set of params without touching the chain. Clients should refuse to fund unless their own computed address matches.",
  "params": [
    { "name": "ownerPkh", "in": "body", "type": "string", "required": true, "description": "hash160 of the LP's compressed public key (the P2PKH address hash)." },
    { "name": "tokenCategoryIn", "in": "body", "type": "string", "required": true, "description": "What the pool receives ('0x' for BCH)." },
    { "name": "tokenCategoryOut", "in": "body", "type": "string", "required": true, "description": "What the pool gives ('0x' for BCH). Exactly one side is BCH." },
    { "name": "priceNum", "in": "body", "type": "number", "required": true, "description": "Out base units per in base unit = priceNum / priceDen (before fee)." },
    { "name": "priceDen", "in": "body", "type": "number", "required": true, "description": "Positive safe integer." },
    { "name": "feeBps", "in": "body", "type": "number", "description": "0–9999. Default 30." }
  ],
  "body": { "ownerPkh": "324dbd54…", "tokenCategoryIn": "<pUSD category>", "tokenCategoryOut": "0x", "priceNum": 3215375, "priceDen": 1000, "feeBps": 30 },
  "responses": [
    { "status": 200, "body": {
      "address": "bchtest:pvzr7se6…", "tokenAddress": "bchtest:rvzr7se6…", "lockingBytecode": "aa20…87",
      "contractName": "StrategyCovenantV2", "constructorArgs": ["0x324dbd54…", "0x9b03567b…", "0x", "3215375", "1000", "30"],
      "artifactHash": "863fd70d…", "side": "SELL_BCH", "tokenCategory": "<pUSD category>",
      "satsPerToken": "3215.375", "traderSatsPerToken": "3205.728875",
      "minFunding": { "sats": "1001", "tokens": "0", "note": "plain BCH only; the pool keeps 1000 sats after every fill" },
      "registered": false } },
    { "status": 400, "body": { "error": "exactly one of tokenCategoryIn / tokenCategoryOut must be BCH" } }
  ]
}
```

```endpoint
{
  "method": "POST",
  "path": "/api/v1/pools",
  "summary": "Register one or more funded pools (up to 20). Each address is recomputed from its params and the outpoint must be unspent there; reserves are read from chain.",
  "params": [
    { "name": "pools", "in": "body", "type": "array", "required": true, "description": "Items: { txid, vout, ownerPkh, tokenCategoryIn, tokenCategoryOut, priceNum, priceDen, feeBps, pairName?, bundleId?, pairRole? }." }
  ],
  "body": { "pools": [{ "txid": "dae5ccebaa6a…", "vout": 0, "ownerPkh": "…", "tokenCategoryIn": "<pUSD category>", "tokenCategoryOut": "0x", "priceNum": 5000000000, "priceDen": 1561019, "feeBps": 30, "bundleId": "bundle-dae5cceb", "pairRole": "FORWARD" }] },
  "responses": [
    { "status": 201, "body": { "success": true, "pools": [{ "address": "bchtest:p…", "status": "active", "reserves": { "sats": "300000", "tokens": "0" } }], "results": [{ "index": 0, "status": 201, "address": "bchtest:p…" }] } },
    { "status": 207, "description": "Some items failed; see results." },
    { "status": 400, "description": "Invalid params, malformed txid, or a non-V2 contractType." },
    { "status": 404, "description": "The outpoint is not unspent at the address computed from the params (wrong params, or not broadcast yet)." },
    { "status": 422, "description": "The outpoint is there but is not a valid reserve (≤ 1000 sats for a BCH pool, < 2 tokens or wrong category for a token pool)." },
    { "status": 429, "description": "Rate limited (RATE_LIMIT_WRITES_PER_MIN per IP)." }
  ]
}
```

```endpoint
{
  "method": "GET",
  "path": "/api/v1/pools/:address",
  "summary": "One pool with stats, its UTXOs (valid and below-minimum) and lineage. Accepts the address or token address, with or without prefix.",
  "params": [ { "name": "address", "in": "path", "type": "string", "required": true, "description": "Covenant address (URL-encode the ':')." } ],
  "responses": [
    { "status": 200, "body": { "pool": {
      "address": "bchtest:p…", "contractName": "StrategyCovenantV2", "constructorArgs": ["0x…", "0x…", "0x", "5000000000", "1561019", "30"],
      "ownerPkh": "…", "ownerAddress": "bchtest:q…", "side": "SELL_BCH", "status": "active",
      "reserves": { "sats": "268066", "tokens": "10" }, "availableOut": "267066", "valueSats": "300096",
      "priceSource": "cauldron", "marketSatsPerToken": "3203.03556518",
      "utxos": [{ "txid": "a6bcc1ea…", "vout": 1, "sats": "268066", "tokens": "10", "valid": true }],
      "stats": { "volume7dSats": "31934", "fees7dSats": "96", "fillCount": 1, "pnlSats": "96", "feeApr7dPct": 1.66 },
      "predecessor": null, "successor": null }, "bundle": ["bchtest:p…"] } },
    { "status": 404, "body": { "error": "pool not found" } }
  ]
}
```

`status` is `active` (at least one valid pool UTXO), `exhausted` (UTXOs exist but none can fill — the owner should withdraw) or `closed` (nothing left at the address).

## More endpoints

| Endpoint | Purpose |
| --- | --- |
| `GET /api/v1/pools?pair=&owner=&status=&sort=&limit=&offset=` | List. `owner` takes a pkh or P2PKH cashaddr; `status` is `active` (default), `exhausted`, `closed`, `all` or a comma list; `sort` is `value`, `volume`, `fees`, `recent` or `created` |
| `GET /api/v1/pools/:address/activity?limit=&before=` | Ledger events, newest first, each with `balanceAfter` |
| `POST /api/v1/pools/:address/sync` | Re-read the address from chain after an LP transaction (rate limited) |
| `GET /api/v1/pools/pairs` | Per pair: pool/LP counts, TVL, 24h/7d volume and fees, best trader rate on each side, depth |
| `GET /api/v1/pools/depth?token=&step=` | One pair's liquidity per level of the shared bin grid (`step`: 10, 25, 50 or 100 bps). Each level: `satsPerToken`, `bidSats`, `askTokens`, `pools`, `lps`; plus `activeIndex` (the level of the market mid). A pool is placed at the level of its own price before its fee; pools worth less than `minBinSats` are left out, as the router leaves them out. Pools at one level stay separate pools of separate LPs |
| `GET /api/v1/pools/market-ref?token=` | Cauldron reference price (sats per token unit), best Mesh rates and BCH/USD |
| `GET /api/v1/pools/activity?type=FILL&limit=` | Recent events across all pools |
| `GET /api/v1/pools/by-outpoint/:txid/:vout` | Address of the pool that ever held an outpoint (for old links) |
| `GET /api/v1/lps?sort=tvl\|volume\|fees\|pnl` | LP leaderboard |
| `GET /api/v1/lps/:owner` | One LP: aggregates, pools, recent activity, 30-day daily series |
| `GET /api/v1/stats` | Adds `activePools`, `tvlSats`, `volume24hSats`, `fees24hSats`, `poolFills24h`, `avgFillLatencySec`, `bchUsd` |

## How the numbers are defined

- **Volume** is the BCH leg of each fill (exact).
- **LP fees** are what the pool kept versus its own zero-fee price: `amountIn · priceNum / priceDen − amountOut`, in the out asset, converted to sats. For a token-selling pool this is usually a fraction of one token unit, so it is computed exactly before conversion.
- **Value** is sats plus tokens at the Cauldron mid price (`priceSource: "cauldron"`), or at the pool's own price when Cauldron has no market.
- **P&L vs holding** is current value + withdrawn − deposited, all at today's price.
- **Fee APR (est.)** is 7-day fees × 365/7 over current value. It is an estimate, not a promise.

## WebSocket

Subscribe with `{ "action": "subscribe", "channel": "pools" }` (all pools) or `"pool:<address>"` (one pool). Events: `pool:registered`, `pool:updated` (with the ledger `event` and the new `balance`) and `pool:status` (`active` / `exhausted` / `closed`). The `fill` event on the `fills` channel now carries `fillMethod`, `poolAddress` and `intentId`.
