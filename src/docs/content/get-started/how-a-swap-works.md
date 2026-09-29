---
title: How a swap works
description: Follow one limit order from the swap screen to an on-chain fill, and see which component is responsible at each step.
status: ready
updated: 2026-09-28
sources: MeshDocs/BetaLaunch/03-v2-implementation-and-e2e-flows.md
---

This page follows a single order: **sell 10 pUSD for at least 17,000 sats**. The same flow applies to Dutch auctions and TWAP slices; only the covenant minimum changes.

```screenshot
{ "src": "/docs/screenshots/trade-swap.png", "url": "/trade", "caption": "The Trade screen creates intents. Swap, Limit and TWAP are all intents under the hood." }
```

```diagram intent-lifecycle
```

## 1. Create

The app calls the Mesh Server:

```bash
curl -X POST "$MESH_URL/api/v1/intent/create" \
  -H "Content-Type: application/json" \
  -d '{
    "orderType": "limit",
    "makerAddress": "bchtest:qr…",
    "sellToken": "<pUSD category>",
    "buyToken": "0x",
    "sellAmount": "10",
    "buyAmount": "17000",
    "duration": 3600
  }'
```

The server anchors the covenant's times to **chain time**, computes a `LimitOrderSwapV2` address and returns the exact `constructorArgs` plus a `funding` instruction. It stores those args; create, fill and refund all rebuild the same contract from them.

## 2. Fund

The user's wallet sends the full sell amount to `funding.to`. For a token sale that is the covenant's token address with a small BCH dust amount (1,000 sats) alongside the tokens.

The scanner watches the address and binds the UTXO to the intent **only if it covers the whole order**. Status moves `awaiting_funding → active`. A UTXO that is short becomes `underfunded`: it can never be filled and is refunded in full after the deadline.

## 3. Match

Every solver cycle, the matcher prices the intent at `locktime = MTP − 1`:

```diagram tri-route
```

Here a Mesh pool selling BCH at 1 pUSD : 1,994 sats (after its fee) quotes 19,940 sats, which clears the 17,000 minimum, so the matcher picks it.

## 4. Fill

The executor builds one transaction that spends the intent and the pool together:

```diagram fill-transaction
```

The intent covenant checks that output 0 pays the maker at least 17,000 sats. The pool covenant checks that it received 10 pUSD for the 19,940 sats it released. Everything else is the solver's business. The surplus (2,940 sats) is split by the intent's [surplus mode](intents/settlement/surplus): in Mode A the maker receives 18,470 sats, exactly what the live chipnet test (F1) recorded.

The intent becomes `filled`, and the WebSocket emits `intent:filled` with the `fillTxid` and `fillMethod`.

## If nothing clears

If no route can pay the minimum before the deadline, the matcher emits `intent:unfillable` with per-route reasons. After the deadline, the refund engine spends the covenant's `cancel()` path and the maker receives **everything the UTXO holds**, including any over-funding. See [Refunds & cancellation](intents/settlement/refunds).
