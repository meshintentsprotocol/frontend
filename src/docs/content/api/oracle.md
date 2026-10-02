---
title: Oracle prices
description: Reference prices and signed oracle payloads (BCH Schnorr) for oracle-priced pools.
status: ready
updated: 2026-10-02
sources: BCHMesh/meshserver/src/api/routes/oracle.ts, BCHMesh/meshserver/src/oracle/attestor.ts, BCHMesh/meshserver/scripts/check-oracle-signing.ts
---

| Endpoint | Returns |
| --- | --- |
| `GET /api/v1/oracle/prices` | Latest reference prices for configured pairs |
| `GET /api/v1/oracle/pairs` | Configured pairs, with source and, for Cauldron pairs, the reference pool |
| `GET /api/v1/oracle/payload?pair=<name>` | A signed price message for covenant verification |

Sources, as reported in each price's `source` field:
- **`bmr`:** the median of several exchanges, for BCH/USD and the other majors;
- **`cauldron`:** the deepest Cauldron pool, for CashToken pairs such as `pUSD_BCH`.

Prices older than `ORACLE_MAX_AGE_SEC` are treated as stale and not signed.

> [!WARNING]
> No live Mesh pool consumes these payloads yet. See [Oracle strategies](mesh/pools/oracle) for the status.

## Payload

16 bytes, all little-endian:

| Bytes | Field |
| --- | --- |
| 0–3 | timestamp (unix seconds, uint32) |
| 4–7 | pair id (uint32): 1 BCH_USD · 2 USDC_USD · 3 USDT_USD · 4 pUSD · 5 mUSD |
| 8–15 | price × 10⁸ (uint64) |

## Signature

- **Scheme:** 64-byte BCH Schnorr.
- **Signed digest:** `sha256(sha256(payload))`. A covenant verifies it with

  ```cashscript
  require(checkDataSig(oracleSig, sha256(oracleMsg), oraclePk));
  ```

  `OP_CHECKDATASIG` hashes the message it receives once more, so the second hash is the opcode's.
- **Public key:** `oraclePk`, a 33-byte compressed key, returned with every payload. Pools fix it at deploy time.

`scripts/check-oracle-signing.ts` runs exactly that check in the BCH 2025 VM. It accepts a server signature and rejects a changed price, another key, and a single-hash signature.

```endpoint
{
  "method": "GET",
  "path": "/api/v1/oracle/payload",
  "summary": "Latest signed price message for a pair.",
  "params": [ { "name": "pair", "in": "query", "type": "string", "description": "Pair name, e.g. BCH_USD (default: the first configured pair)." } ],
  "responses": [
    { "status": 200, "body": { "pairName": "BCH_USD", "pairId": 1, "price": "30813000000", "priceHuman": "308.130000", "timestamp": 1790881921,
      "raw": "81b0be6a010000004011992c07000000", "signature": "<128 hex>", "oraclePk": "02…", "source": "bmr" } },
    { "status": 503, "body": { "error": "Oracle signing is not configured (ORACLE_PRIVATE_KEY_HEX)" } }
  ]
}
```

## Staleness: off-chain vs on-chain

- **Off-chain**, the server refuses to sign a price older than `ORACLE_MAX_AGE_SEC`.
- **On-chain**, a script can require "not before" a time (`tx.time >= timestamp`) but **not "not after"**: a filler can always use an old locktime. A covenant can't reject an old signed price by its timestamp alone. The planned V3 oracle pools bind each signature to the pool's current outpoint instead (see [Oracle strategies](mesh/pools/oracle)).
