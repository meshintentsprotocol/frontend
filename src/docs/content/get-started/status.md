---
title: Status & roadmap
description: What is live, what is in beta, and what is being built next.
status: ready
updated: 2026-09-28
sources: MeshDocs/BetaLaunch/02-road-to-beta-checklist.md, project-hub/roadmaps/2026_MASTER_ROADMAP.md
---

## Component status

| Component | Network | Status | Notes |
| --- | --- | --- | --- |
| Same-chain CashToken swaps (relayer) | Mainnet | **Validated** | Live end-to-end and security suites green |
| `LimitOrderSwapV2`, `DutchAuctionSwapV2` | Chipnet | **Beta** | 39/39 contract security tests |
| Mesh V2 pools + tri-route matcher | Chipnet | **Beta** | 91/91 server tests; live fills via Mesh, Cauldron and inventory |
| TWAP | Chipnet | **Beta** | Slices are Dutch V2 intents |
| SOL ↔ BCH (ZK-STARK) | Testnet | **Beta** | Do not use with mainnet funds |
| BSC ↔ BCH (ZK-STARK) | Testnet | **Beta** | Do not use with mainnet funds |
| Intents SDK | npm | **v0.2** | Covenant artifacts, builders, wallet adapter |
| Mesh SDK | — | Planned | |
| Solver SDK | — | Planned | |
| Monero adaptor swaps | — | Research | |

> [!WARNING] Beta means beta
> Beta components have passed their test suites on chipnet or testnet. They are not cleared for mainnet funds until the beta checklist closes.

## Verification you can re-run

```codegroup
@@ Contracts | bash
cd contracts-bch-swap && npm run test:security:v2
@@ Server | bash
cd BCHMesh/meshserver && npm test
@@ Live chipnet | bash
MESH_URL=http://localhost:3091 ADMIN_KEY=… LP_WIF=<funder WIF> \
SOLVER_ADDR=bchtest:… OUT_DIR=… npm run test:e2e:live
```

## Next

1. **Mesh SDK**: typed pool creation, registration and docking.
2. **Solver SDK**: the matcher and fill executor as a library, so anyone can run a competing solver.
3. **Advanced strategies**: oracle-priced, multi-pair recycling and Dutch-decay pools.
4. **Cross-chain hardening**: full on-chain FRI verification before mainnet.
