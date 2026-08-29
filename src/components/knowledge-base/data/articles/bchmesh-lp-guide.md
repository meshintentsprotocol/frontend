---
id: bchmesh-lp-guide
categoryId: bchmesh
title: BCHMesh LP & Market Maker Guide
summary: Step-by-step practical manual for market makers, liquidity providers, and traders deploying active liquidity grids on Bitcoin Cash.
date: Feb 22, 2026
author: BCHMesh Core
readTime: 5 min read
tags: [lp, market-making, grid, rebalancing, bchmesh]
---

# BCHMesh Knowledge Base: User & Liquidity Provider Guide

> **A Step-by-Step Practical Manual for Market Makers, Liquidity Providers, and Traders on Bitcoin Cash.**

---

## 1. How BCHMesh Differs From Traditional DEX Liquidity

If you have provided liquidity on standard DEXs (e.g. Uniswap or Cauldron), here is what changes with BCHMesh:

* **Pure Single-Asset Deposits:** Deposit 100% pure BCH (or any CashToken) without needing to sell half your stack for a paired token.
* **100% Retained Fees:** 100% of the trading fees you generate are paid directly into your strategy UTXO. No socialized pool dilution.
* **Closed-Loop Auto-Recycling:** Fills automatically instantiate reverse buy orders, keeping your capital perpetually productive.
* **Sub-Cent Rebalances:** Reconfigure 20+ out-of-range positions in a single transaction for ~$0.01 USD.
* **Unilateral Docking:** Unconditionally withdraw 100% of your capital + accumulated fees directly to your wallet anytime.

---

## 2. Step-by-Step: Deploying Your First Strategy

### Prerequisites
1. A CashTokens-supported Bitcoin Cash wallet (e.g. Electron Cash, Cashonize, Paytaca).
2. A balance of Bitcoin Cash (BCH) and/or CashTokens (such as pUSD, mUSD, or ecosystem tokens).

### Step 1: Connect Your Wallet
Open the BCHMesh interface and connect your preferred CashTokens wallet. Ensure your network is set to Mainnet or Chipnet testnet.

### Step 2: Select Your Strategy Mode

BCHMesh offers four core strategy deployment modes:

1. **Single-Asset Fixed-Rate Grid:** Deposit BCH and set laddered sell limit orders across target price tiers (e.g. $1 \text{ BCH @ \$320}$, $1 \text{ BCH @ \$330}$). Best for DCA profit taking.
2. **Concentrated Liquidity Band:** Focus your capital within a narrow spread around current spot price (e.g. $\pm 3\%$) to maximize fee velocity during consolidation phases.
3. **Closed-Loop Recycling Mesh:** When your sell order fills, the received counter-tokens automatically fund a reverse buy order at a lower price rung, minus your fee.
4. **Multi-Market Shared Liquidity Mesh:** Deploy pure single-sided inventory (e.g. BCH) where **100% of your capital is simultaneously available to multiple trading pairs** (`BCH -> pUSD`, `BCH -> mUSD`, `BCH -> FUR`) without fragmenting your balance.

### Step 3: Configure Parameters & Ship (`ship()`)
1. Select your target trading pair or multi-token routes.
2. Input the total deposit amount (e.g. `5 BCH`).
3. Set your price rungs or bounds.
4. Set your custom LP fee in basis points (e.g. `25 bps` = `0.25%`).
5. Click **"Deploy Strategy Mesh"** and sign the single transaction in your wallet.

---

## 3. Sub-Cent Atomic Bulk Rebalancing

When market prices move out of your strategy range, your capital may become inactive. On EVM networks, rebalancing 10 positions costs significant gas.

On BCHMesh, you execute **Bulk Reconfiguration**:
1. Open your **Active Positions** tab.
2. Click **"Bulk Rebalance"**.
3. The interface automatically groups your out-of-range UTXOs.
4. Choose your new price target and spread.
5. Click **"Submit Atomic Rebalance"**.

All old UTXOs are spent as inputs, and new in-range UTXOs are generated as outputs in **one single transaction costing ~$0.01 in network miner fees**.

---

## 4. Unilateral Capital Recovery (`dock()`)

You maintain non-custodial ownership of your funds at all times:
1. Click **"Dock"** on any individual strategy (or **"Dock All"** for your entire portfolio).
2. The covenant validates your signature against the `ownerPKH` stored in the Parameter NFT.
3. 100% of your initial capital plus all accumulated trading fees are swept straight to your wallet in one confirmation.
