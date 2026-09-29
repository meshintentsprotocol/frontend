---
title: StarkVerifierFRI
description: The BCH covenant that verifies FRI commitments of a STARK proof on-chain.
status: planned
updated: 2026-09-28
sources: miden-vm/12-stage-3-real-proof-fri-verifier.md, docs/zk-architecture/04-covenant-verifier.md, zk-stark-chipnet/05-stage-2b-fri-design.md
---

## Outline

1. Unlocking data layout (commitments, openings, final polynomial)
2. The FRI loop with OP_BEGIN / OP_UNTIL
3. Goldilocks field checks
4. Size budget and limits
5. Hardening required for mainnet
