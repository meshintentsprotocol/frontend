---
title: Security model
description: What the covenants guarantee to makers and LPs, what they deliberately don't, and how the guarantees are tested.
status: draft
updated: 2026-09-28
sources: MeshDocs/BetaLaunch/03-v2-implementation-and-e2e-flows.md, MeshDocs/MeshContracts/05-adversarial-security-report.md, aqua-research/20-security-model-and-threat-analysis.md
---

## Guarantees (enforced on-chain)

| Party | Guarantee | Enforced by |
| --- | --- | --- |
| Maker | Receives ≥ the covenant minimum, or gets everything back | Intent `fill()` / `cancel()` |
| Maker | One payout output can't satisfy two intents | Index binding |
| Maker | Refunds go only to `makerPkh` | `cancel()` output check |
| LP | A pool is paid at least its price for what it releases | `StrategyCovenantV2.fill()` derived amounts |
| LP | Only the owner can withdraw | `dock()` signature check |
| LP | Two pools can't share one recreated output | Index binding |

## Not guaranteed

- **Best price.** The maker gets at least the minimum; how much surplus they get depends on routes and surplus mode.
- **Fill at all.** Liquidity may not exist. The fallback is a full refund, not a fill.
- **Pool price freshness.** A fixed-rate pool trades at its price until the LP changes it. Stale prices are the LP's risk, like a resting limit order.
- **Server liveness.** If the Mesh Server is down, nothing is filled or auto-refunded, but `cancel()` stays permissionless, so anyone can refund after the deadline.

## Off-chain hardening

- Pool registration recomputes the covenant address from params and requires an unspent outpoint; reserves come from chain.
- Admin writes require `x-admin-key` and are disabled without one.
- Cancel and dock endpoints only report chain state.

## Testing

| Suite | Result |
| --- | --- |
| Contracts `test:security:v2` | 39/39: prior drain patterns rejected, index binding, funding edge cases, Dutch windows, composition |
| Server `npm test` | 91/91: pool maths = covenant maths, windows, funding rules, surplus, routing |
| Live chipnet | Fills via all three routes, surplus modes, cancel, TWAP, refunds |

## To document

- Threat model per actor (malicious solver, LP, server, miner)
- MEV and fill races
- Audit status and disclosure policy
