---
title: Cauldron integration
description: How the router prices and spends live Cauldron AMM pools inside an atomic fill.
status: planned
updated: 2026-09-28
sources: MeshDocs/intentsrouter/01-cauldron-protocol-research.md, MeshDocs/intentsrouter/07-contract-to-contract-and-cauldron-composability.md, BCHMesh/meshserver/src/cauldron
---

## Outline

1. Cauldron V0 pool script and the K invariant
2. Pool discovery and on-chain verification
3. Pricing with @cashlab/cauldron
4. Multi-pool legs and the waterfall split
5. Direct Cauldron trades (build-trade)
