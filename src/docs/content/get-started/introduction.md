---
title: Introduction
description: BCH Intents is an intent-based swap protocol that settles on Bitcoin Cash. Users say what they want; solvers compete to deliver it; covenants enforce the result.
status: ready
updated: 2026-09-28
sources: project-hub/architecture/SYSTEM_OVERVIEW.md, MeshDocs/README.md, MeshDocs/BetaLaunch/03-v2-implementation-and-e2e-flows.md
---

An **intent** is a signed statement of what a user wants: *"sell 10 pUSD for at least 19,000 sats before 14:00."* The user locks the sell side in a Bitcoin Cash covenant. Anyone may fill it, but the covenant only releases the funds in a transaction that pays the user at least what they asked for. If nobody does before the deadline, the user gets everything back.

That one rule is what the rest of the protocol is built around.

```diagram protocol-stack
```

## The three roles

| Role | What they do | Trust required |
| --- | --- | --- |
| **Maker** (user) | Creates an intent and funds the covenant | None: the covenant pays them or refunds them |
| **Liquidity provider** | Deploys Mesh strategy pools at a fixed price | None: only they can `dock()` their pool |
| **Solver** | Finds a route that clears the intent's minimum and broadcasts the fill | None for users; solvers take their own execution risk |

A server (the Mesh Server) indexes intents and pools, runs the matcher and the refund engine, and serves the API. It is **untrusted by design**: it can fail to fill an order, but every payout is checked by covenant code on-chain.

## What you can build

```cards
[
  { "title": "Swap UIs and wallets", "description": "Quote, create and track intents with the SDK or REST API. Earn a share of surplus with frontend fees.", "href": "sdk/guides/embedded-swaps", "icon": "wallet" },
  { "title": "Liquidity strategies", "description": "Run fixed-rate Mesh pools, keep 100% of your fees and exit in one signature.", "href": "mesh/overview", "icon": "network" },
  { "title": "Solvers", "description": "Fill intents from Mesh, Cauldron or your own inventory and keep the protocol share of surplus when no treasury is set.", "href": "solvers/overview", "icon": "bot" },
  { "title": "Cross-chain flows", "description": "Settle SOL and BSC swaps against BCH with ZK-STARK proofs instead of hash locks.", "href": "intents/cross-chain/overview", "icon": "layers" }
]
```

## Why Bitcoin Cash

- **Covenants with introspection.** Scripts can read the transaction's inputs and outputs, so a UTXO can say *"I may only be spent if output N pays this address at least X."* That is the whole enforcement model.
- **CashTokens.** Fungible tokens (pUSD, mUSD, …) live natively in UTXOs next to BCH, so a swap is one transaction with no wrapped assets.
- **Cheap, flat fees.** Fees are paid per byte (about 1 sat/byte). An atomic fill that touches an intent, a pool and a solver wallet costs a fraction of a cent.
- **2026 upgrades.** Loops (`OP_BEGIN`/`OP_UNTIL`) and 64-bit arithmetic make on-chain STARK verification possible, which is how the cross-chain routes work.

> [!TIP] New here?
> Read [How a swap works](get-started/how-a-swap-works) for the end-to-end story, then follow the [5-minute quickstart](get-started/quickstart) to create an intent on chipnet.
