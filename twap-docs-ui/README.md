# ⏱️ BCHSwap TWAP UI & User Experience Documentation

> **Institutional-grade Time-Weighted Average Price (TWAP) algorithmic execution interface on Bitcoin Cash**

---

## 📌 Overview

The **TWAP (Time-Weighted Average Price)** module in **BCHSwap** brings algorithmic large-order execution directly to the user interface. Built with a sleek, dark-glassmorphic DeFi aesthetic, it allows users to schedule multi-slice orders against BCHMesh covenants and Cauldron liquidity pools with zero intra-order pool slippage and minimal network fees (~$0.002 per slice).

---

## 📚 Documentation Index

| Document | Focus Area | Description |
| :--- | :--- | :--- |
| **[01. UI/UX Design Specification](./01-ui-ux-design-spec.md)** | Visual & Component Spec | Segmented tabs, slice presets, interval controls, price protection, and glassmorphic cards |
| **[02. User Journey & Interactive Flows](./02-user-journey-and-flows.md)** | User Flows & State Logic | Step-by-step order creation, live progress monitoring, slice cancellation, and error states |

---

## 🎯 Key Features

1. **Unified 3-Mode Segmented Control**:
   - **`Swap`**: Instant market execution via Dutch Auction or DEX liquidity.
   - **`Limit`**: Resting limit orders with fixed pricing.
   - **`TWAP`**: Time-sliced execution across customizable time windows.

2. **Smart Slicing & Duration Presets**:
   - Quick slices: `5`, `10`, `20`, `50` slices.
   - Quick intervals: `1m`, `5m`, `15m`, `1h`.
   - Real-time total duration calculation (e.g. `540s` $\to$ `9 mins`).

3. **Live Price Impact Savings & Fee Breakdown**:
   - Real-time simulation from `BCHMesh/meshserver` (`/api/v1/twap/quote`).
   - Dynamic price impact savings badge (e.g. `~1.15% savings`).
   - Total network fee projection (~$0.003 for 10 slices).

4. **Real-Time Execution Queue (`TWAPOrderHistory.tsx`)**:
   - Expandable side panel with animated progress bars (`Slice 4/10 (40%)`).
   - Live status indicators (`PENDING`, `RUNNING`, `COMPLETED`, `CANCELLED`).
   - Direct Chipnet block explorer links for every executed slice transaction.
   - 1-click **Cancel Order** capability.
