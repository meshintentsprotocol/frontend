---
title: Oracle strategies
description: Pools that follow a signed market price instead of a fixed one. Not available yet. This page explains the status, the oracle payload, and the design in progress.
status: draft
updated: 2026-10-02
sources: BCHMesh/meshserver/src/oracle/attestor.ts, contracts-bch-swap/contracts/OracleStrategyCovenant.cash, MeshDocs/AlphaV3/12-oracle-v3-strategy.md
---

> [!WARNING]
> **No live strategy uses an oracle.** Every [strategy template](mesh/strategies/overview) quotes the fixed prices you set. Market data only helps you *choose* those prices.

## Why oracle pools

A fixed-price pool doesn't follow the market: when the price moves, you reprice by hand (rebalance). An oracle pool would quote around a **signed market price** instead, for example "buy 0.5% below and sell 0.5% above the BCH/USD price", and stay in the market on its own.

## The oracle payload

The Mesh server already signs price messages, at `GET /api/v1/oracle/payload?pair=BCH_USD`:

| Bytes | Field | Encoding |
| --- | --- | --- |
| 0–3 | timestamp | uint32, little-endian |
| 4–7 | pair id | uint32, little-endian (1 = BCH_USD, 4 = pUSD) |
| 8–15 | price | uint64, little-endian, × 10⁸ |

- **Signature:** 64-byte BCH Schnorr over `sha256(sha256(payload))`. A covenant checks it with `checkDataSig(sig, sha256(payload), oraclePk)`, because `OP_CHECKDATASIG` hashes its message once more.
- Verified in the BCH VM: a changed price, another key, or a single-hash signature are rejected.
- Without a configured key the endpoint returns 503 rather than an unusable signature.

## Why the old covenant isn't offered

The V1 `OracleStrategyCovenant` must not hold funds:
- it takes the trade size as an argument the filler chooses, and never checks it against the actual payment;
- it accepts any old signed price, so an attacker can replay a stale one.

The server refuses it.

## The design in progress

`MeshPoolOracleV3` keeps everything that makes [V3 pools](mesh/v3/meshpool-v3) safe:
- amounts read from the transaction, never passed in;
- proceeds routing, including recycling;
- the slot price replaced by the oracle price ± a spread.

The hard problem is **freshness**. Bitcoin Cash scripts can enforce "not before" a time, but not "not after", so a timestamp alone can't stop an old price from being reused. The proposed fix: the oracle signs the price **together with the pool's current outpoint**, so a signature is valid for one pool state only and dies at the next fill. On top of that, the pool would have required **price bounds** and a **per-fill size cap**, which limit the damage from a bad or compromised feed.

Planned templates: **oracle peg** (stablecoin ↔ BCH that follows BCH/USD), **oracle spread** (market making around the live price), and **oracle recycle**.

## Risks to understand (when it ships)

- The oracle key can move the price. Bounds and caps limit what a bad price can do; they don't make the oracle trustless.
- A price signed now stays usable until your pool changes. The spread must cover short moves.
