---
title: Multi-pair quote
description: One BCH deposit bids for two or three tokens at once, each at its own price. Shared liquidity in a single pool.
status: ready
updated: 2026-10-02
sources: BCHMesh/meshserver/src/strategies/templates.ts, contracts-bch-swap/contracts/MeshPoolV3.cash
---

One BCH reserve, several markets. The pool accepts up to three tokens; whichever trader arrives first is paid from the same BCH.

## How it works

The pool has one **slot** per token, each with its own price. When a trader pays, the covenant reads which token arrived in the proceeds output and applies that slot's price. The tokens go to your wallet.

## Example

Deposit 0.02 BCH. Bid pUSD at 3,234 sats per unit and TOKX at 19.5 sats per unit, fee 0.30%.
- A trader sells 1 pUSD (100 units) and gets 322,429 sats.
- Another sells 1,000 TOKX and gets 19,441 sats.

Both are paid from the same 2,000,000 sats.

## Settings

| In the app | API key | Notes |
| --- | --- | --- |
| Tokens and prices | `tokens` | 2–3 entries of `{ token, satsPerToken }`, all different |
| Pool fee | `feeBps` | one fee for all slots |
| BCH reserve | `depositSats` | |

## When to use it

- You want to accumulate any of several tokens and don't mind which fills first.
- You want more fill opportunities from the same capital.

## Risks

- The reserve is shared. A burst of selling in one token can use up the BCH meant for the others.
- Each slot is a fixed price, like a [Fixed price](mesh/strategies/fixed) bid.
