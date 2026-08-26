# 01 — TWAP UI/UX Design Specification

## 1. Visual Hierarchy & Tokens

The TWAP module adheres to the **BCHSwap Dark Glassmorphic Design System**:

```
Background:         #0a0a0a with 90% opacity (bg-[#0a0a0a]/90 backdrop-blur-xl)
Borders:            1px solid rgba(255, 255, 255, 0.10)
Active Accent:      Emerald & Teal (#10b981 / #14b8a6)
Card Hover:         border-emerald-500/40 with emerald glow
Typography:         Outfit / Inter for headings, JetBrains Mono for numbers & addresses
```

---

## 2. Component Layout

```
┌─────────────────────────────────────────────────────────────┐
│                    BCHSwapCard Header                       │
│  ┌───────────────────────────────────────────────────────┐  │
│  │   [ Swap ]   [ Limit ]   [ TWAP (Active) ]            │  │
│  └───────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│  Sell Amount Box                                            │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Sell: 50,000 pUSD                   Balance: 120,000 │  │
│  │  ≈ $150.00 USD                                        │  │
│  └───────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│  TWAP Slices & Interval Controls                            │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Number of Slices: 10 slices                          │  │
│  │  [ 5 ]  [ 10 (Selected) ]  [ 20 ]  [ 50 ]             │  │
│  │                                                       │  │
│  │  Execution Interval: 60s per slice                    │  │
│  │  [ 1m (Selected) ]  [ 5m ]  [ 15m ]  [ 1h ]           │  │
│  └───────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│  Live Projection Breakdown                                  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  • Slice Size:               5,000 pUSD               │  │
│  │  • Total Duration:           9 mins                   │  │
│  │  • Est. Price Savings:       ~1.15%                   │  │
│  │  • Est. Network Fee:         10,000 sats (~$0.003)    │  │
│  └───────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│  CTA Button:                                                │
│  [ Place TWAP · 10 Slices (60s) ]                           │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Interaction States

| Element | Idle State | Hover State | Active / Selected State | Disabled State |
| :--- | :--- | :--- | :--- | :--- |
| **Segmented Tab** | `text-white/50` | `text-white/80` | `bg-white/[0.08] text-white shadow-sm` | `opacity-40` |
| **Preset Button** | `bg-white/[0.02] border-white/5` | `bg-white/[0.05] text-white` | `bg-emerald-500/15 border-emerald-500/40 text-emerald-300` | `opacity-30 cursor-not-allowed` |
| **Submit CTA** | `bg-gradient-to-r from-emerald-600 to-teal-500` | `hover:from-emerald-500 hover:to-teal-400 shadow-emerald-500/25` | `scale-[0.99]` | `opacity-50 cursor-not-allowed` |
| **Cancel Button** | `text-red-400` | `hover:bg-red-500/10 text-red-300` | `scale-95` | `opacity-40` |
