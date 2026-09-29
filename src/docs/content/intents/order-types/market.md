---
title: Market orders
description: Swap now at the quoted price, protected by a slippage floor.
status: draft
updated: 2026-09-28
sources: BCHMesh/meshserver/src/api/routes/intent.ts, MeshDocs/intentsrouter/marketordersplit/README.md
---

The create endpoint accepts `orderType: "market"`. Today a market order is a short-lived intent whose minimum is the quote minus the user's slippage tolerance, so it fills on the next solver cycle or refunds.

## Recommended flow

1. `POST /api/v1/quote` for the pair and size.
2. Set the minimum to `amountOut × (1 − slippage)`.
3. Create the intent with a short `duration` (a few blocks).
4. Fund, then watch for `intent:filled`.

## Planned

- Waterfall split across Mesh and Cauldron inside a single market fill (`meshPct` / `cauldronPct` from the quote).
- Direct Cauldron trades via `POST /api/v1/cauldron/build-trade` for sizes Mesh can't serve.
