# ParyonUSD — BCH Wallet Login Pattern Reference

> **Source:** Live browser research of [https://paryonusd.com/app](https://paryonusd.com/app)  
> **Date:** 2026-06-18  
> **Purpose:** Reference implementation for BCH wallet connection UX in BCH Intents dApp

---

## Overview

ParyonUSD is a BCH-native DeFi protocol (stablecoin / lending). Its wallet connection flow is a clean, production-grade reference for how to handle **multiple BCH external wallets** in a single modal — including both **WizardConnect** (Paytaca-specific) and standard **WalletConnect** protocols.

---

## 1. App Structure (Pre-Login State)

All core features are gated behind wallet connection. Without a connected wallet:

| Page | URL | State |
|------|-----|-------|
| Dashboard | `/app` | Shows "Connect Wallet" CTA |
| Borrow | `/app/borrow` | Locked — shows "Connect Wallet" |
| Stake | `/app/stake` | Locked — shows "Connect Wallet" |
| Redeem | `/app/redeem` | Locked — shows "Connect Wallet" |

**Key UX principle:** The entire app renders with layout/navigation visible, but all interactive data panels show a single "Connect Wallet" button until authenticated. No redirect to a separate login page.

---

## 2. The "Connect Wallet" Modal

Modal title: **"Connect a Bitcoin Cash wallet"**

### Wallet Options (in order shown)

```
┌─────────────────────────────────────────────────────┐
│  Connect a Bitcoin Cash wallet                  [X] │
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │  🟢  Cashonize                    (selected) │   │
│  ├──────────────────────────────────────────────┤   │
│  │  🔵  Paytaca                                 │   │
│  ├──────────────────────────────────────────────┤   │
│  │  🔗  Other wallet                            │   │
│  └──────────────────────────────────────────────┘   │
│                                                     │
│  [QR code display area]                             │
│  [ Open in Cashonize webwallet ]                    │
│  [ Copy Link ]                                      │
│                                                     │
│  ⓘ WalletConnect connects a single address only.   │
└─────────────────────────────────────────────────────┘
```

---

## 3. Per-Wallet Connection Details

### 3.1 Cashonize

- **Protocol:** WalletConnect (WC2)
- **Connection Methods:**
  1. **QR Code** — display WC URI as scannable QR (click QR icon button)
  2. **Open in Cashonize webwallet** — deep-link button → `https://cashonize.com/?uri=wc%3A<encoded_uri>`
  3. **Copy Link** — copies raw WC URI to clipboard
- **Info banner:** *"WalletConnect connects a single address only. Only funds on that address will be detected by the dApp."*
- **Recommended wallet** per their docs — full CashTokens + BCMR metadata support

### 3.2 Paytaca

Paytaca offers **two protocol tabs** within the same wallet row:

#### Tab A: WizardConnect (Default)
- **Protocol:** Paytaca's proprietary WizardConnect (not standard WC2)
- **Connection Methods:**
  1. **QR Code** — Paytaca-specific QR
  2. **Copy Link** — copies WizardConnect URI
- **Info banner:** *"Delegated interest rate management is not available over WizardConnect."*
- **Note:** WizardConnect may provide additional capabilities (e.g. multi-address support) compared to WC2 for Paytaca specifically

#### Tab B: WalletConnect
- **Protocol:** Standard WalletConnect (WC2)
- **Connection Methods:** QR Code + Copy Link (same as Cashonize)
- **Info banner:** *"WalletConnect connects a single address only. Only funds on that address will be detected by the dApp."*

### 3.3 Other Wallet

- **Protocol:** Generic WalletConnect (WC2)
- **Connection Methods:** QR Code + Copy Link
- **Info banner:** Same single-address WC2 warning
- **Use case:** Any BCH wallet with WC2 support (Selene, Electron Cash + WC plugin, etc.)

---

## 4. Step-by-Step Connection Flow

```
User clicks "Connect Wallet"
        │
        ▼
Modal opens: "Connect a Bitcoin Cash wallet"
   Shows: Cashonize | Paytaca | Other wallet
        │
   ┌────┴──────────────┬──────────────────┐
   ▼                   ▼                  ▼
Cashonize          Paytaca           Other wallet
(WC2 QR)     (WizardConnect QR   (WC2 QR shown)
              or WC2 QR shown)
   │                   │                  │
   └────────┬──────────┘                  │
            ▼                             │
   User scans QR / clicks deep-link       │
   OR copies link → pastes in wallet ─────┘
            │
            ▼
   Wallet app shows approval prompt
            │
            ▼
   User approves → session established
            │
            ▼
   Modal closes → App shows wallet address + balances
```

---

## 5. Wallet Compatibility Matrix

From [paryonusd.com/docs/getting-started/wallet-compatibility](https://paryonusd.com/docs/getting-started/wallet-compatibility):

| Wallet | Connection | CashTokens | NFT Metadata (BCMR) | Notes |
|--------|-----------|------------|---------------------|-------|
| **Cashonize** | WalletConnect | ✅ Full | ✅ Full | **Recommended** |
| **Paytaca** | WizardConnect / WalletConnect | ✅ Full | ⚠️ Limited | Known issues displaying staking receipt / loan key NFT metadata |
| **Electron Cash** | WalletConnect (plugin) | ⚠️ Experimental | ❌ None | Plugin required |
| **Selene** | WalletConnect | ⚠️ Limited | ❌ None | Limited CashToken support |

---

## 6. Key Design Decisions to Adopt

### 6.1 Single-Address WC2 Warning
ParyonUSD prominently warns users that WalletConnect connects **one address only**. This is a critical transparency pattern — users should not expect their full wallet balance, only the selected address.

**→ Action for BCH Intents:** Show same warning in our connect modal for WC2 connections.

### 6.2 WizardConnect as Default for Paytaca
Paytaca's WizardConnect is listed **first / default** because it may provide additional capabilities. WalletConnect is secondary.

**→ Action for BCH Intents:** If we support Paytaca, implement WizardConnect first. Understand the WizardConnect URI scheme.

### 6.3 Deep-Link for Web Wallets
Cashonize (web wallet) gets a dedicated `"Open in Cashonize webwallet"` button that pre-fills the WC URI via URL param. This dramatically improves UX for non-mobile users.

**→ Action for BCH Intents:** Add `https://cashonize.com/?uri=wc%3A<encoded_wc_uri>` deep-link button for Cashonize.

### 6.4 No Redirect Login
Auth state is managed entirely in the modal. The navigation and page layout remain visible/stable throughout. No separate login route.

**→ Action for BCH Intents:** Consistent with our current modal approach in `WalletOnboardingModal.tsx`.

---

## 7. WalletConnect URI Format Observed

From the Cashonize deep-link URL pattern:
```
https://cashonize.com/?uri=wc%3A<session_topic>%40<version>%3Frelay-protocol%3Dirn%26symKey%3D<key>
```
Decoded:
```
wc:<session_topic>@2?relay-protocol=irn&symKey=<hex_key>
```
This is standard **WalletConnect v2 URI format** — `@2` confirms WC2.

---

## 8. Screenshots Reference

| Screenshot | Description |
|-----------|-------------|
| `ss_landing.png` | Dashboard before wallet connection |
| `ss_wallet_modal.png` | Wallet selection modal — Cashonize selected |
| `ss_paytaca_wizard.png` | Paytaca — WizardConnect tab (default) |
| `ss_paytaca_wc.png` | Paytaca — WalletConnect tab |
| `ss_other_wallet.png` | "Other wallet" — generic WC2 |
| `ss_compat_docs.png` | Wallet compatibility documentation page |

> Screenshots saved in: `C:\Users\Antony Dev\.gemini\antigravity-ide\brain\2686df10-5ccb-43aa-a33f-639ee6f188bd\`

---

## 9. Implementation Implications for BCH Intents

Based on this research, our `WalletOnboardingModal.tsx` should be updated to:

1. **Show Cashonize first** with a WC2 QR + Cashonize webwallet deep-link button
2. **Show Paytaca second** with WizardConnect as default tab + WalletConnect as secondary tab  
3. **Show "Other wallet"** as a generic WC2 fallback
4. **Show a clear warning** about single-address limitation of WC2
5. Use the **same in-modal tab pattern** (not a separate page/route) for protocol selection per wallet

These findings confirm and refine the approach documented in [02-wallet-architecture.md](./02-wallet-architecture.md).
