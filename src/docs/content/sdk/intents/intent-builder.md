---
title: IntentBuilder
description: Fluent, validated builders for limit-order and Dutch-auction parameters.
status: draft
updated: 2026-09-28
sources: bch-intents-sdk/packages/sdk-cashtokens/src/IntentBuilder.ts, bch-intents-sdk/docs/gitbook/api/intent-builder.md
---

```typescript
import { IntentBuilder, TokenId, Duration } from '@bch-intents/sdk';

IntentBuilder.limitOrder();    // → LimitOrderBuilder
IntentBuilder.dutchAuction();  // → DutchAuctionBuilder
```

All amounts are `bigint` base units. `build()` validates and returns plain params you can pass to the contracts package or a relayer client.

## Limit order

```typescript
const limit = IntentBuilder.limitOrder()
  .makerAddress('bchtest:qr…')
  .sellToken(TokenId.BCH)
  .buyToken('<token category>')
  .sellAmount(100_000n)
  .buyAmount(50n)
  .expiryTime(BigInt(Math.floor(Date.now() / 1000) + 3600))
  .build();
```

| Method | Argument |
| --- | --- |
| `makerAddress(addr)` | Cashaddr that receives payouts and refunds |
| `sellToken(t)` / `buyToken(t)` | `TokenId.BCH` or a category hex |
| `sellAmount(n)` / `buyAmount(n)` | `bigint` base units |
| `expiryTime(ts)` | Unix seconds as `bigint` |
| `withFrontendFee(pct, addr)` | `0 < pct < 1`, e.g. `0.005` = 0.5% |

## Dutch auction

```typescript
const dutch = IntentBuilder.dutchAuction()
  .makerAddress('bchtest:qr…')
  .sellToken(TokenId.BCH)
  .buyToken('<token category>')
  .sellAmount(100_000n)
  .startBuyAmount(50n)
  .endBuyAmount(40n)
  .duration(Duration.hours(1))
  .build();
```

`Duration` has `seconds`, `minutes`, `hours` and `days` helpers that return `bigint` seconds.

## To document

- Validation errors thrown by `build()`
- `IntentsLocalClient` for building and funding without a relayer
- Mapping params onto V2 covenant constructor args
