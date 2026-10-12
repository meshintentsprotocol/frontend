---
title: Strategy configuration guide
description: Comprehensive comparative analysis of DeFi strategy design patterns (Uniswap v3/v4, DLMM, Ambient, Kamino) and Mesh Finance's definitive UTXO strategy builder specifications.
status: ready
updated: 2026-10-12
sources: BCHMesh/meshserver/src/strategies/templates.ts, MeshFinance/DesignSystem/TechnicalWireframe.md
---

# Mesh Finance — Strategy Configuration Architecture & UI/UX Design Guide

> **Brand**: **Mesh Finance** (`mesh.finance`)  
> **Protocol**: Mesh Protocol V3 (Bitcoin Cash CashTokens + UTXO Covenants + Nostr NIP-90 Solver Intents)  
> **Design Philosophy**: Neo-Brutalist Technical Wireframe (CAD Blueprint Minimalist Precision)

---

## 1. DeFi Strategy Configuration: Industry Comparison

How does Mesh Finance's strategy configuration compare to leading protocols across Ethereum, Solana, and Avalanche?

| Feature | Uniswap v3 / v4 | Trader Joe / Meteora DLMM | Ambient Finance | Kamino Finance | **Mesh Finance** |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Liquidity Structure** | Continuous Tick Range | Discrete Price Bins | Unified Hybrid Curve | Automated Vaults | **Discrete UTXO Covenants (`MeshPoolV3`)** |
| **User Mental Model** | Min/Max bounding box on depth chart | Visual shape bars (Spot, Curve, Skewed) | Orderbook / Swap hybrid | 1-Click Risk Presets | **Curated Archetypes + Interactive Ladder** |
| **Rebalance Execution** | Manual remove $\to$ swap $\to$ redeploy | Volatility fee surge | On-chain limit execution | Automated keeper bots | **Atomic N $\to$ M Rebalance (1 tx) + Self-Recycling** |
| **Rebalance Gas Cost** | \$25 – \$180+ (EVM mainnet) | \$0.05 – \$0.50 (Solana/AVAX) | Low (single contract) | \$0.10 – \$1.50 / epoch | **< 300 sats (< \$0.001 USD, 1 sat/byte)** |
| **Impermanent Loss Control** | Out-of-range position freezes into falling asset | Dynamic volatility fees capture arbitrage | Knockout orders freeze liquidity | Automated range tracking | **Mirror Covenant Recycling (fills fund reverse pools)** |
| **Sovereign Non-Custody** | Contract holds LP tokens | Contract holds receipt tokens | Protocol internal balances | Vault manager contracts | **Sovereign Spend Path (`dock` signed by owner PKH)** |

---

## 2. Key Insights from Modern DeFi

1. **Discrete Bins & Price Ladders beat Continuous Ticks**:
   Continuous tick math ($1.0001^i$) confuses users and creates decimal rounding errors. Visual price rungs where each level states "1 BCH = P tokens" are vastly more intuitive.
2. **Visual Shape Presets democratize Market Making**:
   Offering presets like **Tight (±1.5%)**, **Moderate (±5.0%)**, and **Wide (±15.0%)** allows both beginners and quantitative traders to deploy strategies with confidence.
3. **The UTXO Superpower**:
   Unlike Ethereum where multi-pool rebalancing costs hundreds of dollars, Bitcoin Cash allows closing $N$ covenant pools and opening $M$ new pools in **one atomic transaction costing under 1 sat/byte**.

---

## 3. The 8 Mesh Finance Strategy Archetypes

Mesh Finance provides 8 mathematical strategy templates:

1. **Fixed Price (`fixed`)**: Precision limit bid or ask at an exact price level.
2. **Spread Market (`spread`)**: Traditional two-sided market maker (bid below market, ask above market).
3. **Multi-Pair Indexer (`multi-pair`)**: Single BCH reserve quoting bids for up to 3 CashTokens simultaneously.
4. **Stable Pair (`stable-pair`)**: Concentrated liquidity around a 1:1 or 1:X peg with minimal spread.
5. **Recycling Pair (`recycling-pair`)**: Perpetual buy-low sell-high loop: fills automatically open reverse mirror covenants.
6. **Grid Strategy (`grid`)**: 2 to 10 laddered rungs across a custom price range with automated cross-rung recycling.
7. **Take-Profit Ladder (`take-profit`)**: Automated laddered token exit as price ascends.
8. **Accumulate Ladder (`accumulate`)**: Automated laddered DCA token entry as price dips.

---

## 4. UI/UX Component Specifications (Detail-by-Detail)

### Component A: Strategy Template Selector
- Segmented category tabs (`All`, `Range`, `Market making`, `Limit`, `Directional`, `Stable`, `Multi-asset`).
- Interactive template cards with:
  - High-contrast icon container (`bg-black/5 dark:bg-white/5 border border-white/10`).
  - Requirement chip (`BCH only`, `Dual asset`, `Token only`).
  - Proceeds mode badge (`Recycles in Mesh` vs `Pays to wallet`).
  - Recommendation wizard ("Which one fits?"): 3-question filter matching user intent to strategy.

### Component B: Tactile Token Selector & Category Verification
- Dual-deck token selector modal with instant search by symbol or CashToken category hex.
- Displays verified token badge, carrier satoshi requirements, and available wallet balance.
- "MAX" button for one-click full balance allocation.

### Component C: Interactive Price Ladder & Depth Visualization
- Real-time price ladder visualizing order rungs relative to the market mid.
- Bid rungs colored emerald (buy below market); ask rungs colored violet/rose (sell above market).
- Animated dotted connection lines showing mirror recycling loops.
- Hover cards detailing exact price, satoshi rate, and fee yield.

### Component D: Preset & Range Controls
- Range presets: `Tight (±1.5%)`, `Moderate (±5.0%)`, `Wide (±15.0%)`, and `Custom`.
- Increment/decrement step buttons (`+`, `-`) for granular price adjustments.
- Real-time spread calculation warning if bid $\ge$ ask.

### Component E: Fee Tier Selector Chips
- `5 bps (0.05%)`: Recommended for stable pairs.
- `30 bps (0.30%)`: Recommended for standard pairs (BCH/pUSD).
- `50 bps (0.50%)`: Recommended for volatile pairs.
- `100 bps (1.00%)`: Recommended for exotic CashTokens.

### Component F: Proceeds Mode Switcher
- **Keep in Mesh (Recycle)**: Proceeds open the reverse mirror pool on-chain, keeping capital actively compounding.
- **Pay to Wallet**: Proceeds sweep directly to your CashAddress.

### Component G: Pre-Flight Review Drawer
- Displays full cryptographic breakdown before signing:
  - Contracts to create / close.
  - CashScript parameters and contract address verification.
  - Required BCH & CashToken deposits.
  - Network fee (~250 sats) and carrier dust reserves (2,000 sats per pool).
- Tactile execution button with progress feedback and transaction retry logic.
