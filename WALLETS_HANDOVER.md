# Multi-Chain Wallet Integration — Handover & QA Testing Guide

**Date:** October 2026  
**Workspace:** `frontend` (`Cham` / Intent Protocol)  
**Supported Chains:** Bitcoin Cash (`bch`), EVM (`evm`), Solana (`solana`), Bitcoin (`btc`)

---

## 1. Architecture & Source Map

| Layer | File | Description |
|---|---|---|
| **Multi-Chain Registry** | [`src/lib/wallets/registry.ts`](file:///c:/Users/Antony%20Dev/Desktop/Movement/movedapp/ubuntu/Intent-protocol/frontend/src/lib/wallets/registry.ts) | LocalStorage-persisted store holding all connected wallets (`id`, `family`, `address`, `network`, `label`, `icon`). |
| **AppKit Lazy Loader** | [`src/lib/wallets/appkit.ts`](file:///c:/Users/Antony%20Dev/Desktop/Movement/movedapp/ubuntu/Intent-protocol/frontend/src/lib/wallets/appkit.ts) | Lazy singleton initializer for Reown AppKit. Registers `EthersAdapter`, `SolanaAdapter`, `BitcoinAdapter`, and custom Arc network. |
| **AppKit Bridge** | [`src/lib/wallets/appkitBridge.ts`](file:///c:/Users/Antony%20Dev/Desktop/Movement/movedapp/ubuntu/Intent-protocol/frontend/src/lib/wallets/appkitBridge.ts) | Bridges AppKit account events (`eip155`, `solana`, `bip122`) into the wallet registry. Manages reconnect markers, network switches, and provider getters. |
| **Connect Flow State Machine** | [`src/components/wallet/connect/useConnectFlow.ts`](file:///c:/Users/Antony%20Dev/Desktop/Movement/movedapp/ubuntu/Intent-protocol/frontend/src/components/wallet/connect/useConnectFlow.ts) | Handles step transitions (`pick` → `chain` → `qr` / modal → `connected`). |
| **Chain Picker UI** | [`src/components/wallet/connect/ChainPicker.tsx`](file:///c:/Users/Antony%20Dev/Desktop/Movement/movedapp/ubuntu/Intent-protocol/frontend/src/components/wallet/connect/ChainPicker.tsx) | Selection cards for BCH, EVM, Solana, and Bitcoin (all enabled: `available: true`). |
| **BCH External Provider** | [`src/context/ExternalBCHWalletProvider.tsx`](file:///c:/Users/Antony%20Dev/Desktop/Movement/movedapp/ubuntu/Intent-protocol/frontend/src/context/ExternalBCHWalletProvider.tsx) | Manages BCH WizardConnect and WalletConnect pairings for native BCH. |
| **Holdings & Guard Hooks** | [`src/swap-server/useHoldings.ts`](file:///c:/Users/Antony%20Dev/Desktop/Movement/movedapp/ubuntu/Intent-protocol/frontend/src/swap-server/useHoldings.ts) | Address-guarded query hooks preventing rogue API refetches when addresses are empty/null. |

---

## 2. Automated Testing Commands

### Run Unit Tests
```bash
# In frontend directory — every wallet suite, plus the swap-server suites that sign with wallets:
node node_modules/vitest/vitest.mjs run src/lib/wallets src/components/wallet src/hooks/__tests__ \
  src/swap-server/__tests__/holdings.test.ts src/swap-server/__tests__/flows.test.ts src/swap-server/__tests__/signers.test.ts
```
Expected output (2026-10-22): `Test Files 15 passed (15)`, `Tests 134 passed (134)`. Takes about 4 minutes on the 8 GB dev machine; run nothing else heavy alongside it.

If most suites report `0 test` with `Cannot find package …node_modules\ws\index.js`, the `ws` package
was left half-installed by an interrupted `npm install` (an empty `node_modules/ws/lib`). Reinstall it
(`npm install` with the dev server stopped), or unpack the locked tarball (`ws@8.20.0`) into `node_modules/ws`.

`src/swap-server/__tests__/routing.test.ts` and `mainnet.test.ts` currently fail (20 tests): routing now
returns a `bch-crosschain` route for BCH pairs the tests expect to be left to the old flows. That is
swap routing, not wallet code; decide which side is right before fixing either.

### Dev Server Check
```bash
# Start dev server:
npm run dev

# Verify health check in powershell:
powershell -Command "(Invoke-WebRequest -Uri 'http://localhost:5173/' -UseBasicParsing).StatusCode"
# Output: 200
```

---

## 3. Step-by-Step Manual QA Testing Script

### Flow A: Bitcoin Cash (BCH) Connection
1. Open `http://localhost:5173/`.
2. Click **Connect Wallet** in the top navigation bar.
3. On Step 1 (**Pick**), choose **Connect another wallet**.
4. On Step 2 (**Which chain?**), click **Bitcoin Cash**.
5. **WizardConnect / WalletConnect QR Step**:
   - Toggle between **WizardConnect** and **WalletConnect**.
   - Verify that a valid pairing QR code and deep-link URI are generated.
   - Scan with Paytaca, Cashonize, or Zapit wallet.
6. **Verification**:
   - Connected dialog displays address, balance, and network.
   - Active wallet pill in navbar updates to the connected BCH address.

---

### Flow B: Ethereum & EVM Connection
1. Open **Connect Wallet** → **Connect another wallet**.
2. Click **Ethereum & EVM**.
3. **AppKit Modal Appears**:
   - Verify AppKit modal opens with EVM options (MetaMask, Rabby, Coinbase Wallet, WalletConnect).
   - Connect an EVM browser extension or scan WalletConnect QR with a mobile EVM wallet.
4. **Network Switching**:
   - Switch between Mainnet and Testnet via the app header toggle.
   - Verify AppKit prompts to switch to Sepolia / Arc / Base accordingly.
5. **Disconnect**:
   - In wallet settings/modal, click **Disconnect**.
   - Verify registry clears `appkit-evm` and `appkit_connected_v1` marker.
6. **Reload survival**: reload the page with the EVM wallet connected; it must still be listed after AppKit reconnects (a few seconds).

---

### Flow C: Solana Connection
1. Open **Connect Wallet** → **Connect another wallet**.
2. Click **Solana**.
3. **AppKit Modal Appears**:
   - Verify Solana wallet list is displayed (Phantom, Solflare, Backpack).
   - Approve connection in Phantom/Solflare.
4. **Verification**:
   - Registry registers wallet with ID `appkit-solana` and family `solana`.
   - Solana address format (`Base58`, ~44 chars) is displayed properly.
   - Switch mode toggle between Mainnet / Testnet and confirm network switches between Solana Mainnet and Devnet.

---

### Flow D: Bitcoin (BTC) Connection
1. Open **Connect Wallet** → **Connect another wallet**.
2. Click **Bitcoin** (`available: true`, Amber accent `#f59e0b`).
3. **AppKit Modal Appears**:
   - Verify AppKit opens under the `bip122` namespace.
   - Connect Xverse, Leather, UniSat, or OKX Bitcoin wallet.
4. **Verification**:
   - Registry adds wallet with ID `appkit-btc`, family `btc`.
   - Bitcoin address (Native SegWit `bc1...` / `tb1...` or Taproot) is displayed.
   - In DevTools console, verify `localStorage.getItem('appkit_connected_v1')` includes `"btc"`.

---

## 4. Developer Console Debugging & Verification

Open Chrome / Browser DevTools (`F12`) on `http://localhost:5173/` and run:

```javascript
// 1. Inspect registered wallets:
JSON.parse(localStorage.getItem('ext_wallets_v2') || '[]')

// 2. Inspect active AppKit reconnection markers:
JSON.parse(localStorage.getItem('appkit_connected_v1') || '{}')

// 3. Inspect the active wallet per chain ({ bch, evm, solana, btc }; 'main' or null = built-in):
JSON.parse(localStorage.getItem('active_wallet_ids_v2') || '{}')

// 4. Test provider getters directly:
const { getAppKitEvmProvider, getAppKitSolanaProvider, getAppKitBitcoinProvider } = await import('/src/lib/wallets/appkitBridge.ts');

const evmProvider = await getAppKitEvmProvider();
console.log('EVM Provider:', evmProvider);

const solProvider = await getAppKitSolanaProvider();
console.log('Solana Provider:', solProvider);

const btcProvider = await getAppKitBitcoinProvider();
console.log('Bitcoin Provider:', btcProvider);
```

---

## 5. How the AppKit bridge behaves (rules the code relies on)

- **Only requested chains are registered.** A chain is added when its connect flow is open (`openAppKitConnect`) or it has a reconnect marker. A multi-chain wallet that approves extra namespaces over WalletConnect does not add surprise wallets.
- **`connecting` / `reconnecting` are not disconnects.** On page load AppKit reports every namespace as `connecting` until it reconnects; reads made by polling (start-up, modal close, mode switch) remove a wallet only on an explicit `disconnected`. A delayed re-read 10 s after start cleans up sessions that ended while the app was closed.
- **Name and icon per namespace** (`getWalletInfo(namespace)`), so MetaMask (EVM) and Phantom (Solana) keep their own labels and icons.
- **Mode switch:** `handleModeSwitch` runs from `ExternalBCHWalletProvider` on every Testnet/Mainnet change. AppKit rows move to the new mode; Solana and Bitcoin are switched to the mode's network; EVM is not (the EVM sender switches to the exact chain right before it sends, so the wallet is not prompted on every toggle).
- **No injected fallbacks.** `getAppKitEvmProvider` / `getAppKitSolanaProvider` / `getAppKitBitcoinProvider` return null unless that chain's AppKit wallet is connected; they never fall back to `window.ethereum`, `window.phantom`, etc.
- **EVM sends refuse a different account.** If the wallet's selected account is not the connected address, the AppKit EVM sender throws before anything is signed or journaled.

## 6. Known gaps (not built)

- **Bitcoin signing:** a Bitcoin wallet connects and shows its address, but nothing in the app signs or sends BTC with an external wallet yet (Phase 8 of the plan). The handover snippet below for BTC is a sketch, not working code.
- **Per-row balances for EVM / Solana / Bitcoin:** the wallet list shows the chain for those rows; their balances appear in the Tokens tab for the active wallet of each chain.
- **Brand logos:** `public/logos/wallets/` holds placeholders for Cashonize, Paytaca and WalletConnect. AppKit and WalletConnect wallets show the icon their session provides.
- **Production project ID:** `VITE_WC_PROJECT_ID` is not set in any `.env`; a production build falls back to the dev project ID (now logged as an error). Set it to the Reown project that allow-lists `intentsprotocol.xyz`.

## 7. Implementation Guide: Using Wallets in Swaps & Signing

When executing a swap or intent requiring user signature:

### EVM Signing (EIP-1193)
```typescript
import { getAppKitEvmProvider } from '@/lib/wallets/appkitBridge';
import { BrowserProvider } from 'ethers';

const rawProvider = await getAppKitEvmProvider();
if (!rawProvider) throw new Error('EVM wallet not connected');

const provider = new BrowserProvider(rawProvider);
const signer = await provider.getSigner();

// Send transaction or sign message:
const tx = await signer.sendTransaction({
  to: targetAddress,
  value: amountWei,
  data: callData,
});
await tx.wait();
```

### Solana Signing
```typescript
import { getAppKitSolanaProvider } from '@/lib/wallets/appkitBridge';

const solana = await getAppKitSolanaProvider();
if (!solana) throw new Error('Solana wallet not connected');

// solana.signTransaction(tx) or solana.signAndSendTransaction(tx)
const { signature } = await solana.signAndSendTransaction(transaction);
```

### Bitcoin Signing (BIP-122 / Sats-Connect)
```typescript
import { getAppKitBitcoinProvider } from '@/lib/wallets/appkitBridge';

const btc = await getAppKitBitcoinProvider();
if (!btc) throw new Error('Bitcoin wallet not connected');

// Depending on provider (Xverse / Leather / UniSat):
// UniSat: await btc.sendBitcoin(toAddress, satoshis);
// Xverse / Sats-Connect: await btc.request('sendTransfer', { ... });
```
