---
title: Strategies
description: Templates with a field schema, market-based suggestions, preview against the market, one-transaction deploy and rebalance plans for MeshPoolV3 strategies.
status: ready
updated: 2026-10-16
sources: BCHMesh/meshserver/src/api/routes/strategies.ts, BCHMesh/meshserver/src/strategies/templates.ts, BCHMesh/meshserver/src/strategies/metrics.ts, BCHMesh/meshserver/test/integration/strategies.market.test.ts
---

A strategy is a [template](mesh/strategies/overview) expanded into [MeshPoolV3](mesh/v3/meshpool-v3) pools. **The server never signs**: your client funds every pool in one transaction, then registers it.

```text
GET  /templates       → render the form from the field schema
GET  /suggest         → market mid + suggested params
POST /preview         → exact pools, addresses, deposits, prices vs mid
     … wallet: one tx, one output per pool (raw lockingBytecode, deposit) …
POST /                → register { template, ownerPkh, params, txid }
GET  /?owner=, /:id   → positions
POST /:id/rebalance-plan → close N, open M, one tx; register with `replaces`
```

Units:
- prices are decimal strings in **sats per token base unit**;
- deposits are base-unit integer strings;
- BCH is `0x` in pool data.

Write routes are rate-limited.

```endpoint
{
  "method": "GET",
  "path": "/api/v1/strategies/templates",
  "summary": "Every template with a field schema a client can render without knowing the template, plus shared limits.",
  "responses": [
    { "status": 200, "body": {
      "templates": [ {
        "id": "grid", "name": "Grid", "summary": "K recycling pairs on a price ladder…",
        "category": "range", "recycles": true, "deposit": "BCH, split across rungs",
        "earns": "Every small move inside the range, on every rung", "risk": "All rungs start in BCH…",
        "fields": [
          { "key": "token", "label": "Token", "type": "token", "required": true, "help": "CashToken category (64 hex)" },
          { "key": "lowSatsPerToken", "label": "Lowest buy price", "type": "price", "asset": "token", "required": true, "help": "Bottom of the range — sats per token base unit" },
          { "key": "rungs", "label": "Rungs", "type": "int", "required": true, "min": 2, "max": 10, "default": 4, "help": "…" },
          { "key": "feeBps", "label": "Pool fee", "type": "bps", "required": false, "min": 0, "max": 9999, "default": 30, "help": "…" },
          { "key": "depositSats", "label": "BCH", "type": "amount", "asset": "bch", "required": true, "min": 2000, "help": "…" }
        ],
        "params": { "token": "…" } } ],
      "limits": { "minBchPerPool": 2000, "minTokensPerPool": 2, "tokenCarrierSats": 1000, "maxFeeBps": 9999, "maxSlotsPerPool": 3 } } }
  ]
}
```

Field `type`s:
- `token`, `price`, `rate`, `amount`, `int`, `bps`, `enum` (with `options`), and `tokenList` (multi-pair).
- `asset` names the token field a price or amount refers to (`bch` for sats). It can also be `{ "field": "side", "map": { "bid": "bch", "ask": "token" } }` when a choice picks the unit.

```endpoint
{
  "method": "GET",
  "path": "/api/v1/strategies/suggest",
  "summary": "Market context and suggested params around the mid (deposits are left to you).",
  "params": [
    { "name": "template", "in": "query", "type": "string", "required": true, "description": "Template id." },
    { "name": "token", "in": "query", "type": "string", "description": "Token category (most templates)." },
    { "name": "tokens", "in": "query", "type": "string", "description": "multi-pair: 2–3 comma-separated categories." },
    { "name": "tokenA", "in": "query", "type": "string", "description": "stable-pair: token A (with tokenB)." }
  ],
  "responses": [
    { "status": 200, "body": {
      "template": "grid",
      "market": { "<pUSD category>": {
        "token": "<pUSD category>", "symbol": "PUSDTEST", "decimals": 2, "icon": "https://…",
        "cauldron": { "satsPerToken": "3250.02931831", "bchReserve": "2944039058", "tokenReserve": "905850", "poolAddress": "…" },
        "mesh": { "bestBid": { "satsPerToken": "3240.27", "address": "…" }, "bestAsk": { "satsPerToken": "3256.52", "address": "…" } },
        "midSatsPerToken": 3250.02931831, "midSource": "cauldron", "bchUsd": 308.13, "tokenUsd": 1.0014 } },
      "params": { "token": "<pUSD category>", "lowSatsPerToken": "3087.528", "highSatsPerToken": "3412.53", "rungs": 4, "feeBps": 30 } } },
    { "status": 200, "body": { "template": "grid", "market": { "…": { "midSatsPerToken": null } }, "params": null, "reason": "no market price for … (no Cauldron pool and no Mesh quote)" } },
    { "status": 200, "body": { "template": "range", "market": { "…": { "midCheck": { "recentMedian": 3000, "samples": 6, "windowSec": 1800, "divergenceBps": 833, "maxDivergenceBps": 500, "ok": false } } }, "params": null, "reason": "the market price of PUSDTEST moved 8.3% from its median of the last 30 minutes: enter the market price yourself or try again later" } },
    { "status": 400, "body": { "error": "unknown template 'nope' (fixed, spread, multi-pair, stable-pair, recycling-pair, grid, range, take-profit, accumulate)" } }
  ]
}
```

The mid is the deepest Cauldron pool's price. Without one, it is the middle of the best Mesh bid and ask, or the one side that exists.

**Mid check.** Each market context carries `midCheck`: the median of the mid samples of the last `windowSec` (30 minutes), how far the current mid is from it (`divergenceBps`) and `ok`. When a mid has jumped by more than `maxDivergenceBps` (5%), for example after one large trade on a thin Cauldron pool, `/suggest` returns `params: null` with a reason, so no position is centred on that price. You can still enter prices yourself.

Suggestions:

| Template | Suggested |
| --- | --- |
| fixed / spread | bid at −0.5%, ask at +0.5% |
| recycling-pair | buy at −1%, sell at +1% |
| grid | −5% to +5%, 4 rungs, `centerSatsPerToken` = the mid (rungs above it start on the token side) |
| range | −5% to +5%, 1% bins, spot, `centerSatsPerToken` = the mid |
| take-profit / accumulate | +2% to +15% / −2% to −15%, 4 steps |
| multi-pair | every token at −0.5% |
| stable-pair | the peg (ratio of the two mids), 0.20% spread, 0.10% fee |

```endpoint
{
  "method": "POST",
  "path": "/api/v1/strategies/preview",
  "summary": "Template + params → the pools to fund, their addresses and deposits, and every price against the market mid. No chain access.",
  "body": { "template": "recycling-pair", "ownerPkh": "<40 hex>", "params": { "token": "<pUSD category>", "buySatsPerToken": "3217.5", "sellSatsPerToken": "3282.5", "deposit": "1000000" } },
  "responses": [
    { "status": 200, "body": {
      "template": "recycling-pair",
      "pools": [ { "role": "buy", "contractName": "MeshPoolV3", "address": "bchtest:p…", "tokenAddress": "bchtest:r…", "lockingBytecode": "aa20…87",
        "fundTo": "bchtest:p…", "deposit": { "sats": "1000000" }, "v3": { "…": "…" },
        "market": [ { "asset": "<pUSD category>", "side": "buys", "satsPerToken": 3217.5, "midSatsPerToken": 3250, "vsMidBps": -100,
                      "reverseSatsPerToken": 3282.5, "reverseVsMidBps": 100 } ],
        "registered": false } ],
      "totals": { "sats": "1000000", "tokens": {} },
      "market": { "<pUSD category>": { "midSatsPerToken": 3250 } } } },
    { "status": 400, "body": { "error": "sellSatsPerToken must be above buySatsPerToken" } }
  ]
}
```

Per slot, `side` is `buys` (BCH reserve paying for a token), `sells` (token reserve asking BCH) or `swaps` (token↔token, with `vsMidBps` comparing the value given to the value received). Fund each pool with an output to its `lockingBytecode` (raw bytecode, not a wallet "send to address") carrying `deposit`. Token pools take 1000 sats plus the tokens.

The preview also returns:
- **`crossesMarket`** on each pool, and **`warnings`** in words. A pool listed there gives a trader more than the market after its fee (a bid above the mid, an ask below it), so arbitrage would take it as soon as it is funded. Don't deploy it unless the LP means to. The rebalance and recycle plans carry the same `warnings`.
- **`notes`**, e.g. a bin a shaped split left out because its share was below the pool minimum.
- **`deployBytes`**: a rough size of the deploy transaction.

**Shapes.** `grid`, `range`, `take-profit` and `accumulate` take `shape` (`spot` default, `curve`, `bidask`) and `strength` (`gentle`, `standard`, `aggressive`); see [Range](mesh/strategies/range).

```endpoint
{
  "method": "POST",
  "path": "/api/v1/strategies",
  "summary": "Register a deploy transaction: every pool's outpoint is found on-chain first, then all are registered (all or nothing). Pass replaces to link a rebalance.",
  "body": { "template": "grid", "ownerPkh": "<40 hex>", "params": { "…": "same params as the preview" }, "txid": "<64 hex>", "replaces": "stg-… (optional)", "part": "1 (optional: several strategies from one tx)", "recycledFrom": ["stg-… (optional)"] },
  "responses": [
    { "status": 201, "body": { "strategy": { "id": "stg-<first 24 hex of txid>", "status": "active", "poolCount": 4 } } },
    { "status": 404, "body": { "error": "pool 'rung-2' (bchtest:p…) has no unspent output from <txid>" } },
    { "status": 409, "body": { "error": "strategy stg-… already registered" } }
  ]
}
```

```endpoint
{
  "method": "GET",
  "path": "/api/v1/strategies/:id",
  "summary": "A position: totals over every member pool (mirrors included) and the pools themselves. GET /api/v1/strategies?owner=<pkh|cashaddr> lists summaries.",
  "responses": [
    { "status": 200, "body": { "strategy": {
      "id": "stg-…", "template": "recycling-pair", "status": "active", "poolCount": 2, "activePools": 2,
      "valueSats": "1022074", "volume24hSats": "…", "volume7dSats": "…", "feesAllSats": "…", "fees7dSats": "…", "pnlSats": "22074", "fillCount": 2,
      "inventory": { "sats": "1022074", "tokens": { "<pUSD category>": "1" } },
      "feeApr7dPct": 41.3, "lastFillAt": 1790885000, "lastActivityAt": 1790885000,
      "pools": [ { "address": "bchtest:p…", "role": "buy", "status": "active" } ] },
      "pools": [ { "…": "full pool objects, see Pools" } ] } }
  ]
}
```

`feeApr7dPct` is an estimate: the last 7 days of fee income, annualised over the current value. It is `null` until the strategy has 24 hours of history. Owner listings (`?owner=`) also carry `idle` (`kinds`, `reasons`, `valueSats`) when part of the strategy is [idle](api/recycle).

**Metrics.** Each strategy also carries `metrics` (estimates, for display):

| Field | Meaning |
| --- | --- |
| `holdValueSats` | What your own deposits would be worth today if simply held. Deposits one of the strategy's pools made into another (recycling) are not counted |
| `vsHoldSats`, `vsHoldPct` | Value now plus everything paid out, minus `holdValueSats` |
| `arbitrage` | Fills and the share of volume that came from arbitrage (the Mesh Balancer, or transactions built outside the server) |
| `range`, `timeInRange` | The prices the strategy quotes, and the share of market samples since it was deployed that fell inside them |
| `stress.rows[]` | Value at 0.5×–2× the mid against holding what it holds now: each pool the move crosses converts at its own price |

**Proceeds.** `fixed`, `spread`, `take-profit` and `accumulate` take `proceeds: "wallet" | "recycle"` (default `wallet`).
- `spread` with `recycle` puts both pools in mirror mode, so each side refills the other.
- `fixed` with `recycle` needs `recycleSatsPerToken`: the trade-back price, above a bid or below an ask.
- `take-profit` and `accumulate` with `recycle`: a filled step trades back one step away (buys back lower, or sells back higher).

```endpoint
{
  "method": "POST",
  "path": "/api/v1/strategies/:id/rebalance-plan",
  "summary": "Close the strategy's pools and open a new set in one transaction: the plan lists what to dock, what to fund and any shortfall.",
  "body": { "template": "grid", "params": { "…": "new params; omit to reuse the current ones" } },
  "responses": [
    { "status": 200, "body": {
      "strategy": "stg-…",
      "close": [ { "address": "bchtest:p…", "contractName": "MeshPoolV3", "constructorArgs": ["…"], "utxos": [ { "txid": "…", "vout": 0, "sats": "…", "tokens": "0", "category": null } ] } ],
      "open": [ { "role": "rung-1", "lockingBytecode": "…", "deposit": { "sats": "…" }, "market": ["…"] } ],
      "market": { "…": "…" },
      "available": { "sats": "…", "tokens": {} }, "needs": { "sats": "…", "tokens": {} }, "shortfall": { "sats": "1000" } } }
  ]
}
```

Sign every `close` UTXO with `dock(ownerPk, ownerSig)`, fund every `open` pool, and add wallet inputs for the fee and any `shortfall`. Then register with `replaces`.
