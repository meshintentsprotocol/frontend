---
title: Authentication
description: Public endpoints need no auth. Admin writes require the x-admin-key header, and are disabled entirely when no key is configured.
status: ready
updated: 2026-09-28
sources: BCHMesh/meshserver/src/api/middleware/adminAuth.ts
---

## Public by design

Quotes, intent creation, status, refunds, pools and market data are public. None of them can move funds in a way the covenants don't allow:

- `POST /intent/:id/refund` can only trigger `cancel()`, which pays the maker, after the deadline.
- `POST /intent/:id/cancel` and `POST /positions/dock` only re-read the chain.
- `POST /positions` verifies the pool on-chain before indexing it.

## Admin key

Admin writes (route controls, refund sweeps, manual fill records, broadcasting a solver cycle) require:

```http
x-admin-key: <ADMIN_API_KEY>
```

| Server config | Behaviour |
| --- | --- |
| `ADMIN_API_KEY` set | Writes with the right key succeed; wrong or missing key → `401` |
| `ADMIN_API_KEY` unset | **All admin writes are disabled** → `503` |

> [!DANGER]
> Never ship the admin key to a browser. Call admin endpoints from a backend or an operator's terminal only.
