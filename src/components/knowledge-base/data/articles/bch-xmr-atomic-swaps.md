---
id: bch-xmr-atomic-swaps
categoryId: cross-chain
title: BCH ↔ Monero (XMR) Atomic Swaps & DEX Architecture
summary: Technical blueprint for trustless, private, and high-throughput cross-chain swaps between Bitcoin Cash and Monero via adaptor signatures.
date: Feb 25, 2026
author: Intents Cryptography Lab
readTime: 7 min read
tags: [monero, xmr, atomic-swaps, privacy, ptlc, covenants]
---

# Atomic Swaps & Intent Settlement Between Bitcoin Cash and Monero (XMR)

> **The Technical Blueprint for Trustless, Private, and High-Throughput Cross-Chain Swaps via Adaptor Signatures & Zero-Inventory Solver Networks.**

---

## 1. Executive Summary

Bitcoin Cash (BCH) and Monero (XMR) represent two apex philosophies in decentralized digital currency:
* **Bitcoin Cash:** Fast, high-throughput, sub-cent fees, and expressive native covenants (`CHIP-2021-02`).
* **Monero:** Maximum fungibility, untraceable transactions, and hidden graph metadata via RingCT, Stealth Addresses, and Bulletproofs.

Despite their shared ethos of sovereign peer-to-peer finance, building a seamless, non-custodial decentralized exchange (DEX) between BCH and XMR has historically been bottlenecked by Monero's deliberate lack of an expressive on-chain scripting language.

**BCH Intents** bridges this divide by uniting **Cross-Curve Adaptor Signatures (Scriptless Scripts)** on the Monero side with **Introspecting CashScript Covenants** on the Bitcoin Cash side, orchestrated through a **Decentralized Zero-Inventory Solver Network**.

---

## 2. The Cryptographic Mechanism: Adaptor Signatures & PTLCs

To perform an atomic swap without on-chain hashlocks, BCH Intents employs **Point Time-Locked Contracts (PTLCs)** powered by **Adaptor Signatures** (also known as *Scriptless Scripts*).

### The Mathematical Foundation:
An adaptor signature is an incomplete signature $\sigma'$ "encrypted" under a discrete logarithm point $T = t \cdot G$ (where $t$ is a secret scalar).

1. **Generation:** The swap maker produces $\sigma'$, which is not a valid signature by itself, but can be verified to be valid if combined with $t$.
2. **Revelation:** When the counterparty publishes a valid signature $\sigma$ to claim funds on Bitcoin Cash, they mathematically reveal the secret scalar $t$:
   $$t = \sigma - \sigma'$$
3. **Extraction:** The other party observes $t$ on the transparent BCH blockchain and immediately uses $t$ to complete their signature and unlock the Monero output.

**Result:** No on-chain script is needed on Monero—the mathematics of signature aggregation guarantees atomicity.

---

## 3. On-Chain CashScript Covenant Design

On the Bitcoin Cash side, we implement `XmrAdaptorSwap.cash`, a P2SH32 smart covenant leveraging BCH native introspection (`OP_CHECKDATASIG` and `CHIP-2021-02`):

```solidity
pragma cashscript ^0.10.0;

// XmrAdaptorSwap: Cryptographic lock for Monero Adaptor atomic settlement
contract XmrAdaptorSwap(
    pubkey claimerPk,      // Solver / Claimer Public Key
    pubkey refundPk,       // User Public Key (for timeout refund)
    bytes32 adaptorPoint,  // Public Adaptor Point T
    int timeoutBlocks      // Refund locktime threshold
) {
    // 1. Claim Branch: Solver provides valid signature + adaptor pre-image
    function claim(sig claimerSig, bytes adaptorSecret) {
        require(checkSig(claimerSig, claimerPk));
        bytes32 revealedPoint = sha256(adaptorSecret);
        require(revealedPoint == adaptorPoint);
    }

    // 2. Refund Branch: Maker recovers funds if solver times out
    function refund(sig refundSig) {
        require(checkSig(refundSig, refundPk));
        require(tx.age >= timeoutBlocks);
    }
}
```

---

## 4. Key Advantages

1. **Zero Centralized Custody:** Funds are locked in peer-to-peer cryptographic covenants and 2-of-2 multisig.
2. **No Wrapped Tokens:** Both parties receive native BCH satoshis and native XMR coins on their respective blockchains.
3. **Privacy Preserved:** Monero transactions remain untraceable RingCT transfers with no special script footprint.
