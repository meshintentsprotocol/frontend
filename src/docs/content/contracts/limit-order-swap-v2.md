---
title: LimitOrderSwapV2
description: Fixed-price intent covenant. Permissionless fill that must pay the maker at its own output index; permissionless refund after expiry; maker-signed early exit.
status: ready
updated: 2026-09-28
sources: contracts-bch-swap/contracts/LimitOrderSwapV2.cash
---

## Constructor

| Arg | Type | Meaning |
| --- | --- | --- |
| `makerPkh` | `bytes20` | Receives the payout and every refund |
| `sellTokenCategory` | `bytes` | `0x` for BCH, else the token category |
| `buyTokenCategory` | `bytes` | `0x` for BCH, else the token category |
| `sellAmount` | `int` | The UTXO must hold at least this to be fillable |
| `buyAmount` | `int` | Covenant minimum |
| `expiryTime` | `int` | Chain time (unix seconds, MTP) |

Arguments are identical to V1, so clients can rebuild the contract from the same order record.

## `fill()`

```cashscript
function fill() {
    require(tx.locktime >= 500000000);           // locktime is a timestamp
    require(tx.locktime < expiryTime);

    int i = this.activeInputIndex;
    // The intent UTXO must hold the full order.
    if (sellTokenCategory == 0x) {
        require(tx.inputs[i].value >= sellAmount);
    } else {
        require(tx.inputs[i].tokenCategory == sellTokenCategory);
        require(tx.inputs[i].tokenAmount >= sellAmount);
    }
    require(tx.outputs[i].lockingBytecode == new LockingBytecodeP2PKH(makerPkh));

    if (buyTokenCategory == 0x) {
        require(tx.outputs[i].value >= buyAmount);
    } else {
        require(tx.outputs[i].tokenCategory == buyTokenCategory);
        require(tx.outputs[i].tokenAmount >= buyAmount);
        require(tx.outputs[i].value >= 1000);
    }
}
```

No signature and no input-count limit. The sell asset is released to whoever builds the transaction; the maker only cares that output `i` pays them.

## `cancel()`

Permissionless once `tx.time ≥ expiryTime`. Output `i` must pay `makerPkh` at least the input's value, the same token category and at least the input's token amount.

## `cancelEarly(pubkey makerPk, sig makerSig)`

Maker-signed, any time. Same refund constraints as `cancel()`.

## Invariants

| Invariant | Enforced by |
| --- | --- |
| Maker receives ≥ `buyAmount` on fill | `outputs[i]` checks |
| One payout can't satisfy two intents | Index binding |
| Underfunded UTXOs can't be filled | Input amount checks |
| Refunds return everything | `≥ input` checks on value and tokens |
