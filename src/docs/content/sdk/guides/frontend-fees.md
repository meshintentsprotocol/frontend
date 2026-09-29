---
title: Earn with frontend fees
description: Frontends that create intents can take a share of every fill's surplus, paid on-chain in the fill transaction itself.
status: ready
updated: 2026-09-28
sources: MeshDocs/BetaLaunch/03-v2-implementation-and-e2e-flows.md, MeshDocs/Mesh&IntentsMonitization/14-frontend-integrator-monetization-playbook-and-earnings.md, project-hub/specs/PRD_02_FRONTEND_FEES.md
---

When a solver fills an intent for more than its covenant minimum, the difference is **surplus**. Half goes to the protocol side. The other half is shared between the user and the frontend that created the intent, and you choose the split.

```chart surplus-split
```

## Set it on every intent you create

```bash {9-10}
curl -X POST "$MESH_URL/api/v1/intent/create" \
  -H "Content-Type: application/json" \
  -d '{
    "orderType": "limit",
    "makerAddress": "bchtest:qr…",
    "sellToken": "<pUSD category>", "sellAmount": "10",
    "buyToken": "0x", "buyAmount": "17000",
    "duration": 3600,
    "frontendPkh": "<your 20-byte pkh, hex>",
    "userSurplusShareBps": 5000
  }'
```

| `userSurplusShareBps` | You receive | The user receives |
| --- | --- | --- |
| `0` (Mode B) | The whole partner half | The minimum |
| `5000` (Mode C) | Half the partner half | Minimum + half the partner half |
| `10000` (Mode A) | Nothing | Minimum + the whole partner half |

## How you get paid

Your share is an **output of the fill transaction** paying `frontendPkh` directly. There is no claim step, no balance held by anyone, and nothing to withdraw. Shares below dust (546 sats for BCH) roll into the user's payout instead.

## Getting your pkh

The pkh is the 20-byte hash160 of your public key: bytes 1–21 of the P2PKH locking script, or the payload of your cashaddr.

```typescript
import { decodeCashAddress } from '@bitauth/libauth';
const decoded = decodeCashAddress('bitcoincash:qr…');
if (typeof decoded === 'string') throw new Error(decoded);
const frontendPkh = Buffer.from(decoded.payload).toString('hex');
```

> [!TIP] Be transparent
> Show users the surplus mode before they sign. Mode C (a 50/50 split) is a fair default that still earns on every fill.

## SDK v0.2 fee covenants

The Intents SDK's `withFrontendFee(pct, address)` targets the earlier fee-covenant contracts used by the same-chain relayer. For V2 intents routed through Mesh, set `frontendPkh` and `userSurplusShareBps` as above.
