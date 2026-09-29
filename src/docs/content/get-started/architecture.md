---
title: Architecture
description: How applications, the Mesh Server, liquidity venues and Bitcoin Cash covenants fit together, and where the trust boundary sits.
status: ready
updated: 2026-09-28
sources: project-hub/architecture/SYSTEM_OVERVIEW.md, MeshDocs/BetaLaunch/03-v2-implementation-and-e2e-flows.md, MeshDocs/intentsrouter/README.md
---

BCH Intents is a **hub-and-spoke** system. Bitcoin Cash is the hub: it holds the order book (intent covenants), the liquidity (Mesh pool covenants) and the settlement rules. Other chains are spokes that hold the counter-asset for cross-chain swaps.

```diagram protocol-stack
```

## Layers

### Applications
Anything that creates intents: the BCH Intents app, wallets, integrator frontends, bots. Applications never custody funds. They build an intent, ask the user's wallet to fund it, and watch its status.

### SDKs and APIs
- **Intents SDK** (`@bch-intents/sdk`): typed builders, covenant artifacts, wallet adapters and a relayer client.
- **Mesh Server API** (`/api/v1`): quotes, intent creation and tracking, pools, orderbook, TWAP, tokens and oracle data, plus a WebSocket stream.
- **ZK relayers**: separate services for SOL ↔ BCH and BSC ↔ BCH settlement.

### Execution (off-chain)
The Mesh Server runs four loops:

| Module | Job |
| --- | --- |
| Scanner / indexer | Binds funding to each intent **per outpoint**, follows pool UTXOs as they are spent and recreated |
| Matcher | Plans one fill per intent: Mesh pool → Cauldron → solver inventory |
| Fill executor | Builds the atomic transaction, sizes the fee from the serialized tx, broadcasts raw hex |
| Refund engine | Refunds unfilled intents after their deadline (timer, new block, boot, manual, admin) |

### Liquidity
- **Mesh strategy pools**: one UTXO per pool, fixed price, owned by one LP.
- **Cauldron**: live constant-product AMM pools on BCH, spent without a signature.
- **Solver inventory**: the solver's own wallet, used when pools can't clear the minimum.

### Settlement (on-chain)
CashScript covenants decide whether a transaction is valid. See [Contracts overview](contracts/overview).

## The trust boundary

> [!INFO] The server is not trusted
> A buggy or malicious Mesh Server can **fail to fill** an intent or fill it at exactly the minimum. It cannot pay a maker less than the covenant minimum, spend a pool without paying it, or refund to anyone except the maker. Those rules live in the covenants.

This is why every API that "changes state" is really a *notification*: `POST /intent/:id/cancel` and `POST /positions/dock` re-read the chain and report what they find. The server never marks something cancelled or docked on request.

## Time comes from the chain

Covenant decisions use **median-time-past (MTP)**, never wall-clock time. Every fill is built with `nLocktime = MTP − 1`, which is final now and is the exact time the intent covenant uses for its expiry and Dutch-auction decay. See [Chain time (MTP)](intents/settlement/chain-time).

## Where each component lives

| Component | Repository path |
| --- | --- |
| Covenants | `contracts-bch-swap/contracts` |
| Mesh Server | `BCHMesh/meshserver/src` |
| Intents SDK | `bch-intents-sdk/packages/*` |
| Legacy same-chain relayer | `cashtoken-relayer` |
| ZK relayers | `bch-solana-relayer`, `bsc-bch-server` |
| Frontend | `frontend/src` |
