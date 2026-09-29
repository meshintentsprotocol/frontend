---
title: Admin & route controls
description: Operator endpoints for stats, swaps, liquidity, route circuit breakers and refund sweeps. Writes require x-admin-key.
status: ready
updated: 2026-09-28
sources: BCHMesh/meshserver/src/api/routes/admin.ts
---

```endpoint
{
  "method": "POST",
  "path": "/api/v1/admin/routes/control",
  "auth": "admin",
  "summary": "Enable or disable each liquidity route. Omitted flags are left unchanged.",
  "params": [
    { "name": "x-admin-key", "in": "header", "type": "string", "required": true, "description": "Must equal the server's ADMIN_API_KEY." },
    { "name": "meshEnabled", "in": "body", "type": "boolean", "description": "Mesh pool route." },
    { "name": "cauldronEnabled", "in": "body", "type": "boolean", "description": "Cauldron route." },
    { "name": "solverEnabled", "in": "body", "type": "boolean", "description": "Solver inventory route." },
    { "name": "reason", "in": "body", "type": "string", "description": "Optional note recorded with the change." }
  ],
  "body": { "meshEnabled": true, "cauldronEnabled": false, "solverEnabled": true },
  "responses": [
    { "status": 200, "body": { "success": true, "message": "Routing flags updated successfully", "routes": { "meshEnabled": true, "cauldronEnabled": false, "solverEnabled": true } } },
    { "status": 401, "body": { "error": "Missing or invalid x-admin-key" } },
    { "status": 503, "description": "The server has no ADMIN_API_KEY, so admin writes are disabled.", "body": { "error": "Admin API disabled: ADMIN_API_KEY is not configured on this server" } }
  ]
}
```

## Read endpoints

| Endpoint | Returns |
| --- | --- |
| `GET /api/v1/admin/stats` | Totals: intents, fills, volume |
| `GET /api/v1/admin/swaps` · `/swaps/:id` | Swap history and detail |
| `GET /api/v1/admin/solver` | Solver wallet and recent cycles |
| `GET /api/v1/admin/cauldron` · `/cauldron-quote` | Cauldron pool cache and a test quote |
| `GET /api/v1/admin/mesh-pools` | Pool index with reserves |
| `GET /api/v1/admin/liquidity` | Liquidity by route and pair |
| `GET /api/v1/admin/routes/status` | Route flags |
| `GET /api/v1/admin/refunds` | Refund engine state |

## Write endpoints (`x-admin-key`)

| Endpoint | Effect |
| --- | --- |
| `POST /routes/control` | Set route flags |
| `POST /routes/pause-mesh` · `/resume-mesh` | Toggle Mesh |
| `POST /routes/pause-cauldron` · `/resume-cauldron` | Toggle Cauldron |
| `POST /routes/pause-solver` · `/resume-solver` | Toggle inventory |
| `POST /refunds/sweep` | Run the refund engine now (`admin` trigger) |
| `POST /trigger-match` | Run a matcher cycle |
| `POST /api/v1/intent/match { broadcast: true }` | Run and broadcast a real solver cycle |

```screenshot
{ "src": "/docs/screenshots/admin-routes.png", "url": "/admin", "caption": "The admin dashboard's route controls call these endpoints." }
```
