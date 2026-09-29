---
title: Matching & route selection
description: What the matcher computes for each intent, how it picks a route, and how to dry-run it.
status: ready
updated: 2026-09-28
sources: BCHMesh/meshserver/src/solver/matcher.ts, BCHMesh/meshserver/src/api/routes/intent.ts, MeshDocs/BetaLaunch/03-v2-implementation-and-e2e-flows.md
---

```diagram tri-route
```

## One plan per intent

For every fillable intent, each cycle the matcher produces either a **plan** or an **unfillable reason**:

| Plan field | Meaning |
| --- | --- |
| `method` | `MESH_POOL`, `CAULDRON` or `SOLVER_INVENTORY` |
| `required` | Covenant minimum at the fill locktime |
| `gross` | What the route pays out |
| `makerPayout` | Minimum plus the user's surplus share |
| `protocolShare` · `frontendShare` · `userShare` | The [surplus split](intents/settlement/surplus) |
| `surplusMode` | `MODE_A_USER`, `MODE_B_FRONTEND` or `MODE_C_SPLIT` |
| `reason` | Why this route was chosen |

## Dry-run the matcher

`POST /api/v1/intent/match` without a body returns the plans the solver **would** execute right now, without broadcasting:

```bash
curl -X POST "$MESH_URL/api/v1/intent/match" -H "Content-Type: application/json" -d '{}'
```

```json title="200 OK"
{
  "dryRun": true,
  "matched": 1,
  "results": [{
    "intentId": "a3f1…",
    "method": "MESH_POOL",
    "required": "17000",
    "gross": "19940",
    "makerPayout": "18470",
    "protocolShare": "1470",
    "frontendShare": "0",
    "userShare": "1470",
    "surplusMode": "MODE_A_USER"
  }],
  "unfillable": []
}
```

With `{ "broadcast": true }` and an admin key it runs a real cycle.

## Selection rules

1. Compute the minimum at `MTP − 1`: fixed for limits, decayed for Dutch.
2. **Mesh:** the best-paying `StrategyCovenantV2` pool whose output clears the minimum within its reserve.
3. **Cauldron:** otherwise, live Cauldron pools whose output clears it.
4. **Inventory:** otherwise, if enabled, the solver's own quote (reference − spread, size capped).
5. Otherwise emit `intent:unfillable` with each route's reason.

Paused routes are skipped. See [Route controls](mesh/routing/controls).
