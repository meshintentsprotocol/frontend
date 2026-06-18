# Wallet UX & Connection Flows

This document explores the user experience and flows for the hybrid wallet system, allowing users to use the embedded self-custody wallet (WDK), connect external wallets (Cashonize, Paytaca via WalletConnect/Wizard), and combine both seamlessly.

## 1. The "Connect Wallet" Modal

The initial onboarding modal needs to cater to two distinct types of users: those who want an all-in-one embedded experience, and those who bring their own external wallets.

### Modal UI Structure
```text
┌────────────────────────────────────────────────────────┐
│  Connect Your Wallet                                   │
│                                                        │
│  ⭐ Recommended (All-in-one Cross-chain)                │
│  [ Create New Web Wallet ]  -> Generates WDK Seed      │
│  [ Import Seed Phrase    ]  -> Restores WDK Seed       │
│                                                        │
│  ─────────── Or connect external wallets ───────────   │
│                                                        │
│  Bitcoin Cash (BCH)                                    │
│  [ Cashonize / WalletConnect ]                         │
│  [ Paytaca / Wizard Connect  ]                         │
│                                                        │
│  Solana / EVM                                          │
│  [ Phantom ] [ MetaMask ]                              │
└────────────────────────────────────────────────────────┘
```

## 2. The Three User Journeys

### Journey A: The "Pure Self-Custody" User (WDK Only)
1. User clicks **Create New Web Wallet**.
2. WDK generates a 12-word seed phrase.
3. The system automatically derives:
   - BCH Wallet 1 (WDK)
   - EVM Wallet 1 (WDK)
   - Solana Wallet 1 (WDK)
4. **UX Result:** The user can instantly swap cross-chain without touching any extensions or mobile apps. Everything is signed in the background by WDK.

### Journey B: The "Pure External" User (WalletConnect Only)
1. User clicks **Cashonize / WalletConnect**.
2. A QR code appears. The user scans it with their Cashonize mobile app.
3. The dApp now has an active BCH wallet (Cashonize).
4. **Handling Other Chains:** 
   - Because they used an external BCH wallet, they **do not have** EVM or Solana wallets yet. 
   - **Important UX Decision:** We *cannot* silently generate a WDK wallet for them in the background for EVM/Solana, because they wouldn't have backed up the seed phrase. If they deposited funds, they could lose them.
   - **Solution:** When they try to do a cross-chain swap (e.g., BCH -> SOL), the UI prompts: *"You need a Solana wallet to receive funds. [Connect Phantom] or [Create Web Wallet for Solana]"*.

### Journey C: The "Hybrid Power User" (WDK + External)
This is the optimal flow for advanced users who have their main funds in a hardware/mobile wallet but want the convenience of the web wallet.

1. User creates/imports their **WDK Web Wallet**. They now have WDK wallets for BCH, EVM, and Solana.
2. They navigate to the "Wallet Manager" tab in the dApp.
3. They click **"Add External BCH Wallet"** and scan a WalletConnect QR code with Paytaca.
4. The system now has **Two BCH Wallets**:
   - `BCH Wallet 1 (WDK)` - Balance: 0.5 BCH
   - `BCH Wallet 2 (Paytaca)` - Balance: 10.0 BCH
5. **Setting the "Main" Wallet:** The user clicks a star icon `[★ Set as Active]` next to the Paytaca wallet. 
6. **UX Result:** When executing a BCH -> Solana swap, the dApp uses the **Paytaca** wallet for the BCH side (triggering a popup on their phone to sign) and the **WDK** wallet for the Solana side (receiving silently).

---

## 3. The "Wallet Manager" Panel

Once authenticated (via either method), the main wallet popup should look like this:

### The "Accounts & Chains" Tab
```text
┌────────────────────────────────────────────────────────┐
│  Wallet Manager                                        │
│                                                        │
│  ▼ Bitcoin Cash (BCH)                  [+ Add Wallet]  │
│    ⭐ BCH Wallet 1 (Web/WDK)      0.5 BCH     [Switch] │
│       BCH Wallet 2 (Paytaca)     10.0 BCH     [Active] │
│                                                        │
│  ▼ Solana (SOL)                        [+ Add Wallet]  │
│    ⭐ SOL Wallet 1 (Web/WDK)      5.0 SOL     [Active] │
│                                                        │
│  ▼ EVM (BSC/Ethereum)                  [+ Add Wallet]  │
│    ⭐ EVM Wallet 1 (Web/WDK)      1.2 BNB     [Active] │
└────────────────────────────────────────────────────────┘
```

## 4. Addressing "Automatic Generation" of Other Chains

You asked: *"if we connect a wallet with wizard connect, cashonize, how will other chains be handled... can it automatically have the other chains wallets generated in the process?"*

**The Rule of Custody:** We can only auto-generate wallets for other chains if we can securely back up the keys. 

**The Workflow for External-First Users:**
If a user connects Cashonize first, they *only* have BCH. To solve the cross-chain problem elegantly:
1. When Cashonize connects, the dApp notices missing chains (EVM/SOL).
2. The dApp presents a "Complete Your Cross-Chain Setup" prompt.
3. The prompt asks them to generate a WDK seed phrase (and forces them to write it down) OR connect external wallets for EVM/SOL.
4. Once completed, they are seamlessly bumped into **Journey C (The Hybrid Power User)**.
