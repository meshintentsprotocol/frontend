---
title: Status reference
description: Every value of the intent status field, what it means and what a client should show.
status: ready
updated: 2026-09-28
sources: BCHMesh/meshserver/src/intents/format.ts
---

| Status | Stored or derived | Meaning | Suggested UI |
| --- | --- | --- | --- |
| `awaiting_funding` | derived | Created; no UTXO bound yet | "Waiting for deposit" + funding instructions |
| `underfunded` | derived | A UTXO arrived but holds less than the sell amount | "Deposit too small: refund after deadline" |
| `scheduled` | derived | Funded, but the auction window hasn't opened (TWAP slice) | Countdown to `startTime` |
| `active` | derived | Funded and fillable right now | "Looking for a fill" |
| `expired_unfunded` | derived | Deadline passed with nothing funded | Nothing to refund; hide or archive |
| `expired` | derived | Deadline passed while funded; refund eligible | "Refunding…" |
| `refund_pending` | stored | Refund engine has started a refund | "Refund in progress" |
| `filled` | stored | Filled; see `fillTxid`, `fillMethod` | Success with explorer link |
| `refunded` | stored | `cancel()` returned everything to the maker; see `refundTxid` | "Refunded" with explorer link |
| `cancelled` | stored | Maker spent `cancelEarly()` | "Cancelled" |
| `closed_external` | stored | Spent by a transaction the server didn't build | Show `closedTxid` |

## Fields that go with status

| Field | When present |
| --- | --- |
| `fundingOutpoint` | Once funded (`txid:vout`) |
| `fillTxid`, `fillMethod`, `fillExplorerUrl` | `filled` |
| `refundTxid`, `refundExplorerUrl` | `refunded` |
| `covenantDeadline`, `refundEligibleAt` | Always |
| `lastFillError`, `unfillableSince` | While active but not fillable |
| `lastRefundError` | After a failed refund attempt |

> [!TIP]
> Treat `filled`, `refunded`, `cancelled` and `closed_external` as final. Everything else can still change on the next block.
