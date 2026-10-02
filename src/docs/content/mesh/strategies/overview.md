---
title: How strategies work
description: A strategy is a set of MeshPoolV3 pools built from a template, funded in one transaction and managed as one position. Eight templates cover limit orders, market making, ranges, ladders and stable pairs.
status: ready
updated: 2026-10-02
sources: BCHMesh/meshserver/src/strategies/templates.ts, BCHMesh/meshserver/src/api/routes/strategies.ts, MeshDocs/AlphaV3/05-strategies.md
---

A **strategy** turns an idea ("buy pUSD if it dips, sell it back 2% higher") into one or more [MeshPoolV3 pools](mesh/v3/meshpool-v3).
- You choose a **template** and its settings.
- Mesh computes the pools.
- **One transaction** from your wallet funds all of them.
- They are registered together as one position, with one id (`stg-…`).

Traders never see "your strategy": they see good prices. The solver routes their orders through whichever pools pay best, yours included, and settles each fill on-chain against your pool's own rules. **Your funds never leave covenants only you can withdraw from.**

## The eight templates

| Template | You deposit | It does | Proceeds |
| --- | --- | --- | --- |
| [Fixed price](mesh/strategies/fixed) | BCH or the token | one bid or one ask at your price | wallet |
| [Spread market](mesh/strategies/spread) | BCH and the token | a bid below and an ask above the market | wallet |
| [Multi-pair quote](mesh/strategies/multi-pair) | BCH once | bids for 2–3 tokens from one reserve | wallet |
| [Stable pair](mesh/strategies/stable-pair) | either token | token↔token around a peg | wallet |
| [Recycling pair](mesh/strategies/recycling-pair) | BCH or the token | buys low, sells high, repeatedly | **recycles** |
| [Grid](mesh/strategies/grid) | BCH | 2–10 recycling pairs on a price ladder | **recycles** |
| [Take-profit ladder](mesh/strategies/take-profit) | the token | sells in steps as the price rises | wallet |
| [Accumulate ladder](mesh/strategies/accumulate) | BCH | buys in steps as the price falls | wallet |

**Recycles** means the proceeds stay in Mesh: what a pool receives opens its mirror pool, which trades it back. Profit builds up inside the pools until you withdraw. **Wallet** means each fill pays straight to your address.

## Which one?

| You expect… | And you hold… | Try |
| --- | --- | --- |
| a price to bounce in a range | BCH | [Grid](mesh/strategies/grid) or [Recycling pair](mesh/strategies/recycling-pair) |
| a price to bounce in a range | both | [Spread market](mesh/strategies/spread) |
| the price to rise and you want out | the token | [Take-profit ladder](mesh/strategies/take-profit) |
| the price to dip and you want in | BCH | [Accumulate ladder](mesh/strategies/accumulate) |
| one exact price | either | [Fixed price](mesh/strategies/fixed) |
| demand for several tokens | BCH | [Multi-pair quote](mesh/strategies/multi-pair) |
| two tokens to stay pegged | either token | [Stable pair](mesh/strategies/stable-pair) |

## Lifecycle

```text
1. Choose     template + token(s)
2. Set up     prices around the market mid (suggested for you), fee, deposits
3. Preview    the exact pools, their addresses and what each one needs
4. Deploy     one transaction funds every pool (you sign it)
5. Register   Mesh finds every pool on-chain and tracks them as one position
6. Earn       traders fill your pools; fees and the spread are yours
7. Manage     rebalance (close N pools, open M, one transaction), recycle idle liquidity, or close
```

Nothing is custodial at any step. Mesh computes and tracks; your wallet signs.

## Setting prices with the market

When you pick a token, the app asks Mesh for the **market mid**:
- the deepest Cauldron pool's price;
- otherwise the middle of the best Mesh bid and ask.

It then pre-fills prices on the right side of it, for example a grid from −5% to +5%. Every price shows how far it sits from the mid ("−1.0% vs market"), and the preview marks each pool on a price ladder.

> [!TIP]
> A bid **below** the mid and an ask **above** it is normal: that gap is what you earn. A bid above the mid pays traders more than the market, so it fills instantly and you overpay.

## How you earn

- **The pool fee** (`feeBps`) on every fill, e.g. 0.30%.
- **The spread** between where you buy and where you sell: spread markets, recycling pairs and grids earn it on every round trip.
- **Better prices than you'd get by trading yourself**: ladders sell higher and buy lower over time, instead of all at once.

Strategy pages show value, fees (24 h / 7 d / all), P&L, fills, and a **fee APR estimate** (the last 7 days of fees, annualised over the current value). Treat the APR as a rough guide: it moves with volume.

## Risks to understand

- **Fixed prices don't follow the market.** If the market moves past your price, traders fill your pools at your price. That's the point of a limit order, but in a fast move you end up with the asset that is falling. Ranges and ladders spread this risk out; they don't remove it.
- **Inventory changes.** A range strategy that started in BCH ends up holding the token if the price falls through the range, and the reverse if it rises.
- **Recycled profit stays in the pools** until you withdraw (`dock`).
- **No price feed.** V3 pools quote the prices you set. See [Oracle strategies](mesh/pools/oracle) for the status of oracle-priced pools.

## Under the hood

- Units: the app shows "1 BCH = P tokens". The API takes **sats per token base unit** (e.g. `"3250"`) and base-unit deposits.
- Minimums: 2000 sats per BCH pool; 2 base units plus 1000 carrier sats per token pool.
- API: [Strategies API](api/strategies).
