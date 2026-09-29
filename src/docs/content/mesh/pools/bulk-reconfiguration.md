---
title: Bulk reconfiguration
description: Close N positions and open M new ones in a single transaction, paid by the byte.
status: draft
updated: 2026-09-28
sources: MeshDocs/04-atomic-bulk-reconfiguration.md, BCHMesh/meshserver/src/api/routes/rebalance.ts
---

Because every pool is a UTXO and `dock()` only needs the owner's signature, an LP can spend many pools and create many new ones in **one** transaction. When price moves, you reprice your whole grid atomically instead of one position at a time.

```text title="One transaction: dock 10, open 12"
IN  [0..9]   old pools S1…S10    dock(ownerPk, sig)
IN  [10]     LP wallet UTXO      miner fee
OUT [0..11]  new pools N1…N12    new price / fee / pair
OUT [12]     LP change
```

A transaction like this (11 inputs, 13 outputs) is about 4.5 KB, so at 1 sat/byte it costs about 4,500 sats.

```chart rebalance-cost
```

## Rules

- Each old pool needs its own owner signature.
- New pools are ordinary `StrategyCovenantV2` outputs; register them with `POST /positions/batch` after broadcast.
- Nothing about the new pools is constrained by the old ones: pair, price, fee and size can all change.

## To document

- `POST /api/v1/rebalance/quote` request and response
- Building the transaction with CashScript's `TransactionBuilder`
- Dynamic mid-way expansion: adding a new pair without closing positions
