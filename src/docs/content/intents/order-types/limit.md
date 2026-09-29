---
title: Limit orders
description: A fixed minimum that any route must clear before the expiry. The maker can exit early with a signature.
status: ready
updated: 2026-09-28
sources: contracts-bch-swap/contracts/LimitOrderSwapV2.cash, MeshDocs/BetaLaunch/03-v2-implementation-and-e2e-flows.md
---

A limit order pays the maker **at least `buyAmount`** of the buy asset for `sellAmount` of the sell asset, any time before `expiryTime`. It is a `LimitOrderSwapV2` covenant.

```screenshot
{ "src": "/docs/screenshots/trade-limit.png", "url": "/trade", "caption": "Limit orders are created from the Limit tab on the Trade screen." }
```

## Create

```bash
curl -X POST "$MESH_URL/api/v1/intent/create" \
  -H "Content-Type: application/json" \
  -d '{
    "orderType": "limit",
    "makerAddress": "bchtest:qr…",
    "sellToken": "<pUSD category>", "sellAmount": "10",
    "buyToken": "0x",               "buyAmount": "17000",
    "duration": 3600,
    "frontendPkh": "<20-byte hex>",
    "userSurplusShareBps": 5000
  }'
```

| Field | Notes |
| --- | --- |
| `buyAmount` | The covenant minimum |
| `duration` or `expiryTime` | Seconds from now, or a unix time. Converted to chain time |
| `frontendPkh` | Optional. Receives the frontend share of surplus |
| `userSurplusShareBps` | Optional. `10000` = Mode A, `0` = Mode B, in between = Mode C |

## Spend paths

| Path | Who | When | Pays |
| --- | --- | --- | --- |
| `fill()` | Anyone | `tx.locktime < expiryTime` | Maker ≥ `buyAmount` at `outputs[i]` |
| `cancel()` | Anyone (refund engine) | `tx.time ≥ expiryTime` | Everything the UTXO holds → maker |
| `cancelEarly(pk, sig)` | Maker | Any time | Everything the UTXO holds → maker |

When the buy asset is a token, the payout output must also carry at least 1,000 sats so it's a valid token output.

## When does it fill?

At every solver cycle the matcher asks each route for its output and fills with the first that clears `buyAmount`. A limit order therefore fills as soon as **any** route's price reaches it, and keeps waiting otherwise.

> [!TIP] Setting the minimum
> Quote first with `POST /api/v1/quote`, then set `buyAmount` a little below `amountOut`. The difference is surplus the matcher splits back to the user and your frontend.
