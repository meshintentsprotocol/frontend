---
title: What is an intent
description: An intent is a covenant-locked order that anyone may fill, but only in a way that pays the maker what they asked for.
status: ready
updated: 2026-09-28
sources: MeshDocs/BetaLaunch/03-v2-implementation-and-e2e-flows.md, contracts-bch-swap/contracts/LimitOrderSwapV2.cash
---

In a traditional DEX, the user picks the route and signs a transaction that executes it. With intents, the user only states the **outcome**: *sell X, receive at least Y, before T*. Solvers compete to find the route.

On BCH Intents, that statement is a UTXO locked by a covenant whose constructor arguments encode the order:

```cashscript title="LimitOrderSwapV2.cash"
contract LimitOrderSwapV2(
    bytes20 makerPkh,          // who gets paid
    bytes sellTokenCategory,   // 0x for BCH
    bytes buyTokenCategory,
    int sellAmount,
    int buyAmount,             // the covenant minimum
    int expiryTime             // chain time (MTP)
)
```

## Three properties

1. **Permissionless fills.** `fill()` needs no signature. Any solver can spend the intent in any transaction.
2. **Enforced payout.** The spending transaction must pay `makerPkh` at least the minimum at **the output with the same index as the intent's input**. If it doesn't, the transaction is invalid.
3. **Guaranteed exit.** After expiry anyone can call `cancel()`, which may only send everything the UTXO holds back to the maker.

## Order types

| Type | Minimum | Early exit | Covenant |
| --- | --- | --- | --- |
| [Limit](intents/order-types/limit) | Fixed `buyAmount` | `cancelEarly()` (maker-signed) | `LimitOrderSwapV2` |
| [Dutch auction](intents/order-types/dutch) | Decays from `startBuyAmount` to `endBuyAmount` | None | `DutchAuctionSwapV2` |
| [TWAP](intents/order-types/twap) | N Dutch slices | None | `DutchAuctionSwapV2` × N |
| [Market](intents/order-types/market) | Quote minus slippage | — | Planned |

## Intents vs. transactions

| | Signed transaction | Intent |
| --- | --- | --- |
| Route chosen by | User's app | Solver, at fill time |
| Price guarantee | Slippage setting in the app | Covenant minimum, checked by consensus |
| If price moves against you | Tx fails or fills badly | Order waits, then refunds |
| Composability | One route per tx | Mesh + Cauldron + inventory in one tx |
| Who pays the miner fee | User | Solver |

```cards
[
  { "title": "Intent lifecycle", "description": "Create → fund → match → fill, and the refund path.", "href": "intents/lifecycle", "icon": "zap" },
  { "title": "The atomic fill", "description": "Exactly what a fill transaction looks like.", "href": "intents/settlement/fill-transaction", "icon": "layers" }
]
```
