---
title: Rebalance quote
description: Plan a bulk reconfiguration that docks several positions and opens new ones in one transaction.
status: draft
updated: 2026-09-28
sources: BCHMesh/meshserver/src/api/routes/rebalance.ts, MeshDocs/04-atomic-bulk-reconfiguration.md
---

`POST /api/v1/rebalance/quote` computes the inputs and outputs for a one-transaction LP reconfiguration: the positions to dock and the new pools to open, with an estimated size and fee.

See [Bulk reconfiguration](mesh/pools/bulk-reconfiguration) for the transaction shape and cost model.

## To document

- Request body (positions to close, target grid)
- Response (planned inputs/outputs, bytes, fee)
- Signing: one `dock()` signature per closed pool
