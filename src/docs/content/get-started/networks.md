---
title: Networks & endpoints
description: Which networks each part of the protocol runs on, default service ports and the environment variables the app reads.
status: ready
updated: 2026-09-28
sources: frontend/src/lib/config.ts, BCHMesh/meshserver/src/config/index.ts
---

## Networks

| Network | Address prefix | Explorer | Used for |
| --- | --- | --- | --- |
| BCH mainnet | `bitcoincash:` | blockchair.com/bitcoin-cash | Same-chain CashToken swaps |
| BCH chipnet | `bchtest:` | chipnet.imaginary.cash | Mesh V2, TWAP, all beta features |
| Solana devnet | — | explorer.solana.com | SOL ↔ BCH beta |
| BSC testnet | — | testnet.bscscan.com | BSC ↔ BCH beta |

> [!WARNING] Chipnet first
> Mesh V2 pools, TWAP and the ZK cross-chain routes are beta. Build and test against chipnet; see [Status & roadmap](get-started/status) for what is cleared for mainnet.

## Services

| Service | Default port | Base path | Frontend env var |
| --- | --- | --- | --- |
| Mesh Server (REST + WS) | `3001` | `/api/v1`, `/ws` | `VITE_MESH_SERVER_URL` |
| SOL ↔ BCH ZK relayer | `3007` | — | `VITE_SOL_BCH_ZK_SERVER_URL` |
| BSC ↔ BCH relayer | `3005` | — | `VITE_EVM_RELAYER_URL` |

Each has a `*_MAINNET_URL` twin; the app picks one based on the network toggle in the header.

## Token identifiers

- **BCH** is `0x` in requests and `BCH` in responses.
- **CashTokens** are their 32-byte category id as 64 hex characters.
- Amounts are **integer strings** in base units. Never send floats.

## Server configuration

The Mesh Server reads its behaviour from environment variables. The ones that change fills:

| Variable | Effect |
| --- | --- |
| `NETWORK` | `mainnet` or `chipnet` |
| `PORT` | HTTP port (default `3001`) |
| `ADMIN_API_KEY` | Enables admin writes; unset disables them |
| `PROTOCOL_TREASURY_PKH` | Where the protocol half of surplus goes; unset means the solver keeps it |
| `SOLVER_RFQ_SPREAD_BPS` | Discount the solver-inventory route takes off the reference price |
| `SOLVER_MAX_FILL_SATS` | Cap on a single inventory fill |
| `REFUND_INTERVAL_MS` | Refund engine timer (default 30 s) |
| `MIN_TOKEN_SHARE` | Dust threshold for token surplus shares |
| `FEE_PER_BYTE` | Miner fee rate used to size fill transactions |
| `SOLVER_PRIVATE_KEY_WIF` | Solver wallet that pays fees and provides inventory |
