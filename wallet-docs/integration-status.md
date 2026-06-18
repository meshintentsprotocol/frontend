# External Wallet Integration Status

## Current Infrastructure
The dApp currently utilizes two distinct wallet providers running in parallel:
1. **WDK Provider (Main Wallet)**: Built on Tetherto's WDK. It handles full key derivation (HD paths), Bitcoin and EVM support, and powers the primary portfolio tracking via `usePortfolio`.
2. **External BCH Wallet Provider**: A custom multi-wallet provider that aggregates connections from WalletConnect v2 (Cashonize) and WizardConnect (Paytaca).

### Multiple Wallet Support
**Is it okay to allow users to connect more than one external wallet?**
Yes! The architecture is explicitly designed to support connecting multiple external wallets simultaneously. Because the External Wallet Provider simply stores an array of active sessions (with their respective `source`, `address`, and `sessionTopic`), you can have a Paytaca wallet and a Cashonize wallet connected at the same time. The UI maps over these connections and assigns them sequential identifiers (Wallet 2, Wallet 3, etc.).

## Open Issues & Workarounds

### 1. Cashonize "Unsafe Protocol" (WalletConnect V2)
- **Status**: **Blocked Locally (Without HTTPS)**
- **Cause**: WalletConnect's Verify API securely reports the actual origin (`http://localhost`) to Cashonize at the WebSocket level. Cashonize drops non-HTTPS connections.
- **Solution**: The developer must run the Vite dev server with HTTPS (e.g. `@vitejs/plugin-basic-ssl`) or use a tunneling service (`ngrok`) during local development. In production (where the dApp is hosted on `https://`), this error will disappear automatically.

### 2. Paytaca (WizardConnect)
- **Status**: **Partially Complete**
- **Cause**: The connection generates the proper pairing URI, but currently only displays a QR code.
- **Next Steps**: Implement deep-linking (`paytaca://wizardconnect?uri=...`) to allow mobile and desktop extension users to smoothly open the Paytaca app without manually scanning the QR code.

### 3. Unified Wallet Display Routing
- **Status**: **In Progress**
- **Task**: The user requested that the `WalletTokensTab` acts as a global router between the Main Wallet and External Wallets, using the exact same display component for both.
- **Complexity**: WDK Main Wallet token balances and USD prices come from `usePortfolio` (with live indexer prices). External wallets fetch static UTXO counts via `useBchAddressBalance` which currently lacks USD pricing data. The UI must cleanly unify these two data sources.
