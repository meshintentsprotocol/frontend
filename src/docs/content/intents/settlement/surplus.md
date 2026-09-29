---
title: Surplus & frontend fees
description: When a route pays more than the covenant minimum, the difference is split between the protocol, the user and the frontend that created the order.
status: ready
updated: 2026-09-28
sources: MeshDocs/BetaLaunch/03-v2-implementation-and-e2e-flows.md, MeshDocs/Mesh&IntentsMonitization/11-quote-pricing-mechanics-fill-price-and-surplus-derivation.md
---

```text
surplus = gross route output − covenant minimum
```

**Half** of the surplus goes to the protocol: a treasury output if `PROTOCOL_TREASURY_PKH` is configured, otherwise the solver keeps it. The **other half** (the partner half) is split by the intent's `userSurplusShareBps`.

```chart surplus-split
```

## Surplus modes

| Mode | `userSurplusShareBps` | Partner half goes to | Outputs |
| --- | --- | --- | --- |
| A | `10000` | All to the user | Maker gets minimum + share |
| B | `0` | All to the frontend | Frontend output to `frontendPkh` |
| C | `1`–`9999` | Split | Both |

If `userSurplusShareBps` is omitted it defaults to `10000` (Mode A). Shares below dust (546 sats for BCH, `MIN_TOKEN_SHARE` for tokens) roll into the user payout; for the protocol half this applies only when a treasury is configured. With no `frontendPkh`, the frontend share also goes to the user.

## Live examples (chipnet)

| Test | Minimum | Route output | Result |
| --- | --- | --- | --- |
| F1 · Mode A | 17,000 | 19,940 | Maker 18,470 |
| F4 · Mode B | 17,000 | 19,940 | Maker 17,000, frontend output 1,470 |

In both, the surplus is 2,940 sats: 1,470 to the protocol side and 1,470 to the partner half.

## For integrators

Set two fields when you create an intent:

```json
{
  "frontendPkh": "<your 20-byte public key hash, hex>",
  "userSurplusShareBps": 5000
}
```

Your share is paid **in the fill transaction itself**, to your key, with no claim step. See [Earn with frontend fees](sdk/guides/frontend-fees).
