---
title: Chain time (MTP)
description: Why every covenant decision uses median-time-past, and what that means for deadlines and Dutch decay.
status: ready
updated: 2026-09-28
sources: MeshDocs/BetaLaunch/03-v2-implementation-and-e2e-flows.md, BCHMesh/meshserver/src/chain/chainClock.ts
---

Covenants can't read the wall clock. They can read `tx.locktime` (the transaction's `nLocktime`) and check it against the chain via `tx.time` requirements. The protocol uses **median-time-past (MTP)**, the median timestamp of the last 11 block headers, as its only clock.

## The rules

1. A transaction is final only if `nLocktime < MTP`. `nLocktime = MTP` is rejected as `bad-txns-nonfinal`.
2. The server's `chainClock.finalLocktime()` returns `MTP − 1`: the latest locktime that is final right now.
3. Every fill uses that locktime, so the covenant's "now" is `MTP − 1`.
4. Intent times (`expiryTime`, `startTime`) are anchored to the final locktime at creation.

## Consequences

- **Deadlines move with blocks.** An intent becomes refundable only when a new block pushes MTP past its deadline, which is why `new_block` is a refund trigger.
- **MTP lags wall time.** Typically by around an hour. The API returns `refundEligibleAt = covenantDeadline + lag` so UIs can show a realistic wall-clock estimate.
- **Dutch decay is stepwise.** The minimum only changes when MTP changes.
- **TWAP slices open per block.** A slice scheduled at `start + k·interval` opens within about one block of that time.

> [!NOTE]
> If you build fills yourself, never use `Date.now()` for `nLocktime`. Read the last 11 block headers from your Electrum server, take the median timestamp and subtract one.
