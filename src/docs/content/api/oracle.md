---
title: Oracle prices
description: Reference prices and signed oracle payloads for oracle-priced strategies.
status: draft
updated: 2026-09-28
sources: BCHMesh/meshserver/src/api/routes/oracle.ts, MeshDocs/MeshContracts/03-oracle-and-dutch-strategies.md
---

| Endpoint | Returns |
| --- | --- |
| `GET /api/v1/oracle/prices` | Latest reference prices for configured pairs |
| `GET /api/v1/oracle/pairs` | Configured pair ids |
| `GET /api/v1/oracle/payload?pair=<name>` | A signed price message for covenant verification |

Prices are sourced from Pyth (`PYTH_ENDPOINT`), polled every `ORACLE_POLL_INTERVAL_MS`, and considered stale after `ORACLE_MAX_AGE_SEC`.

## To document

- Payload byte layout (timestamp, pair id, price) and signature scheme
- How `OracleStrategyCovenant` verifies it with `checkDataSig`
- Staleness rules on-chain vs off-chain
