---
title: Create an intent
description: Compute a V2 intent covenant for a limit or Dutch order and get the funding instructions.
status: ready
updated: 2026-09-28
sources: BCHMesh/meshserver/src/api/routes/intent.ts, BCHMesh/meshserver/src/intents/createIntent.ts, BCHMesh/meshserver/src/intents/format.ts
---

Creating an intent moves no funds. The server computes the covenant, stores its exact constructor arguments and returns where to send the sell asset. The intent becomes fillable once that UTXO is seen on-chain.

```endpoint
{
  "method": "POST",
  "path": "/api/v1/intent/create",
  "summary": "Covenant times are chain time (MTP): the order is fillable immediately after funding and refundable `duration` seconds later.",
  "params": [
    { "name": "orderType", "in": "body", "type": "\"limit\" | \"dutch\" | \"market\"", "required": true, "description": "Selects LimitOrderSwapV2 or DutchAuctionSwapV2." },
    { "name": "makerAddress", "in": "body", "type": "string", "required": true, "description": "Cashaddr that receives the payout and refunds. Or pass makerPkh." },
    { "name": "sellToken", "in": "body", "type": "string", "required": true, "description": "0x for BCH, or a token category." },
    { "name": "buyToken", "in": "body", "type": "string", "required": true, "description": "0x for BCH, or a token category." },
    { "name": "sellAmount", "in": "body", "type": "string", "required": true, "description": "Base units the maker will lock." },
    { "name": "buyAmount", "in": "body", "type": "string", "description": "Limit: the covenant minimum. Dutch: used as startBuyAmount if that is omitted." },
    { "name": "startBuyAmount", "in": "body", "type": "string", "description": "Dutch: minimum at the start of the window." },
    { "name": "endBuyAmount", "in": "body", "type": "string", "description": "Dutch: minimum at the end. Defaults to 98% of start." },
    { "name": "duration", "in": "body", "type": "number", "description": "Seconds. Default 3600." },
    { "name": "expiryTime", "in": "body", "type": "number", "description": "Limit only: absolute unix expiry instead of duration." },
    { "name": "frontendPkh", "in": "body", "type": "string", "description": "20-byte hex. Receives the frontend share of surplus." },
    { "name": "userSurplusShareBps", "in": "body", "type": "number", "description": "0–10000. Share of the partner half that goes to the user." }
  ],
  "body": {
    "orderType": "limit",
    "makerAddress": "bchtest:qr…",
    "sellToken": "<pUSD category>",
    "buyToken": "0x",
    "sellAmount": "10",
    "buyAmount": "17000",
    "duration": 3600,
    "userSurplusShareBps": 10000
  },
  "responses": [
    {
      "status": 201,
      "description": "Covenant computed. Fund it with the `funding` instruction.",
      "body": {
        "success": true,
        "id": "a3f1…",
        "type": "limit",
        "intentType": "LIMIT_ORDER",
        "status": "awaiting_funding",
        "makerAddress": "bchtest:qr…",
        "contractAddress": "bchtest:p…",
        "contractName": "LimitOrderSwapV2",
        "constructorArgs": ["<makerPkh>", "<sellCategory>", "", "10", "17000", "1790003600"],
        "sellToken": "<pUSD category>",
        "buyToken": "BCH",
        "sellAmount": "10",
        "minAmountOut": "17000",
        "covenantDeadline": 1790003600,
        "refundEligibleAt": 1790007200,
        "tokenAddress": "bchtest:r…",
        "orderType": "LIMIT_ORDER",
        "funding": { "to": "bchtest:r…", "satoshis": "1000", "token": { "category": "<pUSD category>", "amount": "10" } }
      }
    },
    { "status": 400, "body": { "error": "invalid makerAddress: …" } }
  ]
}
```

## Funding

| Selling | Send |
| --- | --- |
| BCH | `funding.satoshis` to `funding.to` (the covenant address) |
| A token | `funding.token.amount` of `funding.token.category` plus `funding.satoshis` (1,000) to `funding.to` (the token-aware address) |

> [!WARNING]
> Fund with `TransactionBuilder` against the covenant's locking bytecode, and send the **full** amount. A short UTXO is `underfunded` and can only be refunded after the deadline.

## Keep the constructor args

`contractName` and `constructorArgs` fully determine the covenant. Store them if your app needs to build `cancelEarly()` for the maker, or to verify the address independently.
