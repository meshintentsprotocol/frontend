---
id: bchmesh-v3-v4-mastery
categoryId: bchmesh
title: Mastering BCHMesh V3 vs V4: Range Orders, Fee Tiers & Capital Efficiency
summary: A comprehensive walkthrough of V3 fixed step ladders vs V4 dynamic tickless bins, selecting optimal fee tiers, and maximizing LP capital velocity.
date: Mar 02, 2026
author: BCHMesh Engineering
readTime: 7 min read
tags: [bchmesh, v3, v4, range-orders, fee-tiers, capital-efficiency]
---

# Mastering BCHMesh V3 vs V4: Range Orders, Fee Tiers & Capital Efficiency

> **A deep dive into the evolution of BCHMesh pool mechanics—from V3 structured ladders to V4 dynamic tickless bins—and how to construct high-yield LP strategies.**

---

## 1. Evolution of the Mesh Engine: V3 vs V4

BCHMesh has evolved rapidly from early experimentation into a production-grade automated trading fabric. Understanding the operational differences between the **V3** and **V4** engines allows liquidity providers to match their capital with market conditions.

### V3: Discrete Ladder Grids
The V3 engine was built to deliver deterministic, step-based market making on Bitcoin Cash:
* **Fixed Rungs:** Divides your deposit across evenly spaced discrete price tiers (e.g., $1 \text{ BCH}$ sell orders every \$5 step from \$300 to \$350).
* **Linear Execution:** Solvers execute each rung sequentially as the spot price crosses the threshold.
* **Predictable Fill Schedules:** Ideal for dollar-cost averaging (DCA), systematic profit-taking, and steady buy-the-dip ladders.

### V4: Dynamic Tickless Bins & Arbitrary Range Layouts
The V4 engine unlocks institutional-grade flexibility and concentrated capital efficiency:
* **Tickless Arbitrary Density:** Instead of rigid uniform steps, V4 allows Gaussian or geometric liquidity distribution around current spot prices.
* **Configurable Fee Tiers:** Set custom basis-point fee schedules per bin or tier (from 5 bps for pegged pairs to 100 bps for volatile tokens).
* **Multi-Bin Atomic Routing:** A single incoming intent swap can partially or fully consume multiple bins in a single transaction, minimizing slippage for traders and accelerating turnover for LPs.

---

## 2. Setting Your Parameters: Range & Fee Tier Playbook

Capital efficiency is determined by how closely your liquidity matches actual market trading volume.

```
    [--- Out of Range ---]   [=== Active Bins (V4) ===]   [--- Out of Range ---]
    $250              $310           $320 - $340          $360              $420
                              Highest Fee Velocity Zone
```

### Fee Tier Matrix

| Strategy Profile | Recommended Fee Tier | Target Asset Pairs | Typical Holding Duration |
| :--- | :--- | :--- | :--- |
| **Pegged / Correlated** | `5 bps` (0.05%) | `pUSD / mUSD`, `pUSD / USDT` | Months to Quarters |
| **High-Volume Major** | `25 bps` (0.25%) | `BCH / pUSD`, `BCH / USDC` | Weeks to Months |
| **Volatile / Exotic** | `100 bps` (1.00%) | `BCH / FUR`, New CashTokens | Days to Weeks |

### Choosing Your Price Range
1. **Narrow Range ($\pm 3\%$ to $\pm 5\%$):** Best during market consolidation. High fee turnover per dollar deposited, but requires periodic rebalancing if spot breaks out.
2. **Moderate Range ($\pm 10\%$ to $\pm 20\%$):** The sweet spot for passive LPs. Provides continuous yield through standard weekly market fluctuations without requiring daily maintenance.
3. **Asymmetric Trend Grids:** Deploy 80% of capital below spot (accumulating BCH on dips) and 20% above spot (gradual scaling out).

---

## 3. Step-by-Step V4 Range Deployment

Using the redesigned BCHMesh LP interface:

1. **Select Pair & Engine:** Choose `BCH / pUSD` and select the **V4 Dynamic Range** flow.
2. **Set Price Bounds:** Use the visual bin chart to drag your minimum and maximum range boundaries. The chart displays `1 BCH = P tokens`, with price expanding along the X-axis.
3. **Specify Fee Tier:** Select `25 bps` for standard market conditions.
4. **Allocate Deposit:** Enter your deposit amount. You can fund with 100% BCH, 100% counter-token, or a custom linked ratio.
5. **Simulate & Ship:** Review the estimated daily fee APR, coverage depth, and liquidation paths, then click **Ship Strategy**.

---

## 4. Measuring Capital Efficiency: Velocity Ratio

In traditional AMMs, only 1% to 2% of total value locked (TVL) is utilized in any given 24-hour window because liquidity is spread across an infinite curve from \$0 to \$\infty.

With BCHMesh V4:
$$\text{Capital Velocity} = \frac{\text{24h Trading Volume Routed Through Your Bins}}{\text{Total Position Capital}}$$

By concentrating your liquidity within the active trading band, your effective capital velocity can exceed **15x to 30x** that of standard constant-product AMM pools, generating superior net yield even in modest volume environments.

---

## Summary

BCHMesh V4 empowers market makers with institutional flexibility while preserving the non-custodial, sub-cent transaction advantages native to Bitcoin Cash.

