---
title: Fixed price
description: One pool at one price. A bid holds BCH and buys a token; an ask holds the token and sells it for BCH. Proceeds go to your wallet.
status: ready
updated: 2026-10-02
sources: BCHMesh/meshserver/src/strategies/templates.ts, contracts-bch-swap/contracts/MeshPoolV3.cash
---

The simplest strategy: a standing limit order that many traders can fill in parts, until it runs out.

## Pools

| Side | Pool holds | Accepts | Proceeds |
| --- | --- | --- | --- |
| **Bid** | BCH | the token, at your price | tokens → your wallet |
| **Ask** | the token | BCH, at your price | BCH → your wallet |

## Example

pUSD trades at 3,250 sats per base unit (1 pUSD ≈ 325,000 sats).

**Bid at −0.5%** (3,234 sats per unit), fee 0.30%, deposit 0.01 BCH:
- A trader sells 1 pUSD (100 units) and receives up to 100 × 3,234 × 0.997 = **322,429 sats**.
- The pool keeps the rest; the 100 units go to your wallet.
- The pool can pay out up to 999,000 sats in total (it keeps 1,000).

**Ask at +0.5%** (3,266 sats per unit), deposit 3 pUSD:
- A trader buying 1 pUSD pays at least 100 × 3,266 / 0.997 = **327,583 sats**, straight to your wallet.

## Settings

| In the app | API key | Notes |
| --- | --- | --- |
| Token | `token` | CashToken category |
| Side | `side` | `bid` or `ask` |
| Price | `satsPerToken` | sats per token base unit |
| Pool fee | `feeBps` | default 30 (0.30%) |
| Deposit | `deposit` | sats for a bid, token base units for an ask |

## When to use it

- You want to buy or sell at one exact price and don't mind waiting.
- You want a simple, transparent first pool.

## Risks

- If the market moves through your price, you are filled at your price. A bid keeps buying a falling token.
- Filled amounts leave the pool to your wallet; nothing is refilled. To keep liquidity working, see [Recycling pair](mesh/strategies/recycling-pair).

## API

```json
POST /api/v1/strategies/preview
{ "template": "fixed", "ownerPkh": "<40 hex>",
  "params": { "token": "<pUSD category>", "side": "bid", "satsPerToken": "3234", "feeBps": 30, "deposit": "1000000" } }
```
