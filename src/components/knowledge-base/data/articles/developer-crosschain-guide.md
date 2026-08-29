---
id: developer-crosschain-guide
categoryId: developers
title: Developer & Cross-Chain Integration Guide
summary: Building on BCHMesh with TypeScript SDKs, zero-inventory intent solvers, and cross-chain routing across EVM, Solana, Movement, and Monero.
date: Feb 24, 2026
author: Intents DevRel
readTime: 6 min read
tags: [developers, sdk, solvers, cross-chain, typescript]
---

# Developer & Cross-Chain Integration Guide

> **Building on BCHMesh: TypeScript SDKs, Zero-Inventory Intent Solvers, and Cross-Chain Routing Architecture.**

---

## 1. Developer Ecosystem Architecture

The BCH Intents & BCHMesh developer stack is organized into modular SDKs and services designed for rapid integration by DEX frontends, market-making bots, intent solvers, and cross-chain relayers:

* **`@bch-intents/sdk`:** Core intent settlement, Dutch auction generation, and atomic 2-party intent matching.
* **`@bch-mesh/sdk`:** Active LP and Strategy Mesh API, programmatic `ship()` / `dock()`, and sub-cent atomic bulk rebalancing engines.
* **`Cross-Chain Layer`:** Relayers and atomic bridges supporting EVM (BSC, Ethereum, Arbitrum), Solana, Movement (Move VM), and Monero (XMR).

---

## 2. SDK Quickstart

Install the official packages:

```bash
npm install bch-intents-sdk cashscript @bitauth/libauth
```

### Shipping a Single-Asset Strategy Covenant

```typescript
import { ElectrumNetworkProvider } from 'cashscript';
import { StrategyMeshClient } from 'bch-intents-sdk';

const provider = new ElectrumNetworkProvider('chipnet');
const client = new StrategyMeshClient(provider, signerPrivateKey);

async function deployMarketMakingStrategy() {
    const txid = await client.shipStrategy({
        pair: {
            tokenIn: 'pUSD_CATEGORY_HEX', // Token to receive
            tokenOut: 'BCH'               // Asset to sell
        },
        depositAmount: 1_000_000_000n,    // 10.0 BCH
        priceNumerator: 350n,             // Target price: 350 pUSD per BCH
        priceDenominator: 1n,
        feeBps: 30,                       // 0.30% fee
        curveType: 'FIXED_LIMIT'
    });

    console.log(`Successfully deployed Strategy UTXO: ${txid}`);
}
```

---

## 3. Zero-Inventory Intent Solver Integration

Solvers aggregate user swap requests and match them against the most competitive BCHMesh strategy UTXOs on-chain without holding hot-wallet inventory:

```typescript
import { IntentSolver } from 'bch-intents-sdk';

const solver = new IntentSolver({
    provider: provider,
    zmqEndpoint: 'tcp://127.0.0.1:28332'
});

solver.on('intent:submitted', async (intent) => {
    console.log(`Discovered Intent: Swap ${intent.amountIn} ${intent.tokenIn} for ${intent.tokenOut}`);

    // Query BCHMesh orderbook depth
    const route = await solver.findOptimalMeshRoute(intent);

    if (route.isProfitable) {
        // Construct 1-tx atomic match: User Intent Input + Strategy UTXO Input -> Settlements
        const matchTxid = await solver.executeAtomicMatch({
            intent: intent,
            route: route
        });
        console.log(`Matched atomically with zero solver inventory: ${matchTxid}`);
    }
});
```

---

## 4. Cross-Chain Settlement

* **EVM & Solana Relayers:** Relayers monitor lock events on EVM/Solana contracts and trigger corresponding intent fulfillment on Bitcoin Cash via Hash Time-Locked Contracts (HTLCs).
* **Monero (XMR) Atomic Swaps:** Utilizes Cross-Curve Adaptor Signatures (Scriptless Scripts) and zero-inventory solver matching to facilitate trustless, private cross-chain swaps between Monero and Bitcoin Cash.
