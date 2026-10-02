---
title: Stable pair
description: Token↔token pools around a peg, with no BCH leg. Give B for A, A for B, or both, a little off the peg.
status: ready
updated: 2026-10-02
sources: BCHMesh/meshserver/src/strategies/templates.ts
---

For two tokens that should trade near a fixed rate, such as two dollar stablecoins, or a wrapped and a native version of the same asset.

## Pools

| Role | Pool holds | Accepts | Rate |
| --- | --- | --- | --- |
| Give B | token B | token A | `(1 − spread) × peg` B per A |
| Give A | token A | token B | `(1 − spread) ÷ peg` A per B |

A pool is created only for the side you deposit.

## Example

Two dollar tokens, both with 2 decimals, so the peg is **1** (B base units per A base unit). Spread 0.20% each side, fee 0.10%.
- A trader swaps 10 A (1,000 units) and gets 1,000 × 0.998 × 0.999 = **997 B units**.
- Swapping back the other way is priced the same.

You earn about 0.6% on a full round trip.

> [!NOTE]
> The peg is in **base units**. If A has 2 decimals and B has 6, a 1:1 peg is `10000` B units per A unit. The app converts this for you from "1 A = 1 B".

## Settings

| In the app | API key | Notes |
| --- | --- | --- |
| Token A, Token B | `tokenA`, `tokenB` | must differ |
| Peg | `rate` | B base units per A base unit |
| Spread each side | `spreadBps` | distance from the peg |
| Pool fee | `feeBps` | stable pairs usually charge less (5–10 bps) |
| Token A / B deposit | `depositA`, `depositB` | at least one |

## When to use it

- You want token↔token swaps without routing through BCH twice. Traders get one hop and one fee.

## Risks

- There is **no price feed**. If one token loses its peg, traders drain the side that is now cheap. Watch the peg and close or reprice if it breaks.
