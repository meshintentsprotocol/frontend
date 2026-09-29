---
title: Dutch auctions
description: The minimum starts high and decays linearly with chain time. The order fills at the first moment any route clears it.
status: ready
updated: 2026-09-28
sources: contracts-bch-swap/contracts/DutchAuctionSwapV2.cash, MeshDocs/BetaLaunch/03-v2-implementation-and-e2e-flows.md
---

A Dutch auction starts at the maker's best price and walks down to their worst price over `duration` seconds. Solvers race to fill as soon as the decaying minimum drops below what a route can pay, so the maker gets roughly the best price the market will bear at that moment.

```chart dutch-decay
```

## The decay rule

The covenant computes the minimum from the fill transaction's `tx.locktime`:

```cashscript title="DutchAuctionSwapV2.fill()" {5-7}
require(tx.locktime >= 500000000);
require(tx.locktime >= startTime);
require(tx.locktime < startTime + duration);

int elapsed = tx.locktime - startTime;
int dropAmount = ((startBuyAmount - endBuyAmount) * elapsed) / duration;
int currentBuyAmount = startBuyAmount - dropAmount;
```

Because fills use `nLocktime = MTP − 1`, "now" for the covenant is the chain's median-time-past, which advances in block-sized steps. The live chipnet test **F3** ran an auction from 11,900 down to 11,000 and filled at 11,932: the route cleared the minimum early in the window, and the extra above the minimum became surplus.

## Create

```bash
curl -X POST "$MESH_URL/api/v1/intent/create" \
  -H "Content-Type: application/json" \
  -d '{
    "orderType": "dutch",
    "makerAddress": "bchtest:qr…",
    "sellToken": "<pUSD category>", "sellAmount": "6",
    "buyToken": "0x",
    "startBuyAmount": "11900",
    "endBuyAmount": "11000",
    "duration": 3600
  }'
```

If `endBuyAmount` is omitted it defaults to 98% of `startBuyAmount`.

## Spend paths

| Path | Who | When |
| --- | --- | --- |
| `fill()` | Anyone | `startTime ≤ tx.locktime < startTime + duration` |
| `cancel()` | Anyone (refund engine) | `tx.time ≥ startTime + duration` |

> [!WARNING] No early exit
> By design there is no maker-signed `cancelEarly()` on Dutch auctions. Once funded, the order runs until it fills or its window closes, and is then refunded automatically.

## Choosing parameters

- **Start** at or slightly above the current quote so the order can't fill below market at t = 0.
- **End** at the worst price you'd accept. Anything between start and end is fair game.
- **Duration** trades speed for price. Short windows fill fast; long windows let the minimum sit near market longer.
