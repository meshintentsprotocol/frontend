---
title: Errors
description: HTTP status codes the Mesh Server returns and how to handle each.
status: ready
updated: 2026-09-28
sources: BCHMesh/meshserver/src/api/routes
---

Errors use a single shape:

```json
{ "error": "Required fields: tokenIn, tokenOut, amountIn" }
```

Some endpoints add context (for example `howToExit` on a `409` cancel, or `refundEligibleAt` on a `425` refund).

| Status | Meaning | Typical cause | What to do |
| --- | --- | --- | --- |
| `400` | Bad request | Missing field, non-integer amount, V1 pool, bad `ownerPkh` length | Fix the request |
| `401` | Unauthorized | Missing or wrong `x-admin-key` | Admin endpoints only |
| `404` | Not found | Unknown intent id; no route for a quote; pool outpoint not unspent at its address | Check ids, try another size |
| `409` | Conflict | Cancel or dock requested while the covenant UTXO is still live | Broadcast the signed spend first |
| `425` | Too early | Manual refund before the covenant deadline | Retry after `refundEligibleAt` |
| `500` | Server error | Unexpected failure | Retry with backoff; report if persistent |
| `502` | Upstream error | Chain lookup or broadcast failed | Retry; the chain may be lagging |
| `503` | Disabled | Admin write on a server with no `ADMIN_API_KEY` | Configure the key server-side |

> [!TIP]
> `404` from `POST /quote` is normal: it means no venue has liquidity for that pair and size right now, not that the endpoint is wrong.
