---
title: Recycling
description: MeshPoolV3 mirror mode keeps liquidity in Mesh. What a pool receives opens its reverse pool, which trades it back, with no withdrawal and no new deposit.
status: ready
updated: 2026-10-02
sources: contracts-bch-swap/contracts/MeshPoolV3.cash, BCHMesh/meshserver/src/pools/poolEvents.ts, MeshDocs/AlphaV3/02-covenant.md, MeshDocs/AlphaV3/11-recycle-idle-liquidity.md
---

Most order books pay a filled order out to the maker's wallet, and that liquidity is gone until the maker comes back. **Recycling** keeps it working: a filled pool's proceeds become a new pool on the other side of the market, automatically, inside the same fill transaction.

## Mirror mode

A [MeshPoolV3](mesh/v3/meshpool-v3) pool in **mode 2 (mirror)** sends what it receives to its **mirror pool**. The mirror pool:
- holds what was received;
- accepts what this pool holds;
- quotes the **reverse price** you chose (`rNum / rDen`);
- has the same owner and fee, also in mirror mode.

The covenant rebuilds the mirror's address from its own script. A fill can't send proceeds anywhere else, and no address is stored, so there is no hash cycle to break. The mirror of the mirror is the original pool, so capital flips back and forth:

```text
 BCH pool (buys pUSD at 3,217.5) ──trader sells pUSD──▶ pUSD lands in the mirror
          ▲                                                        │
          └──────trader buys pUSD (pays 3,282.5) ── BCH lands back ┘
```

Each round trip earns the gap between the two prices, plus the fee on both legs. The [Recycling pair](mesh/strategies/recycling-pair) page walks through one with numbers (≈ +2.2% per round trip at ±1%).

## Where it is used

| Template | Recycles |
| --- | --- |
| [Recycling pair](mesh/strategies/recycling-pair) | yes: one pool and its mirror |
| [Grid](mesh/strategies/grid) | yes: every rung is a recycling pair |
| Custom pools (`POST /api/v1/pools`) | any pool with `mode: 2` and reverse prices, including token↔token |
| Fixed, spread, multi-pair, stable pair, ladders | no: proceeds go to your wallet (mode 0) |

## Tracking

The server records both sides of every flip, so the history stays readable:
- the filled pool's `FILL` event carries `recycledTo` (the mirror's address);
- the mirror's `DEPOSIT` event carries `from`.

Strategy totals include the mirror pools, so value, fees and P&L cover the whole loop.

## Things to know

- Profit stays **inside the pools** until you withdraw (`dock`). Strategy pages show it as pool value.
- If the price leaves your range for good, the loop stops with all capital on one side. [Rebalance](api/strategies) re-centres it in one transaction.
- One base unit always stays in a token pool.

## Recycling idle liquidity (planned)

Liquidity can also go idle *after* the fact:
- proceeds sitting in your wallet from wallet-mode pools;
- pools priced far from the market that never fill;
- ranges stuck on one side;
- dust.

A **Recycle** action is planned to put all of it back to work in one signature, defaulting to mirror mode. The design is in `MeshDocs/AlphaV3/11-recycle-idle-liquidity.md`.
