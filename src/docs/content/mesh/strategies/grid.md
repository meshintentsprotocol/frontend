---
title: Grid
description: Two to ten recycling pairs on a geometric price ladder. Each rung buys at its level and sells one level up, so small moves anywhere in the range earn.
status: ready
updated: 2026-10-02
sources: BCHMesh/meshserver/src/strategies/templates.ts
---

A grid is several [recycling pairs](mesh/strategies/recycling-pair) stacked on a ladder. Where one recycling pair earns on one big swing, a grid earns on many small ones.

## How the ladder is built

For `rungs = K`, Mesh places K+1 price levels from your low to your high price, **geometrically**: each level is the same percentage above the one below it. Rung *i*:
- buys at level *i*;
- in mirror mode, sells at level *i+1*.

Your BCH is split evenly across the rungs.

## Example

Mid 3,250 sats per pUSD unit. Range −5% to +5% (3,087.5 to 3,412.5), 4 rungs, 0.04 BCH:

| Rung | Buys at | Sells at | Deposit |
| --- | --- | --- | --- |
| 1 | 3,087.5 | ≈ 3,165.7 | 1,000,000 sats |
| 2 | ≈ 3,165.7 | ≈ 3,245.9 | 1,000,000 sats |
| 3 | ≈ 3,245.9 | ≈ 3,328.2 | 1,000,000 sats |
| 4 | ≈ 3,328.2 | 3,412.5 | 1,000,000 sats |

Each step is about 2.5%. A move from 3,240 down to 3,160 and back fills rung 2's buy and then its sell: one round trip, about +2.5% on that rung's capital, while the other rungs wait.

## Settings

| In the app | API key | Notes |
| --- | --- | --- |
| Token | `token` | |
| Lowest buy price | `lowSatsPerToken` | bottom of the range |
| Highest sell price | `highSatsPerToken` | top of the range |
| Rungs | `rungs` | 2–10 |
| Pool fee | `feeBps` | |
| BCH | `depositSats` | split evenly; ≥ 2,000 sats per rung |

## Choosing the range

- **Narrow** ranges fill more often but need re-centring sooner.
- **Wide** ranges survive bigger moves but earn less per fill.
- **More rungs** means smaller steps. Each step must still clear the fee on both legs to be worth it.

## Risks

- All rungs start in BCH: the grid buys as the price falls into it. Below the range it holds only the token; above it, only BCH.
- Rebalance to re-centre the grid on the current price. One transaction closes the old rungs and opens new ones.
