---
title: Mesh vs pooled AMMs
description: How isolated strategy covenants compare with pooled AMMs like Cauldron and shared-liquidity designs on EVM.
status: ready
updated: 2026-09-28
sources: MeshDocs/README.md, aqua-research/13-cauldron-vs-aqua-vs-our-bch-mesh.md
---

| | Pooled AMM (Cauldron) | EVM shared liquidity (1inch Aqua) | BCHMesh |
| --- | --- | --- | --- |
| Custody | Pool UTXO shared by the curve | Stays in wallet, virtual balances | Isolated covenant UTXO per position |
| Fee destination | The pool | The filled strategy | 100% to the filled pool |
| Pricing | Constant product `x · y = k` | Strategy-defined | Fixed rate per pool |
| Pairs | BCH ↔ token | Any ERC-20 pair | BCH ↔ token per pool; routes compose |
| Reconfigure | Withdraw and redeposit | One call per change, gas each | One transaction for many positions |
| Reentrancy | None (UTXO) | Must be guarded | None (UTXO, no cross-script calls) |
| Exit | Spend the pool | Revoke approval | `dock()` with one signature |

## When each wins

- **Cauldron** gives continuous depth at every price with no LP management, at the cost of curve slippage.
- **Mesh** gives exact prices and full fee capture for LPs who want to quote a level, like a resting limit order that anyone can hit.

The router uses both: [Mesh first, then Cauldron](mesh/routing/tri-route), in the same atomic transaction when needed.

## Rebalancing cost

On BCH a transaction is priced by bytes, so docking N positions and opening N new ones fits in one transaction whose fee grows slowly with N. On EVM each position change is a separate state write.

```chart rebalance-cost
```
