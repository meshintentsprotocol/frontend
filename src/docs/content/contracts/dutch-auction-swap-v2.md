---
title: DutchAuctionSwapV2
description: Decaying-price intent covenant. The minimum falls linearly with tx.locktime across a fixed window; refundable after the window closes.
status: ready
updated: 2026-09-28
sources: contracts-bch-swap/contracts/DutchAuctionSwapV2.cash
---

## Constructor

| Arg | Type | Meaning |
| --- | --- | --- |
| `makerPkh` | `bytes20` | Receives the payout and every refund |
| `sellTokenCategory` | `bytes` | `0x` for BCH |
| `buyTokenCategory` | `bytes` | `0x` for BCH |
| `sellAmount` | `int` | Required UTXO holding |
| `startBuyAmount` | `int` | Minimum at `startTime` |
| `endBuyAmount` | `int` | Minimum approached at `startTime + duration` |
| `startTime` | `int` | Chain time the window opens |
| `duration` | `int` | Window length in seconds |

## `fill()`

```cashscript {2-3,5-7}
require(tx.locktime >= 500000000);
require(tx.locktime >= startTime);
require(tx.locktime < startTime + duration);

int elapsed = tx.locktime - startTime;
int dropAmount = ((startBuyAmount - endBuyAmount) * elapsed) / duration;
int currentBuyAmount = startBuyAmount - dropAmount;
// … then the same funding and payout checks as LimitOrderSwapV2, against currentBuyAmount
```

```chart dutch-decay
```

## `cancel()`

Permissionless once `tx.time ≥ startTime + duration`. Refunds everything the UTXO holds to `makerPkh`.

There is **no** maker-signed early cancel, by design: a Dutch auction commits the maker to the window.

## Used by TWAP

Each [TWAP](intents/order-types/twap) slice is a `DutchAuctionSwapV2` whose `startTime` is delayed by `k · intervalSec`. The `tx.locktime ≥ startTime` gate is what stops a slice filling early.
