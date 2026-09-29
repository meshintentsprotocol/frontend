---
title: Wallet adapter
description: Implement four methods and any BCH wallet can create and fund intents through the SDK.
status: draft
updated: 2026-09-28
sources: bch-intents-sdk/packages/sdk-wallet-adapter/src/BCHSigner.ts, devrel-agent-context/sdk/wallet-adapter/01-sdk-wallet-adapter-wizardconnect.md, devrel-agent-context/sdk/wallet-adapter/02-sdk-wallet-adapter-walletconnect.md
---

## The `BCHSigner` interface

```typescript title="BCHSigner.ts"
export interface BCHSigner {
  /** Connected wallet's cashaddr, e.g. bchtest:qq… */
  getAddress(): Promise<string>;
  /** 20-byte public key hash, used in covenant constructor args. */
  getPkh(): Promise<Uint8Array>;
  /** Full public key, for signing and verification. */
  getPublicKey(): Promise<Uint8Array>;
  /** Send BCH (and optionally a CashToken) — used to fund intent covenants. */
  send(toAddress: string, satoshis: bigint, token?: { category: string; amount: bigint }): Promise<string>;
}
```

## Built-in adapters

| Adapter | Use it for |
| --- | --- |
| `MainnetJSAdapter` | Node scripts, bots and tests using a mainnet-js wallet |
| `EmbeddedWalletAdapter` | Wallets embedded in your app |
| `WalletConnectAdapter` | Browser dapps talking to mobile wallets (Cashonize, Paytaca…) |
| `WizardConnectAdapter` | WizardConnect-compatible wallets |

> [!WARNING] Funding covenants
> A generic `send()` to a P2SH32 address can produce the wrong output script with some libraries. When you implement `send` for covenant funding, build the output from the covenant's locking bytecode and check it before broadcasting.

## To document

- Connecting WalletConnect / WizardConnect step by step
- Raw transaction signing (planned `signTransaction()`)
- Signing `cancelEarly()` and `dock()` through an adapter
