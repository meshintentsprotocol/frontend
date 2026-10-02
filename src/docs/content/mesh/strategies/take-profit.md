---
title: Take-profit ladder
description: Sell a token in steps at rising prices. Each step is its own ask; the BCH goes to your wallet.
status: ready
updated: 2026-10-02
sources: BCHMesh/meshserver/src/strategies/templates.ts
---

Scale out of a position instead of selling it all at once: the higher the price goes, the more you sell, and at better prices.

## Pools

K asks, priced geometrically from your first to your last price. Your tokens are split evenly across them. Lower steps fill first as the price rises.

## Example

Mid 3,250 sats per pUSD unit. Sell 6 pUSD in 3 steps from +2% to +12%:

| Step | Sells at (sats per unit) | Tokens |
| --- | --- | --- |
| 1 | 3,315 | 2 pUSD |
| 2 | ≈ 3,473.7 | 2 pUSD |
| 3 | 3,640 | 2 pUSD |

## Settings

| In the app | API key | Notes |
| --- | --- | --- |
| Token | `token` | |
| First sell price | `fromSatsPerToken` | the lowest step |
| Last sell price | `toSatsPerToken` | the highest step |
| Steps | `steps` | 2–10 |
| Pool fee | `feeBps` | |
| Tokens | `depositTokens` | split evenly; each step carries 1,000 sats |

## Risks

- One-way: sold tokens are not bought back. If the price falls instead, nothing fills and you keep your tokens.
- One base unit stays in each step's pool.
