---
title: Why solvers
description: Solvers turn resting intents into settled trades. They choose the route, pay the miner fee and keep what the fill rules allow.
status: ready
updated: 2026-09-28
sources: aqua-research/15-why-solvers-are-needed.md, MeshDocs/05-zero-inventory-solver-network.md, MeshDocs/BetaLaunch/03-v2-implementation-and-e2e-flows.md
---

An intent covenant is passive. It says what the maker must receive but can't go looking for a counterparty. A **solver** watches funded intents, finds a route that clears each one's minimum, assembles the [atomic fill](intents/settlement/fill-transaction) and broadcasts it.

## What a solver does

1. **Discover** funded intents (from the Mesh Server index, the WebSocket, or its own chain scan).
2. **Price** each intent at `locktime = MTP − 1` across Mesh pools, Cauldron and its own inventory.
3. **Build** one transaction: intent input, liquidity inputs, its own fee input; maker payout at the intent's index; pools recreated at theirs.
4. **Broadcast** and handle the race: if another solver fills first, the transaction is simply rejected.

## What a solver earns

| Source | When |
| --- | --- |
| Protocol half of surplus | When the server has no `PROTOCOL_TREASURY_PKH` configured |
| Inventory spread | Inventory fills price at reference − `SOLVER_RFQ_SPREAD_BPS` |
| Rebalancing | Buying cheap from Mesh or Cauldron and selling into intents |

A solver pays every miner fee, and takes execution risk: a stale plan or a lost race costs nothing on-chain, but capital in inventory is at market risk.

## Who can solve

Anyone. `fill()` needs no signature and there is no allow-list. The reference solver runs inside the Mesh Server; a standalone [Solver SDK](sdk/solver/overview) is planned so others can compete.

```cards
[
  { "title": "Matching & route selection", "description": "How one plan per intent is chosen each cycle.", "href": "solvers/matching", "icon": "bot" },
  { "title": "Zero-inventory fills", "description": "Filling from pools without holding the buy asset.", "href": "solvers/zero-inventory", "icon": "boxes" }
]
```
