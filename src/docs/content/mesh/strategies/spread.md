---
title: Spread market
description: A bid below the market and an ask above it for one token. You earn the gap plus the fee when both sides trade. Proceeds go to your wallet.
status: ready
updated: 2026-10-02
sources: BCHMesh/meshserver/src/strategies/templates.ts
---

Classic market making in two pools: you buy a little below the market and sell a little above it.

## Pools

| Role | Pool holds | Accepts | Proceeds |
| --- | --- | --- | --- |
| Bid | BCH | the token at your buy price | tokens → wallet |
| Ask | the token | BCH at your sell price | BCH → wallet |

## Example

Mid 3,250 sats per pUSD unit. Bid at 3,234 (−0.5%), ask at 3,266 (+0.5%), fee 0.30%. Deposits: 0.01 BCH and 3 pUSD.

1. Trader A sells 1 pUSD to your bid. You pay 322,429 sats and receive 100 units.
2. Trader B buys 1 pUSD from your ask. You give 100 units and receive 327,583 sats.

Net: the same pUSD, **+5,154 sats** (about 1.6% on the round trip: the 1% spread plus the fee on both legs).

## Settings

| In the app | API key | Notes |
| --- | --- | --- |
| Token | `token` | |
| Buy price (bid) | `bidSatsPerToken` | below the market |
| Sell price (ask) | `askSatsPerToken` | must be above the bid |
| Pool fee | `feeBps` | |
| BCH for the bid | `depositSats` | ≥ 2,000 sats |
| Tokens for the ask | `depositTokens` | ≥ 2 base units |

## When to use it

- You hold both BCH and the token and expect the price to move sideways.
- You want two-sided depth with proceeds paid to your wallet.

## Risks

- A filled side is **not** refilled: proceeds go to your wallet. In a trending market only one side fills, and you end up fully in the asset that is moving against you.
- For capital that keeps cycling, use a [Recycling pair](mesh/strategies/recycling-pair) or a [Grid](mesh/strategies/grid).
