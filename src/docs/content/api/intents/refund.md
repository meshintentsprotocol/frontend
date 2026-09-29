---
title: Request a refund
description: Trigger the refund engine for one expired intent. Safe to expose publicly.
status: ready
updated: 2026-09-28
sources: BCHMesh/meshserver/src/api/routes/intent.ts, BCHMesh/meshserver/src/solver/refundSweeper.ts
---

Refunds happen automatically (timer, new block, boot). This endpoint lets anyone ask for one immediately. It's safe to expose because `cancel()` can only pay the maker, and only after the covenant deadline.

```endpoint
{
  "method": "POST",
  "path": "/api/v1/intent/:id/refund",
  "params": [
    { "name": "id", "in": "path", "type": "string", "required": true, "description": "Intent id.", "example": "a3f1…" }
  ],
  "responses": [
    { "status": 200, "description": "Refund broadcast.", "body": { "status": "SUCCESS", "txid": "77aa…", "intent": { "id": "a3f1…", "status": "refunded" } } },
    { "status": 425, "description": "Not eligible yet (or already settled, or never funded).", "body": { "status": "NOT_ELIGIBLE", "refundEligibleAt": 1790007200, "error": "…" } },
    { "status": 502, "description": "Broadcast failed; the engine retries on the next trigger.", "body": { "status": "FAILED", "error": "…" } }
  ]
}
```

See [Refunds & cancellation](intents/settlement/refunds) for every trigger.
