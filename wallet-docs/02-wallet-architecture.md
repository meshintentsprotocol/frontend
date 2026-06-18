# Hybrid Wallet Architecture

This document outlines the technical changes required to support a hybrid wallet model (WDK + External WalletConnect providers) in the frontend architecture.

## 1. Current Architecture Overview

Currently, the `WDKProvider.tsx` acts as the single source of truth. It holds one `seedPhrase` and derives one signer per chain:
- `evmSigner`
- `solanaSigner`
- `bchChipnetAddress` / `bchMainnetAddress` (via mainnet-js)

The `BCHSwapContext.tsx` assumes that `useBCHWallet()` will always return an object that contains a `getWIF()` method (meaning it assumes it always has the private key locally).

## 2. Proposed Architecture: The "Account Aggregator" Model

To support W1, W2, W3 (WDK derivations) alongside external WalletConnect sessions, we must abstract the concept of a "Wallet Signer".

### 2.1 The Unified Signer Interface
Instead of relying on `getWIF()`, the application must depend on an abstracted interface capable of handling both local and remote signing.

```typescript
type WalletSource = 'WDK' | 'WalletConnect' | 'Phantom' | 'MetaMask';

interface UnifiedBCHSigner {
  id: string;                    // e.g., "wdk-0", "walletconnect-1"
  address: string;               // The public BCH address
  tokenAddress: string;          // Token-aware cashaddr
  source: WalletSource;          // Where the keys live
  label: string;                 // e.g., "BCH Web Wallet 1", "Paytaca Mobile"
  
  // Signing methods MUST be async to support external wallet prompts
  signTransaction: (txHex: string) => Promise<string>;
  signMessage: (message: string) => Promise<string>;
  
  // Only defined if source === 'WDK'
  getWif?: () => string; 
}
```

### 2.2 Global Wallet State Management

We need a central store (e.g., `UnifiedWalletProvider.tsx` or a refactored `WDKProvider`) that holds arrays of these interfaces.

```typescript
interface GlobalWalletState {
  // All connected/derived wallets per chain
  bchWallets: UnifiedBCHSigner[];
  solWallets: UnifiedSolanaSigner[];
  evmWallets: UnifiedEVMSigner[];

  // Pointers to the currently "Active" wallet for transactions
  activeBCHWalletId: string | null;
  activeSolWalletId: string | null;
  activeEVMWalletId: string | null;
}
```

## 3. Handling External Providers

### 3.1 WalletConnect for BCH
When a user clicks "Connect Cashonize":
1. We initialize `@walletconnect/universal-provider`.
2. Request the `bch:bitcoincash` (mainnet) or `bch:bchtest` (chipnet) namespace.
3. WalletConnect returns a session with the user's BCH address.
4. We wrap this session in the `UnifiedBCHSigner` interface.
   - The `signTransaction` method will call `provider.request({ method: 'bch_signTransaction', params: ... })`.
5. We push this new signer to `bchWallets` and set `activeBCHWalletId` to its ID.

### 3.2 Bridging with CashScript
Currently, `BCHSwapContext.tsx` relies heavily on `TransactionBuilder` and `SignatureTemplate(wif)` from `cashscript`.

**The Challenge:** `SignatureTemplate` strictly requires a private key (WIF) to build the transaction locally. WalletConnect wallets *will not* give us the WIF.

**The Solution:** 
When using an external wallet, we must build the raw unsigned transaction (or PSBT equivalent) and send it to the WalletConnect provider to be signed by the external app, rather than signing it inline with CashScript's builder. 

If the user selects a WDK wallet as "Active", we continue using `SignatureTemplate(wif)`.

```typescript
if (activeWallet.source === 'WDK') {
    // Legacy flow: Sign locally
    builder.addInputs(utxos, new SignatureTemplate(activeWallet.getWif()));
    const tx = await builder.send();
} else if (activeWallet.source === 'WalletConnect') {
    // External flow: Build unsigned tx, send to mobile
    const unsignedTxHex = builder.buildUnsignedHex();
    const signedTxHex = await activeWallet.signTransaction(unsignedTxHex);
    await broadcastRawTx(signedTxHex);
}
```

## 4. Local Storage & Persistence

The hybrid model complicates persistent storage:
- **WDK Seed:** Continues to be stored securely via AES-GCM encryption in `localStorage`.
- **WDK Derivation Config:** We must store which accounts the user has generated (e.g., `wdk-accounts: [0, 1]`) so we restore W1 and W2 on reload.
- **WalletConnect Sessions:** WalletConnect handles its own session persistence internally. On page reload, we query the `universal-provider` for active sessions and re-hydrate the `bchWallets` array.
- **Active Selection:** Store the `activeBCHWalletId`, etc., in standard `localStorage` so the user's preference is remembered across reloads.
