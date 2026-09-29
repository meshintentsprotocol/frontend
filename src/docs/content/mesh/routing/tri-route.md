---
title: Tri-route engine
description: For every intent, the matcher tries Mesh pools, then Cauldron, then solver inventory, and fills with the first route that clears the covenant minimum.
status: ready
updated: 2026-09-28
sources: MeshDocs/BetaLaunch/03-v2-implementation-and-e2e-flows.md, BCHMesh/meshserver/src/solver/matcher.ts, MeshDocs/intentsrouter/README.md
---

```diagram tri-route
```

## Order of preference

| Priority | Route | Chosen when | `fillMethod` |
| --- | --- | --- | --- |
| 1 | Mesh pool | The best `StrategyCovenantV2` pool's output ≥ minimum and within its reserve | `MESH_POOL` |
| 2 | Cauldron | Live Cauldron pools' output ≥ minimum | `CAULDRON` |
| 3 | Solver inventory | Enabled, and the solver's price (reference − `SOLVER_RFQ_SPREAD_BPS`) ≥ minimum, size ≤ `SOLVER_MAX_FILL_SATS` | `SOLVER_INVENTORY` |
| — | None | No route clears | `intent:unfillable` with per-route reasons |

Mesh wins ties by construction: it is asked first. That keeps fee volume with Mesh LPs whenever they can serve the order, and uses Cauldron's continuous depth only as overflow.

## One plan per intent per cycle

Each solver cycle the matcher:

1. Reads the final locktime `MTP − 1` and computes each intent's covenant minimum at that time.
2. Asks each enabled route for its output at the intent's size.
3. Picks the first route whose output clears the minimum, and computes the surplus split.
4. Hands the plan to the fill executor, which builds and broadcasts the [atomic fill](intents/settlement/fill-transaction).

## Why Mesh then Cauldron

| | Mesh | Cauldron |
| --- | --- | --- |
| Price | Exact, set by the LP | Curve: worsens with size |
| Fees go to | The pool's owner | The Cauldron pool |
| Depth | Discrete levels | Continuous |

## Quote splits

`POST /api/v1/quote` also reports how a trade would split between the two venues (`meshPct`, `cauldronPct`, `routeReason`), which the swap UI shows as a split meter.

```screenshot
{ "src": "/docs/screenshots/orderbook.png", "url": "/orderbook", "caption": "Mesh depth on the orderbook: each level is one or more strategy pools." }
```

> [!INFO] Circuit breakers
> Each route can be paused independently at runtime. See [Route controls](mesh/routing/controls).
