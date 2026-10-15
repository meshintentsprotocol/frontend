---
title: Grid
description: Two to ten recycling pairs on a geometric price ladder. Each rung buys at its level and sells one level up, so small moves anywhere in the range earn.
status: ready
updated: 2026-10-16
sources: BCHMesh/meshserver/src/strategies/templates.ts
---

A grid is several [recycling pairs](mesh/strategies/recycling-pair) stacked on a ladder. Where one recycling pair earns on one big swing, a grid earns on many small ones.

## How the ladder is built

For `rungs = K`, Mesh places K+1 price levels from your low to your high price, **geometrically**: each level is the same percentage above the one below it. Rung *i* works between level *i* and level *i+1*: it buys at level *i* and, in mirror mode, sells at level *i+1*.

## Which side each rung starts on

A rung that would buy **above the market** would be emptied by arbitrage the moment it is funded. So when the grid has a market price (`centerSatsPerToken`, filled in for you from the market):

- rungs **below** the market start in **BCH** and buy the token;
- rungs **at or above** the market start in **the token** and sell it at the rung's upper level. This is exactly the pool the bid would have opened after its first fill.

Fund the BCH rungs with `depositSats` and the token rungs with `depositTokens`. A range wholly below the market needs only BCH.

## Example

Mid 3,250 sats per pUSD unit. Range −5% to +5% (3,087.5 to 3,412.5), 4 rungs, 0.03 BCH and 20 pUSD units:

| Rung | Works between | Starts as | Deposit |
| --- | --- | --- | --- |
| 1 | 3,087.5 – ≈ 3,165.7 | bid (BCH) | 1,000,000 sats |
| 2 | ≈ 3,165.7 – ≈ 3,245.9 | bid (BCH) | 1,000,000 sats |
| 3 | ≈ 3,245.9 – ≈ 3,328.2 | bid (BCH): after its 0.3% fee a seller gets ≈ 3,236, below the mid | 1,000,000 sats |
| 4 | ≈ 3,328.2 – 3,412.5 | ask (pUSD) at 3,412.5 | 20 pUSD units |

Each step is about 2.5%. A move from 3,240 down to 3,160 and back fills rung 2's buy and then its sell: one round trip, about +2.5% on that rung's capital, while the other rungs wait.

## Settings

| In the app | API key | Notes |
| --- | --- | --- |
| Token | `token` | |
| Lowest buy price | `lowSatsPerToken` | bottom of the range |
| Highest sell price | `highSatsPerToken` | top of the range |
| Rungs | `rungs` | 2–10 |
| Market price | `centerSatsPerToken` | optional; without it every rung starts in BCH, so keep the range below the market |
| Pool fee | `feeBps` | |
| BCH | `depositSats` | rungs below the market; ≥ 2,000 sats per rung |
| Tokens | `depositTokens` | rungs above the market; ≥ 2 base units per rung |
| Shape | `shape`, `strength` | `spot` (even, default), `curve` (more near the market), `bidask` (more at the edges) |

## Choosing the range

- **Narrow** ranges fill more often but need re-centring sooner.
- **Wide** ranges survive bigger moves but earn less per fill.
- **More rungs** means smaller steps. Each step must still clear the fee on both legs to be worth it.
- For rungs on a shared price grid with bin steps, use [Range](mesh/strategies/range).

## Risks

- Below the range the grid holds only the token; above it, only BCH. The position page shows the time spent in range and a stress table.
- Rebalance to re-centre the grid on the current price. One transaction closes the old rungs and opens new ones.
