---
title: Accumulate ladder
description: Buy a token in steps at falling prices. Each step is its own bid; the tokens go to your wallet.
status: ready
updated: 2026-10-02
sources: BCHMesh/meshserver/src/strategies/templates.ts
---

The mirror image of a [take-profit ladder](mesh/strategies/take-profit): buy more the further the price falls, like dollar-cost averaging into dips.

## Pools

K bids, priced geometrically from your first (highest) to your last (lowest) price. Your BCH is split evenly. Higher steps fill first as the price falls.

## Example

Mid 3,250 sats per pUSD unit. Spend 0.009 BCH in 3 steps from −2% to −12%:

| Step | Buys at (sats per unit) | BCH |
| --- | --- | --- |
| 1 | 3,185 | 300,000 sats |
| 2 | ≈ 3,018.1 | 300,000 sats |
| 3 | 2,860 | 300,000 sats |

## Settings

| In the app | API key | Notes |
| --- | --- | --- |
| Token | `token` | |
| First buy price | `fromSatsPerToken` | the highest step |
| Last buy price | `toSatsPerToken` | the lowest step |
| Steps | `steps` | 2–10 |
| Pool fee | `feeBps` | |
| BCH | `depositSats` | split evenly; ≥ 2,000 sats per step |

## Risks

- One-way: bought tokens go to your wallet and are not sold back.
- In a crash every step fills. Size the ladder for the total you are happy to hold.
