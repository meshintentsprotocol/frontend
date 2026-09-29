---
title: The atomic fill
description: Every fill, whatever the liquidity source, is one transaction with a fixed input/output layout that the covenants enforce by index.
status: ready
updated: 2026-09-28
sources: MeshDocs/BetaLaunch/03-v2-implementation-and-e2e-flows.md, BCHMesh/meshserver/src/solver/fillExecutor.ts
---

```diagram fill-transaction
```

## Layout

```text title="Fill transaction"
IN  [0]      intent V2           fill()            → OUT [0]      maker payout ≥ covenant minimum
IN  [1..k]   liquidity source:
               Mesh pool         fill()            → OUT [1]      pool recreated: +amountIn, −gross
               Cauldron pool(s)  (no signature)    → OUT [1..k]   pools recreated (K invariant)
               solver inventory  —                   (no source outputs)
IN  [k+1..]  solver P2PKH        fee (+ buy asset for inventory)
OUT [k+1..]  treasury share · frontend share · leftover supply → maker · solver token change · solver BCH change
```

## Why index binding matters

Both V2 intent covenants and `StrategyCovenantV2` check **the output at their own input index** (`outputs[this.activeInputIndex]`):

- An intent at input 0 is paid at output 0. A second intent at input 2 must be paid at output 2. One payout output can never satisfy two intents.
- A pool at input 1 must be recreated at output 1, so two pool inputs can't "share" one recreated output.

This closed the V1 drain class, where a covenant checked a fixed output position and a crafted transaction could satisfy several covenants with one output.

## Sources of the maker's payout

| Route | Where the buy asset comes from | Extra inputs |
| --- | --- | --- |
| `MESH_POOL` | A `StrategyCovenantV2` pool releases it; receives the sell asset | Pool UTXO |
| `CAULDRON` | One or more Cauldron V0 pools, priced with `@cashlab/cauldron` | Pool UTXO(s), no signature |
| `SOLVER_INVENTORY` | The solver's own wallet | Solver P2PKH inputs holding the buy asset |

In every case the solver's P2PKH input pays the miner fee. The executor sizes the fee from the **serialized** transaction and serializes all spends from the solver wallet so two fills never race for the same coin.

## Locktime

Fills set `nLocktime = MTP − 1`. Consensus requires `locktime < MTP` for a transaction to be final (`locktime = MTP` is rejected as `bad-txns-nonfinal`), and the intent covenant reads `tx.locktime` as "now" for its expiry and Dutch decay.
