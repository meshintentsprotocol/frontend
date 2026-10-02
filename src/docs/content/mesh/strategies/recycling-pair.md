---
title: Recycling pair
description: Buy low, sell high, repeatedly. One pool in mirror mode; each fill opens the reverse pool, which trades the proceeds back. Liquidity stays in Mesh.
status: ready
updated: 2026-10-02
sources: BCHMesh/meshserver/src/strategies/templates.ts, contracts-bch-swap/contracts/MeshPoolV3.cash, MeshDocs/AlphaV3/02-covenant.md
---

A recycling pair is a buy order and a sell order that **keep turning into each other**. You fund one pool; traders do the rest.

## How the loop works

1. You fund the **buy** pool with BCH. It buys the token at your buy price.
2. When a trader sells tokens to it, the covenant sends those tokens to the **mirror** pool: an ask at your sell price, same owner and fee. The covenant rebuilds the mirror's address from its own script, so nothing is stored.
3. When a trader buys from the mirror, the BCH goes back into the buy pool: the mirror of the mirror is the original.
4. Repeat. Every round trip earns the buy–sell gap plus the fee on both legs.

Start with the token instead (`start: token`) and the loop begins with the sell.

## Example

Mid 3,250 sats per pUSD unit. Buy at 3,217.5 (−1%), sell at 3,282.5 (+1%), fee 0.30%, deposit 0.01 BCH.

| Step | Trade | Buy pool (BCH) | Mirror (pUSD) |
| --- | --- | --- | --- |
| start | | 1,000,000 sats | none |
| 1 | a trader sells 3 pUSD, gets 962,349 sats | 37,651 | 300 units |
| 2 | a trader buys 2.99 pUSD for 984,423 sats | **1,022,074** | 1 unit |

After one round trip the position is up **22,074 sats (≈ 2.2%)**, plus 1 unit, and it is ready to go again. Nothing was withdrawn or re-deposited.

## Settings

| In the app | API key | Notes |
| --- | --- | --- |
| Token | `token` | |
| Buy price | `buySatsPerToken` | below the sell price |
| Sell price | `sellSatsPerToken` | above the buy price |
| Start with | `start` | `bch` (buy first) or `token` (sell first) |
| Pool fee | `feeBps` | |
| Deposit | `deposit` | sats for `bch`, token base units for `token` |

## When to use it

- You expect the price to oscillate in a range.
- You want your liquidity to stay in Mesh instead of piling up in your wallet.

## Risks

- **Range risk.** If the price leaves the range and stays out, the loop stops. You hold all token (price fell) or all BCH (price rose). Re-centre with a rebalance.
- **Profit stays inside the pools** until you withdraw (dock) them.
- One base unit always stays in a token pool.

See also [Recycling](mesh/pools/recycling) and [Grid](mesh/strategies/grid).
