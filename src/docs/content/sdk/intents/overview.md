---
title: Overview & packages
description: The Intents SDK is a set of TypeScript packages for building intents, compiling covenants, signing with any wallet and talking to the intent pool.
status: ready
updated: 2026-09-28
sources: bch-intents-sdk/README.md, bch-intents-sdk/packages/*/package.json, devrel-agent-context/sdk/integrations/01-modular-architecture.md
---

```codegroup
@@ npm | bash
npm install @bch-intents/sdk mainnet-js
@@ pnpm | bash
pnpm add @bch-intents/sdk mainnet-js
@@ yarn | bash
yarn add @bch-intents/sdk mainnet-js
```

`@bch-intents/sdk` re-exports every package below. Install individual packages if you want a smaller bundle.

## Packages

| Package | Version | What it gives you |
| --- | --- | --- |
| `@bch-intents/sdk` | 0.1.0 | Meta-package: re-exports everything |
| `@bch-intents/sdk-common` | 0.2.0 | `TokenId`, `Duration`, shared types, typed errors |
| `@bch-intents/sdk-cashtokens` | 0.2.0 | `IntentBuilder` for limit orders and Dutch auctions; `IntentsLocalClient` |
| `@bch-intents/sdk-contracts` | 0.2.0 | Compiled CashScript artifacts and wrappers |
| `@bch-intents/sdk-wallet-adapter` | 0.2.1 | `BCHSigner` interface and adapters: mainnet-js, embedded, WalletConnect, WizardConnect |
| `@bch-intents/sdk-order-book` | 0.1.0 | `NostrRelayerClient` for publishing and reading intents |
| `@bch-intents/sdk-cross-chain` | 0.1.0 | HTLC cross-chain flow helpers |
| `@bch-intents/sdk-xmr-swap` | 1.0.0 | Monero ↔ BCH adaptor-signature primitives (research) |

## How the pieces fit

```mermaid title="An app builds params, a signer funds the covenant, and the intent is published for solvers."
flowchart LR
    A[Your app] -->|IntentBuilder| P[Intent params]
    P -->|sdk-contracts| C[Covenant address]
    A -->|BCHSigner.send| C
    P -->|NostrRelayerClient / REST| S[Solvers]
    S -->|atomic fill| C
```

> [!NOTE] SDK vs. Mesh Server API
> SDK v0.2 targets the same-chain relayer and its fee covenants (`withFrontendFee`). The V2 intent covenants with Mesh routing and surplus modes are available through the [REST API](api/intents/create) today; V2 support in the SDK ships with the Mesh and Solver SDKs.

```cards
[
  { "title": "Installation", "description": "Packages, peer dependencies and bundler notes.", "href": "sdk/intents/installation", "icon": "package" },
  { "title": "IntentBuilder", "description": "Fluent builders for limit orders and Dutch auctions.", "href": "sdk/intents/intent-builder", "icon": "code" },
  { "title": "Wallet adapter", "description": "Make any wallet SDK-compatible with four methods.", "href": "sdk/intents/wallet-adapter", "icon": "wallet" },
  { "title": "Earn with frontend fees", "description": "Get paid for the order flow you originate.", "href": "sdk/guides/frontend-fees", "icon": "key" }
]
```
