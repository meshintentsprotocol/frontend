---
id: closed-loop-auto-recycling
categoryId: bchmesh
title: Closed-Loop Auto-Recycling: Perpetual Market Making on Bitcoin Cash
summary: How self-funding CashScript covenants automatically instantiate reverse buy orders when sells fill, enabling autonomous perpetual compounding without bots.
date: Mar 03, 2026
author: BCHMesh Core
readTime: 5 min read
tags: [bchmesh, auto-recycling, market-making, cashscript, perpetual-grid, covenants]
---

# Closed-Loop Auto-Recycling: Perpetual Market Making on Bitcoin Cash

> **How self-funding CashScript covenants transform discrete limit orders into perpetual market-making machines without reliance on off-chain bot infrastructure.**

---

## 1. The Bottleneck of Traditional Limit Orders

In classical order-book trading and conventional decentralized exchanges, a limit order is a one-way trip:
- You deposit BCH and post a sell order at \$320.
- When the order fills, you receive \$320 in stablecoins (e.g., `pUSD`).
- **The transaction is over.** Your funds sit idle as stablecoin dust in your wallet until you manually log in, calculate a new entry price, pay gas, and submit a new buy order.

For market makers who run high-frequency grid strategies, this requires maintaining continuous, 24/7 cloud servers with automated bot keys exposed to hot-wallet vulnerabilities.

---

## 2. The Auto-Recycling Architecture

BCHMesh leverages the programmable state transitions of CashScript covenants to achieve **Closed-Loop Auto-Recycling**.

```
              ┌────────────────────────┐
              │   BCH Sell Bin ($320)  │
              └───────────┬────────────┘
                          │
                   Market Fill Event
                          │
                          ▼
              ┌────────────────────────┐
              │  pUSD Received + Fee   │
              └───────────┬────────────┘
                          │
             Covenant Reconstitution (Auto)
                          │
                          ▼
              ┌────────────────────────┐
              │   pUSD Buy Bin ($310)  │
              └────────────────────────┘
```

When a solver matches an incoming swap against your BCH sell bin:
1. The covenant introspects the transaction outputs.
2. It verifies that the counter-party delivered the exact required amount of counter-tokens (`pUSD`) plus the agreed LP fee.
3. Instead of sending the funds to a dormant wallet address, the covenant rule **mandates the creation of a new reverse UTXO**.
4. This newly minted UTXO is immediately configured as a limit buy order at a lower designated price rung (e.g., \$310).

---

## 3. Perpetual Compounding Without Hot Keys

Because the recycling logic is baked into the on-chain UTXO covenant rules, market makers enjoy massive structural benefits:

* **Zero Infrastructure Overhead:** You do not need to run Docker containers, Python scripts, or AWS nodes to keep your grid alive. The protocol's solver network executes the recycling as part of clearing trades.
* **Cold Storage Security:** Once deployed, your private keys remain safe in hardware or offline storage. You only need your key when you decide to dock (withdraw) your accumulated balance.
* **Autonomous Profit Retention:** Every oscillation of the market captures the LP fee spread. If the price swings between \$310 and \$320 ten times in a month, your position executes 10 cycles of profit capture with zero human intervention.

---

## 4. Configuring Asymmetrical Grid Spreads

LPs can customize the behavior of the auto-recycling loop based on their market outlook:

### The Accumulator Grid (Bullish BCH)
- **Sell Rung Fee:** 0.35%
- **Reinvestment Allocation:** 100% of received stablecoins are budgeted to buy back BCH at lower levels.
- **Goal:** Continuously expand your total BCH count as the market oscillates.

### The Cashflow Harvester (Neutral / Sideways)
- **Symmetric Spreads:** Identical percentage distance between upper sell rungs and lower buy rungs.
- **Fee Skim to Cold Wallet:** Accrued fee profits are peeled off to your payout address on each cycle while base inventory continues cycling.

---

## 5. Unilateral Exit at Any Point in the Cycle

At any time—regardless of whether your capital currently sits as BCH, as counter-tokens, or in a half-filled intermediate stage—the **Unilateral Docking** covenant path allows you to withdraw everything in a single transaction.

---

## Conclusion

Closed-Loop Auto-Recycling turns Bitcoin Cash into the most cost-effective and secure automated market-making platform in decentralized finance.

