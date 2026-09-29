---
title: Cross-chain overview
description: How BCH Intents settles swaps with Solana and EVM chains, and why proofs are replacing hash locks.
status: ready
updated: 2026-09-28
sources: miden-vm/How the BCH Intents Protocol ZK-STARK Settlement Works E2E.md, miden-vm/17-sol-bch-architecture.md, miden-vm/21-bsc-bch-phase-b-gamma-launch.md
---

```diagram hub-spoke
```

A cross-chain swap has two legs: the maker locks an asset on one chain, a solver delivers the other asset on the other chain, and the solver then claims the maker's locked funds. The question is what lets the solver claim.

## Hash locks vs. proofs

| | HTLC (legacy) | ZK-STARK settlement |
| --- | --- | --- |
| Claim condition | Reveal the secret `s` with `hash(s)` | A STARK proof that the solver's delivery tx exists |
| Interactive | Yes: both sides must be online to reveal and observe `s` | No |
| Links claim to *why* | No: `s` says nothing about the intent | Yes: proof commits to the tx hash and intent id |
| Replay protection | Per-secret | Program hash + public inputs bound into the proof |
| Status | Legacy (Movement / Aptos) | Beta on Solana devnet and BSC testnet |

## How a ZK claim works

1. The maker locks funds in a covenant on BCH (or an escrow on the other chain).
2. The solver fills the other leg and records the delivery transaction hash.
3. The solver runs a Miden VM program with the tx hash and intent id as public inputs, producing a STARK proof.
4. The solver claims by presenting the proof commitments to the covenant, which verifies them on-chain using BCH's loop and 64-bit arithmetic opcodes.

```cards
[
  { "title": "ZK-STARK settlement", "description": "The proof, the binding and what the covenant checks.", "href": "intents/cross-chain/zk-stark", "icon": "shield" },
  { "title": "SOL ↔ BCH relayer API", "description": "Endpoints for the four Solana swap directions.", "href": "api/zk/sol-bch", "icon": "server" }
]
```

> [!WARNING] Testnet only
> The ZK routes are beta on testnets. Don't route mainnet funds through them until on-chain verification is hardened.
