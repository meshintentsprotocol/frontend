---
title: Refunds & cancellation
description: How unfilled intents return to the maker, who can trigger it, and why the maker never has to be online.
status: ready
updated: 2026-09-28
sources: MeshDocs/BetaLaunch/03-v2-implementation-and-e2e-flows.md, BCHMesh/meshserver/src/solver/refundSweeper.ts
---

Every intent covenant has a `cancel()` path that becomes spendable at its deadline. It is **permissionless**: anyone may broadcast it, but it may only send everything the UTXO holds back to `makerPkh`. The server's refund engine does this automatically and pays the miner fee.

```cashscript title="LimitOrderSwapV2.cancel()"
function cancel() {
    require(tx.time >= expiryTime);
    int i = this.activeInputIndex;
    require(tx.outputs[i].lockingBytecode == new LockingBytecodeP2PKH(makerPkh));
    require(tx.outputs[i].value >= tx.inputs[i].value);
    require(tx.outputs[i].tokenCategory == tx.inputs[i].tokenCategory);
    require(tx.outputs[i].tokenAmount >= tx.inputs[i].tokenAmount);
}
```

```screenshot
{ "src": "/docs/screenshots/refund-state.png", "url": "/trade", "caption": "An expired intent in the order tracker, before and after the refund transaction confirms." }
```

## Refund triggers

| Trigger | When |
| --- | --- |
| `deadline` | Every `REFUND_INTERVAL_MS` (30 s) |
| `new_block` | Chain MTP advanced; the only moment new intents become refundable |
| `boot` | Once after a restart, after the first chain sweep |
| `manual` | `POST /api/v1/intent/:id/refund` by anyone. `425` with `refundEligibleAt` before the deadline |
| `admin` | `POST /api/v1/admin/refunds/sweep` |

The engine refunds the intent's own UTXO **plus any unclaimed UTXO at the same address** (double or partial funding), batched into one transaction.

## Early exit

| Order type | Early exit |
| --- | --- |
| Limit | `cancelEarly(makerPk, makerSig)`, signed by the maker's wallet, any time |
| Dutch / TWAP slice | None. Refunded automatically after the window |

After a maker spends `cancelEarly`, `POST /intent/:id/cancel` verifies it on-chain and reports `cancelled`. While the UTXO is still live it returns `409`.

> [!TIP] Show the right thing
> Distinguish `expired` (refund eligible, not yet broadcast) from `refunded` (done, `refundTxid` set). Showing "refunded" before the refund transaction exists was a real UI bug.
