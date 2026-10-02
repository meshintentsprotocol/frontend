---
title: Recycle
description: Find idle liquidity for an owner and plan a one-transaction recycle into recycling pairs around the market price.
status: ready
updated: 2026-10-02
sources: BCHMesh/meshserver/src/recycle/recycle.ts, BCHMesh/meshserver/src/api/routes/recycle.ts, BCHMesh/meshserver/test/integration/recycle.api.test.ts
---

Idle liquidity is liquidity that isn't earning. A recycle moves it back into [recycling pairs](mesh/strategies/recycling-pair) around today's price, so it stays in Mesh. **The server never signs**: it plans, your wallet signs one transaction.

| Kind | What it is | Detected when |
| --- | --- | --- |
| `wallet` | Proceeds your wallet-mode pools paid out, still in your wallet | The smaller of proceeds paid and what the wallet holds, per asset, worth more than the dust level |
| `stale` | A pool that doesn't fill | Active, no fill for `IDLE_STALE_SEC` (3 days), and priced `IDLE_OFF_MID_BPS` (3%) from the mid on the side that can't fill: a bid too far below, an ask too far above |
| `one-sided` | A recycling pair or grid stuck on one side | The whole range is past the mid, and the pools hold only the asset they can't sell back |
| `dust` | Almost empty pools | Reserve at or below `IDLE_DUST_SATS` (3,000 sats), or 2 token units |

```endpoint
{
  "method": "GET",
  "path": "/api/v1/recycle/idle",
  "summary": "Idle items for an owner, with reasons and value. wallet=false skips the wallet lookup.",
  "params": [
    { "name": "owner", "in": "query", "type": "string", "required": true, "description": "20-byte hex pkh or a P2PKH cashaddr." },
    { "name": "wallet", "in": "query", "type": "string", "description": "false to skip wallet proceeds." }
  ],
  "responses": [
    { "status": 200, "body": {
      "owner": "8fa69c5c…", "count": 2, "totalValueSats": "102500",
      "items": [
        { "id": "stale:bchtest:p…", "kind": "stale", "strategy": "stg-…", "token": "<pUSD>", "pools": ["bchtest:p…"], "valueSats": "100000", "vsMidBps": -769, "reason": "No fill in 4 days · 7.7% below market" },
        { "id": "dust:bchtest:p…", "kind": "dust", "pools": ["bchtest:p…"], "valueSats": "2500", "reason": "Only 2500 sats left" }
      ],
      "thresholds": { "staleAfterSec": 259200, "offMidBps": 300, "dustSats": "3000" } } }
  ]
}
```

```endpoint
{
  "method": "POST",
  "path": "/api/v1/recycle/plan",
  "summary": "Close the chosen idle pools and reopen what they held (plus chosen wallet proceeds) as recycling pairs at mid ∓ spread. Same shape as a rebalance: close, open, needs.",
  "body": { "owner": "<pkh>", "items": ["stale:bchtest:p…", "dust:bchtest:p…"], "spreadBps": 100, "feeBps": 30 },
  "responses": [
    { "status": 200, "body": {
      "close": [ { "address": "bchtest:p…", "contractName": "MeshPoolV3", "constructorArgs": ["…"], "utxos": [ { "txid": "…", "vout": 0, "sats": "100000", "tokens": "0", "category": null } ] } ],
      "open": [ { "template": "recycling-pair", "part": 1,
        "params": { "token": "<pUSD>", "start": "bch", "buySatsPerToken": "3217.50000000", "sellSatsPerToken": "3282.50000000", "feeBps": 30, "deposit": "102500" },
        "pools": [ { "address": "bchtest:p…", "deposit": { "sats": "102500" }, "market": [ { "side": "buys", "vsMidBps": -100, "reverseVsMidBps": 100 } ] } ] } ],
      "freed": { "sats": "102500", "tokens": {} }, "fromWallet": { "sats": "0", "tokens": {} }, "toWallet": { "sats": "0", "tokens": {} },
      "needs": { "sats": "102500", "tokens": {} }, "spreadBps": 100, "feeBps": 30, "notes": [], "recycledFrom": ["stg-…"] } },
    { "status": 404, "body": { "error": "nothing idle to recycle" } }
  ]
}
```

**Freed liquidity is grouped by the token it trades against.**
- The BCH a bid pool held reopens as a recycling pair that starts in BCH.
- A token reserve reopens as one that starts in the token.
- Assets with no market price, or below a pool's minimum, go back to your wallet. The plan lists them in `notes` and `toWallet`.

**To execute it:**
1. In one transaction, dock every `close` UTXO with your signature and fund every `open` pool. Your wallet adds the fee, any wallet proceeds, and the carrier sats of new token pools.
2. Register each `open` entry: `POST /api/v1/strategies { template, ownerPkh, params, txid, part, recycledFrom }`. With `part`, several strategies from one transaction get distinct ids: `stg-<txid prefix>-<part>`.

The app's **Recycle** button does all of this, and rebuilds and checks every pool locally before you sign.
