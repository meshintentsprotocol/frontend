---
title: Strategy pools
description: StrategyCovenantV2 is a fixed-rate BCH ↔ token pool in one UTXO. Amounts are derived from the pool's own input and output, so it is paid by construction.
status: ready
updated: 2026-09-28
sources: contracts-bch-swap/contracts/StrategyCovenantV2.cash, MeshDocs/BetaLaunch/03-v2-implementation-and-e2e-flows.md
---

One UTXO is one pool. A pool pairs BCH with **one** CashToken and trades in **one direction**: exactly one of `tokenCategoryIn` / `tokenCategoryOut` is `0x` (BCH).

| Direction | `tokenCategoryIn` | `tokenCategoryOut` | Pool gives | Pool receives |
| --- | --- | --- | --- | --- |
| Sell BCH | token | `0x` | BCH | tokens |
| Sell tokens | `0x` | token | tokens | BCH |

## Constructor

```cashscript title="StrategyCovenantV2.cash"
contract StrategyCovenantV2(
    bytes20 ownerPkh,          // only this key can dock()
    bytes tokenCategoryIn,     // what the pool receives (0x = BCH)
    bytes tokenCategoryOut,    // what the pool gives   (0x = BCH)
    int priceNumerator,
    int priceDenominator,
    int feeBps                 // e.g. 30 = 0.30%
)
```

The covenant address is derived from these six values. Change any of them and you get a different pool.

## `fill()`: permissionless trading

```cashscript title="fill() (token-for-BCH branch shown)" {4,17-18,24-25}
function fill() {
    int i = this.activeInputIndex;
    // The pool lives on at the output with the same index as its input.
    require(tx.outputs[i].lockingBytecode == tx.inputs[i].lockingBytecode);

    int amountIn = 0;
    int amountOut = 0;

    if (tokenCategoryOut == 0x) {
        // Pool gives BCH, receives tokenCategoryIn.
        int tokensBefore = 0;
        if (tx.inputs[i].tokenCategory != 0x) {
            require(tx.inputs[i].tokenCategory == tokenCategoryIn);
            tokensBefore = tx.inputs[i].tokenAmount;
        }
        require(tx.outputs[i].tokenCategory == tokenCategoryIn);
        amountIn  = tx.outputs[i].tokenAmount - tokensBefore;
        amountOut = tx.inputs[i].value - tx.outputs[i].value;
        require(tx.outputs[i].value >= 1000);
    } else { /* mirror image: gives tokens, receives BCH */ }

    require(amountIn > 0);
    require(amountOut > 0);
    require(amountOut * priceDenominator * 10000
            <= amountIn * priceNumerator * (10000 - feeBps));
}
```

There is **no `amountIn` argument**. What the pool paid out and what it received are read from the difference between its input and its recreated output, so a transaction can't claim to have paid more than it did.

## `dock()`: the owner's exit

```cashscript
function dock(pubkey ownerPk, sig ownerSig) {
    require(hash160(ownerPk) == ownerPkh);
    require(checkSig(ownerSig, ownerPk));
}
```

A valid owner signature spends the pool with no other constraint: the owner takes everything.

> [!NOTE] One pool, one direction
> To quote both sides of a market, deploy two pools: one selling BCH, one selling the token. Fills against one accumulate the other asset inside that pool until you dock.
