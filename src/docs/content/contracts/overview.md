---
title: Contracts overview
description: The CashScript covenants that enforce intents and liquidity, what each guarantees, and which are routed to today.
status: ready
updated: 2026-09-28
sources: contracts-bch-swap/contracts, MeshDocs/BetaLaunch/03-v2-implementation-and-e2e-flows.md
---

All protocol rules live in CashScript covenants (`pragma cashscript ^0.12.0`) under `contracts-bch-swap/contracts`. Everything off-chain is replaceable; these are not.

## Routed today (V2)

| Contract | Role | Spend paths | Reference |
| --- | --- | --- | --- |
| `LimitOrderSwapV2` | Fixed-price intent | `fill()`, `cancel()`, `cancelEarly()` | [Reference](contracts/limit-order-swap-v2) |
| `DutchAuctionSwapV2` | Decaying-price intent (and TWAP slices) | `fill()`, `cancel()` | [Reference](contracts/dutch-auction-swap-v2) |
| `StrategyCovenantV2` | Fixed-rate Mesh pool | `fill()`, `dock()` | [Reference](contracts/strategy-covenant-v2) |

## Shared design rules

1. **Bind to your own index.** Every V2 covenant checks `tx.outputs[this.activeInputIndex]`, never a fixed position.
2. **Derive, don't trust.** Amounts come from comparing inputs and outputs, not from arguments.
3. **Full funding or nothing.** An intent can only be filled if its UTXO holds the whole sell amount.
4. **Refund everything.** Exit paths return every sat and token the UTXO holds, so over- and under-funding are always recoverable.
5. **Chain time only.** Times are compared against `tx.locktime` / `tx.time` (MTP).

## Not routed

| Contract | Status |
| --- | --- |
| `LimitOrderSwap`, `DutchAuctionSwap`, `StrategyCovenant` (V1) | Superseded. The server drops V1 pools on boot and rejects them at registration |
| `LimitOrderSwapWithFee`, `DutchAuctionSwapWithFee` | V1 fee variants; fees are now surplus outputs |
| `OracleStrategyCovenant`, `MultiPairRecyclingCovenant`, `DutchDecayStrategyCovenant`, `MeshStrategyWithSurplusCapture` | Research designs for [advanced strategies](mesh/pools/oracle) |

## Verification

```bash
cd contracts-bch-swap && npm run test:security:v2   # 39/39 on the VM
```

The suite replays the V1 drain patterns against V2 and checks index binding, funding edge cases, Dutch windows and multi-covenant composition.
