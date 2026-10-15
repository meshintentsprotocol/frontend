---
title: Range
description: Bins on a shared price grid around the market. BCH bids below it, token asks above it, every one a recycling pool, with the deposit spread by a shape you choose.
status: ready
updated: 2026-10-16
sources: BCHMesh/meshserver/src/strategies/templates.ts, BCHMesh/meshserver/src/strategies/binGrid.ts, BCHMesh/meshserver/src/strategies/shapes.ts
---

A range is Mesh's version of a concentrated-liquidity position. You pick a price range, a bin step and a shape. Mesh opens one pool per bin. Each bin quotes one exact price, like a limit order that pays you a fee and re-quotes itself one bin away when it fills.

## Bins on a shared grid

Prices sit on a grid every pair shares: level *i* is `(1 + step)^i` sats per token base unit. The steps are 0.1%, 0.25%, 0.5% or 1%. Because every LP uses the same levels, pools at the same price form one bin on the [depth chart](api/pools). Each pool is still yours alone: no shared pool, no LP shares.

| Bin step | Good for |
| --- | --- |
| 0.1% | pegged pairs |
| 0.25% | steady pairs |
| 0.5% | most pairs |
| 1% | volatile pairs |

A range holds at most **20 bins**, because every bin is funded in one deploy transaction. Pick a larger step for a wider range.

## Which side each bin starts on

- Bins **below** the market price hold **BCH** and buy the token.
- Bins **above** it hold **the token** and sell it.
- When a bin fills, what it receives opens its mirror one level away. A bid that bought at level *i* re-sells at level *i+1*, and an ask that sold at *i+1* buys back at *i*. Each round trip earns the gap between levels plus the fee.

Nothing is priced through the market on deploy: a bin whose bid would pay more than the market after its fee starts on the token side instead. The preview warns about any pool priced through the market, and the app won't deploy it unless you say so.

## Shapes

| Shape | Deposit goes | Suits |
| --- | --- | --- |
| Spot | evenly across bins | not sure where the price goes inside the range |
| Curve | mostly into the bins next to the market | prices that stay near where they are |
| Bid-Ask | mostly into the bins at the edges | buying dips and selling rallies |

`strength` (gentle, standard, aggressive) sets how strongly Curve or Bid-Ask leans. A bin whose share would fall below the minimum (2,000 sats, or 2 token base units) is left out, and its share goes to the others. The preview lists any bin left out.

## Example

Market 2,000 sats per unit, range 1,900–2,100, 1% bins, Spot, 0.005 BCH and 250 units:

| Bins | Levels | Hold |
| --- | --- | --- |
| 6 bids | ≈ 1,905 to ≈ 2,002 | BCH, ≈ 83,333 sats each |
| 3 asks | sell at ≈ 2,043, ≈ 2,063, ≈ 2,084 | about 83 units each |

The bid at ≈ 2,002 sits just above the market, but after its 0.3% fee a seller gets ≈ 1,996, so it is not priced through the market.

## Settings

| In the app | API key | Notes |
| --- | --- | --- |
| Token | `token` | |
| Range low / high | `lowSatsPerToken`, `highSatsPerToken` | |
| Market price | `centerSatsPerToken` | required; filled in from the market |
| Bin step | `binStepBps` | 10, 25, 50, 100 |
| Shape | `shape`, `strength` | |
| Pool fee | `feeBps` | |
| BCH | `depositSats` | for the bins below the market |
| Tokens | `depositTokens` | for the bins above it |

## What you see afterwards

The position page shows:
- **against holding**: what the position plus everything it paid out is worth, against what your deposits would be worth if simply held;
- **time in range**;
- **the share of trading that came from arbitrage**;
- **a stress table** of the position at −50% to +100%.

These are estimates.

## Risks

- A move out of the range leaves the position in one asset: all token below the range, all BCH above it. Recycle flags a range that sits wholly on one side of the market, and one signature re-centres it.
- Each bin is one pool: very fine steps over a wide range cost more to trade through, so the router skips bins too small to pay for their own input.
