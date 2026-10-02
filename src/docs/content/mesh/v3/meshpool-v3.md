---
title: MeshPoolV3 pools
description: One covenant for every V3 pool. It keeps only its reserve, sends what it receives to a proceeds output, and can quote up to three assets.
status: ready
updated: 2026-10-02
sources: contracts-bch-swap/contracts/MeshPoolV3.cash, BCHMesh/meshserver/src/pools/v3/v3Contracts.ts, MeshDocs/AlphaV3/02-covenant.md
---

Every Mesh V3 pool, and every pool a [strategy](mesh/strategies/overview) creates, is a `MeshPoolV3` UTXO. The pool holds one asset, its **reserve** (BCH or one CashToken), and sells it at prices you fixed when you created it.

## The idea: proceeds leave the pool

A V2 pool kept what traders paid inside its own UTXO. A V3 pool does not. When it is filled:

1. **The reserve is recreated** at the same output index, with the same script. What it lost is `amountOut`.
2. **The payment goes to a proceeds output** at index `i + number of inputs`, where `i` is the pool's own input index. What arrived there is `amountIn`.
3. **The price is checked** against the slot of the asset that arrived:

```text
amountOut · den · 10000  ≤  amountIn · num · (10000 − feeBps)
```

Because the payment never sits in the pool, one reserve can accept **several assets**: a UTXO can carry only one token category, but proceeds outputs can be anything. The same trick makes **token↔token** pools possible. And because each pool's proceeds index is unique, **several pools can be filled in one transaction**: that is how one large order is split across many pools.

## Slots: what the pool accepts

A pool has 1–3 **slots**. Each slot is one accepted asset and its price:

| Field | Meaning |
| --- | --- |
| `cat` | the asset the pool accepts (`0x` = BCH) |
| `num / den` | reserve units given per unit received, before the fee |
| `rNum / rDen` | the price the **mirror** pool uses (mirror mode only) |

A pool can't accept its own reserve asset, and each slot must be a different asset.

## Where proceeds go

| Mode | Proceeds go to | Use |
| --- | --- | --- |
| 0 · owner | your wallet (P2PKH) | take the result home: sell a token, buy a token |
| 1 · fixed pool | one other pool, by script hash | feed a specific pool, one way |
| 2 · mirror | the **reverse pool**, rebuilt on-chain from this pool's own script | recycling: buy low → sell high → buy low … |

In mirror mode, what a bid receives (tokens) opens an ask at your sell price, and what that ask receives (BCH) flows back into the bid. The mirror of the mirror is the original pool, so the loop needs no stored address. See [Recycling](mesh/pools/recycling).

## Owner control

`dock()` spends the pool with your signature and no other rules. Use it to withdraw, reprice or rebalance. Nobody else can call it.

## Limits

- A BCH reserve keeps at least **1000 sats** after every fill. Strategy templates require **2000 sats** per BCH pool.
- A token reserve needs at least **2 base units** and carries **1000 sats**, which fills can't take.
- Mutable and minting NFTs are refused as payment. An immutable NFT riding along is ignored; the price uses the fungible amount.
- The redeem script is 842 bytes and needs the BCH 2025 VM limits (live since May 2025).

## Safety

The covenant has **no amount arguments**: every amount is read from the transaction itself, so a filler can't claim to have paid more than they did. The VM security suite (38 checks) covers underpaying by one unit, redirecting proceeds, paying in the wrong asset, NFT tricks, carrier-sat leaks and attacker docks. See [Security model](mesh/security).
