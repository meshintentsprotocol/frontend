---
title: Mesh overview
description: Mesh is the protocol's liquidity layer. Each LP position is its own covenant UTXO at a fixed price, owned and exited by a single key.
status: ready
updated: 2026-09-28
sources: MeshDocs/README.md, MeshDocs/01-overview-and-core-concepts.md, MeshDocs/BetaLaunch/03-v2-implementation-and-e2e-flows.md
---

Pooled AMMs put every LP's capital into one shared contract and pay fees pro-rata. Mesh does the opposite: **every position is an isolated UTXO** locked by a `StrategyCovenantV2` covenant. A fill that trades against your pool pays your pool, and only you can take the money out.

```screenshot
{ "src": "/docs/screenshots/mesh-pools.png", "url": "/mesh", "caption": "The Mesh page lists live strategy pools and your positions." }
```

## Properties

| | Mesh strategy pool |
| --- | --- |
| Custody | One UTXO, covenant-locked; only the owner key can `dock()` |
| Fees | 100% to the pool that was traded against |
| Pricing | Fixed rate: `priceNumerator / priceDenominator` minus `feeBps` |
| Pairs | BCH ↔ one CashToken, one direction per pool |
| Exit | One owner signature returns everything |
| Discovery | Server indexes registered pools; appears in `/quote`, `/orderbook`, `/positions` |

## How pools get used

Pools are passive. They never move on their own. Solvers (the Mesh Server's matcher, or anyone else) include a pool in an [atomic fill](intents/settlement/fill-transaction) when its price clears an intent's minimum. The pool covenant checks only one thing: **it was paid at least its price for what it released**.

```diagram tri-route
```

Mesh is always tried first. Cauldron and solver inventory are fallbacks, so fee volume stays with Mesh LPs whenever they can serve the order.

```cards
[
  { "title": "Strategy pools", "description": "The covenant, its parameters and the two spend paths.", "href": "mesh/pools/strategy-pools", "icon": "contract" },
  { "title": "Pool lifecycle", "description": "Configure, fund, register, trade and dock.", "href": "mesh/pools/lifecycle", "icon": "network" },
  { "title": "Pricing math", "description": "Exactly how much a pool releases for a given input.", "href": "mesh/pools/pricing", "icon": "code" },
  { "title": "Security model", "description": "What the covenant guarantees and what it doesn't.", "href": "mesh/security", "icon": "shield" }
]
```
