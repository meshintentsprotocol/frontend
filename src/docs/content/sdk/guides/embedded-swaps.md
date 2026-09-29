---
title: Embed swaps in a wallet
description: Give wallet users best-execution swaps without running liquidity: quote, create, fund with the user's key, track.
status: draft
updated: 2026-09-28
sources: bch-intents-sdk/examples/1-embedded-dex-wallet.ts, project-hub/docs/DOCS_HIERARCHY.md
---

A wallet already holds the user's keys and UTXOs. That's everything an intent needs: the wallet funds the covenant, and solvers do the rest.

```mermaid title="Embedded swap flow inside a wallet"
sequenceDiagram
    participant W as Wallet UI
    participant API as Mesh Server
    participant K as Wallet keys
    participant BCH as BCH network
    W->>API: POST /quote
    API-->>W: amountOut, route
    W->>API: POST /intent/create (frontendPkh = wallet)
    API-->>W: covenant address + funding
    W->>K: build + sign funding tx (TransactionBuilder)
    K->>BCH: broadcast
    API-->>W: WS intent:funded → intent:filled
```

## Steps

1. **Quote** the pair and size.
2. **Create** the intent with the user's address as maker and your wallet's pkh as `frontendPkh`.
3. **Fund** from the user's UTXOs with `TransactionBuilder` against the covenant locking bytecode.
4. **Track** via the WebSocket or `GET /intent/:id` and show the fill or refund.

## To document

- Full TypeScript example from `examples/1-embedded-dex-wallet.ts`
- Handling token funding (token address + 1,000 sats)
- UX for `expired` → `refunded`
