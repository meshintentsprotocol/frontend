---
title: StrategyCovenantV2
description: Fixed-rate Mesh pool covenant. Payment-enforced fills with amounts derived from the pool's own input and output; owner-only dock.
status: ready
updated: 2026-09-28
sources: contracts-bch-swap/contracts/StrategyCovenantV2.cash
---

## Constructor

| Arg | Type | Meaning |
| --- | --- | --- |
| `ownerPkh` | `bytes20` | The only key that can `dock()` |
| `tokenCategoryIn` | `bytes` | Asset the pool receives (`0x` = BCH) |
| `tokenCategoryOut` | `bytes` | Asset the pool gives (`0x` = BCH) |
| `priceNumerator` | `int` | Price numerator |
| `priceDenominator` | `int` | Price denominator |
| `feeBps` | `int` | Fee in basis points |

Exactly one of `tokenCategoryIn` / `tokenCategoryOut` is `0x`.

## `fill()`

| Check | Why |
| --- | --- |
| `outputs[i].lockingBytecode == inputs[i].lockingBytecode` | Pool is recreated at its own index |
| Derive `amountIn`, `amountOut` from input vs. output | Payment can't be faked by an argument |
| `amountIn > 0`, `amountOut > 0` | No zero-value or reverse trades |
| `amountOut · den · 10000 ≤ amountIn · num · (10000 − fee)` | Price and fee, rounded for the pool |
| BCH-out pools keep `≥ 1000` sats | Output stays valid |
| Token-out pools keep the token category | At least 1 token remains; the LP docks the rest |

Full walkthrough with code: [Strategy pools](mesh/pools/strategy-pools).

## `dock(pubkey ownerPk, sig ownerSig)`

`hash160(ownerPk) == ownerPkh` and a valid signature. No output constraints.

## What V2 fixed

V1 took a caller-supplied `amountIn` and checked fixed output positions. V2 derives amounts from the pool's own UTXO change and binds the recreated output to the pool's input index, so a pool is paid by construction and two pools can't share one recreated output.
