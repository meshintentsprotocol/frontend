---
title: Pricing math
description: The exact integer inequality a pool enforces, how the server quotes it, and worked examples.
status: ready
updated: 2026-09-28
sources: contracts-bch-swap/contracts/StrategyCovenantV2.cash, BCHMesh/meshserver/src/pools/poolContracts.ts
---

## The covenant inequality

A fill is valid when, in integers:

```text
amountOut · priceDenominator · 10000  ≤  amountIn · priceNumerator · (10000 − feeBps)
```

So the most a pool can release for `amountIn` is:

```text
maxOut = floor( amountIn · priceNumerator · (10000 − feeBps) / (priceDenominator · 10000) )
```

Rounding is always in the pool's favour. The server's quoting code uses the **same formula**, so a quote from `/quote` is exactly what the covenant will accept.

## Worked example

A pool selling BCH for pUSD at `1994 / 1` sats per pUSD base unit, `feeBps = 0`:

| amountIn (pUSD) | maxOut (sats) |
| --- | --- |
| 1 | 1,994 |
| 10 | 19,940 |
| 100 | 199,400 (if the reserve holds it) |

The chipnet quote **P3** returned the same figure: 10 pUSD → 19,940 sats.

With `feeBps = 30`, 10 pUSD releases `floor(10 · 1994 · 9970 / 10000) = 19,880` sats.

## Reserve limits

A pool can only release what it holds, and when it gives BCH its recreated output must keep at least 1,000 sats. The matcher skips a pool whose `maxOut` exceeds its reserve for the order's size.

## Choosing a price

- `priceNumerator / priceDenominator` can express any rational price. Use a large denominator for fine-grained levels, e.g. `1994250 / 1000`.
- Keep `amountIn · priceNumerator · 10000` well inside 64-bit range for the sizes you expect.
