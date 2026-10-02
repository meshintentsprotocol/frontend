---
title: TWAP orders
description: Split a large order into N Dutch-auction slices that open at fixed chain-time intervals, funded in a single transaction.
status: ready
updated: 2026-10-02
sources: MeshDocs/BetaLaunch/03-v2-implementation-and-e2e-flows.md, MeshDocs/MeshTwapDocs/01-twap-architecture.md, BCHMesh/meshserver/src/api/routes/twap.ts
---

A TWAP order sells `totalAmountIn` in `numSlices` equal slices, one every `intervalSec`. Each slice is an ordinary `DutchAuctionSwapV2` intent whose `startTime` is pushed into the future, so the covenant itself refuses to fill a slice before its turn. Each slice stays fillable for `sliceWindowSec`, by default the larger of the interval and **1 hour** (minimum 30 minutes). If it isn't filled in that window, it is refunded.

```screenshot
{ "src": "/docs/screenshots/trade-twap.png", "url": "/twap", "caption": "The TWAP tab builds the slice schedule and funds every slice in one transaction." }
```

```mermaid title="Slice k opens at start + k·interval (10 min here) and stays fillable for its window (1 h). Each slice fills or refunds on its own."
gantt
    dateFormat X
    axisFormat %s
    section Slices
    Slice 0 (window)   :active, s0, 0, 3600
    Slice 1 (window)   :s1, 600, 4200
    Slice 2 (window)   :s2, 1200, 4800
    Slice 3 (window)   :s3, 1800, 5400
```

## Submit

```bash
curl -X POST "$MESH_URL/api/v1/twap/submit" \
  -H "Content-Type: application/json" \
  -d '{
    "creatorAddress": "bchtest:qr…",
    "tokenIn": "0x",
    "tokenOut": "<pUSD category>",
    "totalAmountIn": "400000",
    "numSlices": 4,
    "intervalSec": 600,
    "minAmountOutPerSlice": "48",
    "startAmountOutPerSlice": "52"
  }'
```

The response lists one `funding` entry per slice. **Fund them all in one transaction**: one output per slice address.

## Progress

`GET /api/v1/twap/:orderId` derives progress from the slices:

| Status | Meaning |
| --- | --- |
| `AWAITING_FUNDING` | Slices created; funding not seen |
| `RUNNING` | At least one slice still open |
| `COMPLETED` | Every slice filled |
| `PARTIALLY_FILLED` | Some filled, the rest refunded |
| `REFUNDED` | No slice filled |

> [!NOTE] Timing precision
> Slice starts and windows are [chain time](intents/settlement/chain-time), which advances one block at a time (often 10–20 minutes on chipnet). A slice opens within about one block of its scheduled time. That's why windows are at least 30 minutes: a shorter window can be skipped entirely between two blocks, and the slice would refund without a chance to fill. For the same reason, intervals shorter than a block don't spread slices out; the app offers 10 minutes to 4 hours.

There is no early cancel. `POST /twap/:id/cancel` returns the automatic refund schedule for the unfilled slices.
