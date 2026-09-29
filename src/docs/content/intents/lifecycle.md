---
title: Intent lifecycle
description: The states an intent moves through, what triggers each transition, and which WebSocket event announces it.
status: ready
updated: 2026-09-28
sources: BCHMesh/meshserver/src/intents/lifecycle.ts, BCHMesh/meshserver/src/intents/format.ts, MeshDocs/BetaLaunch/03-v2-implementation-and-e2e-flows.md
---

```diagram intent-lifecycle
```

```screenshot
{ "src": "/docs/screenshots/order-tracker.png", "url": "/trade", "caption": "The order tracker follows an intent from funding to fill or refund." }
```

## State machine

Terminal states come from the stored record. Open states are **derived** each time from funding and the covenant clock, so the same intent can read `scheduled` before its window opens and `expired` after it closes without anything being written.

```mermaid title="Intent status transitions. Solid states are stored; the rest are derived from funding and chain time."
stateDiagram-v2
    direction LR
    [*] --> awaiting_funding: POST /intent/create
    awaiting_funding --> active: full funding bound
    awaiting_funding --> underfunded: UTXO short of sellAmount
    awaiting_funding --> expired_unfunded: deadline, never funded
    active --> scheduled: before startTime (TWAP slice)
    scheduled --> active: startTime reached
    active --> filled: fill tx confirmed
    active --> cancelled: maker cancelEarly()
    active --> expired: deadline passed
    underfunded --> expired: deadline passed
    expired --> refund_pending: refund engine picks it up
    refund_pending --> refunded: cancel() broadcast
    filled --> [*]
    refunded --> [*]
    cancelled --> [*]
```

## Transitions and events

Every status change goes through one module (`intents/lifecycle.ts`), which persists the record and then emits a WebSocket event.

| Transition | Trigger | Event |
| --- | --- | --- |
| created | `POST /api/v1/intent/create` | `intent:created` |
| funded | Scanner binds a UTXO that covers the full order | `intent:funded` |
| unfillable | No route clears the minimum this cycle | `intent:unfillable` (with `reason`, `refundEligibleAt`) |
| filled | Fill transaction broadcast | `intent:filled` |
| refund pending | Refund engine starts a refund | `intent:refund_pending` |
| refund failed | Broadcast rejected; retried next trigger | `intent:refund_failed` |
| refunded | `cancel()` broadcast | `intent:refunded` (with `trigger`) |
| cancelled | Maker's `cancelEarly()` seen on-chain | `intent:cancelled` |
| closed externally | Covenant spent by someone else | `intent:filled` (`external: true`) or `intent:closed` |

> [!NOTE] Cancel is a notification
> `POST /intent/:id/cancel` never marks an intent cancelled on its own. It re-reads the covenant from chain: if the UTXO is still unspent it returns `409` and explains the exit path (limit: maker-signed `cancelEarly`; Dutch: automatic refund at `refundEligibleAt`).

## Funding rules

- Funding is bound **per outpoint**, so several identical intents may share one covenant address.
- Only a UTXO holding the **full** sell amount is fillable. Less than that is `underfunded` and can only be refunded.
- Over-funding is fine: the maker's payout is enforced on the minimum, and a refund returns everything the UTXO holds.

## Deadlines

`covenantDeadline` is in chain time (MTP). `refundEligibleAt` adds the current chain lag so clients can show a wall-clock estimate. Chain time advances with blocks, so a deadline is only crossed when a new block raises MTP. See [Chain time (MTP)](intents/settlement/chain-time).
