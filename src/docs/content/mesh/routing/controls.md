---
title: Route controls
description: Pause and resume each liquidity route at runtime. Fills stop; refunds never do.
status: ready
updated: 2026-09-28
sources: BCHMesh/meshserver/src/api/routes/admin.ts, MeshDocs/BetaLaunch/03-v2-implementation-and-e2e-flows.md
---

Operators can switch each route of the [tri-route engine](mesh/routing/tri-route) on or off without a restart. All writes need the `x-admin-key` header.

| Endpoint | Effect |
| --- | --- |
| `GET /api/v1/admin/routes/status` | Current flags |
| `POST /api/v1/admin/routes/control` | Set any of `{ meshEnabled, cauldronEnabled, solverEnabled }` |
| `POST /api/v1/admin/routes/pause-mesh` · `resume-mesh` | Toggle Mesh |
| `POST /api/v1/admin/routes/pause-cauldron` · `resume-cauldron` | Toggle Cauldron |
| `POST /api/v1/admin/routes/pause-solver` · `resume-solver` | Toggle solver inventory |

```bash
curl -X POST "$MESH_URL/api/v1/admin/routes/control" \
  -H "x-admin-key: $ADMIN_KEY" -H "Content-Type: application/json" \
  -d '{ "meshEnabled": true, "cauldronEnabled": false, "solverEnabled": true }'
```

## Behaviour

- Pausing a route removes it from the matcher's plan on the next cycle.
- Pausing **all three** makes every intent `unfillable`. Resuming lets them fill (verified live as test F7).
- The refund engine is independent: expired intents are refunded whatever the route flags say.
