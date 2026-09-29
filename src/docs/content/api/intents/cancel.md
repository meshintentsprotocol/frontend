---
title: Cancel an intent
description: Report a maker's on-chain cancellation. The server re-reads the covenant and never cancels on request.
status: ready
updated: 2026-09-28
sources: BCHMesh/meshserver/src/api/routes/intent.ts
---

Cancellation is an **on-chain** action. For a limit order the maker signs `cancelEarly(makerPk, makerSig)` using the intent's `contractName` and `constructorArgs` and broadcasts it. Then call this endpoint so the index reflects it.

```endpoint
{
  "method": "POST",
  "path": "/api/v1/intent/:id/cancel",
  "params": [
    { "name": "id", "in": "path", "type": "string", "required": true, "description": "Intent id.", "example": "a3f1…" },
    { "name": "txid", "in": "body", "type": "string", "description": "Optional: the cancel transaction id." }
  ],
  "body": { "txid": "e41c…" },
  "responses": [
    { "status": 200, "description": "Covenant is spent; the intent is closed.", "body": { "success": true, "id": "a3f1…", "status": "cancelled" } },
    {
      "status": 409,
      "description": "The covenant UTXO is still live.",
      "body": {
        "success": false,
        "error": "Covenant UTXO is still unspent on-chain",
        "howToExit": "Sign cancelEarly(makerPk, makerSig) with contractName/constructorArgs, then POST this endpoint again",
        "status": "active"
      }
    },
    { "status": 404, "body": { "error": "Intent a3f1… not found" } },
    { "status": 502, "body": { "error": "chain lookup failed: …" } }
  ]
}
```

Dutch auctions and TWAP slices have no early exit. For them, `howToExit` gives the automatic refund time.
