---
title: Glossary
description: The terms used across the protocol, the API and these docs.
status: ready
updated: 2026-09-28
sources: aqua-research/18-terminology-and-branding.md, MeshDocs/BetaLaunch/03-v2-implementation-and-e2e-flows.md
---

| Term | Meaning |
| --- | --- |
| **Intent** | A swap order locked in a covenant UTXO. Anyone can fill it; the covenant enforces the maker's minimum. |
| **Maker** | The user who creates and funds an intent. |
| **Covenant** | A BCH script that constrains how its UTXO may be spent by inspecting the spending transaction. |
| **Covenant minimum** | The least the maker must receive. Fixed for limit orders; decays over time for Dutch auctions. |
| **Fill** | The atomic transaction that spends an intent and pays the maker at least the minimum. |
| **Route** | The liquidity source for a fill: Mesh pool, Cauldron pool or solver inventory. |
| **Solver** | Whoever builds and broadcasts a fill. Pays the miner fee and may provide inventory. |
| **Surplus** | Gross route output minus the covenant minimum. Split between protocol, user and frontend. |
| **Surplus mode** | How the partner half of surplus is split, set by `userSurplusShareBps` (A = all user, B = all frontend, C = split). |
| **Frontend fee** | The frontend's share of surplus, paid to `frontendPkh` in the fill transaction. |
| **Mesh** | The protocol's liquidity layer: isolated, single-owner strategy pools. |
| **Strategy pool** | A `StrategyCovenantV2` UTXO that trades BCH ↔ one token in one direction at a fixed price. |
| **Dock** | The LP's exit: the owner-signed spend that takes back 100% of a pool. |
| **Cauldron** | An external constant-product AMM on BCH that the matcher can route through. |
| **MTP** | Median-time-past: the median timestamp of the last 11 blocks. The protocol's clock. |
| **nLocktime** | Transaction field the covenants read as `tx.locktime`. Fills use `MTP − 1`. |
| **Category** | A CashToken's 32-byte id. BCH is written `0x`. |
| **P2SH32** | The 32-byte script-hash address type covenants live at. |
| **TWAP** | An order split into N Dutch-auction slices that start at fixed intervals. |
| **Refund engine** | Server loop that spends `cancel()` on expired, unfilled intents. |
| **Chipnet** | The BCH test network where upcoming consensus features are active first. |
