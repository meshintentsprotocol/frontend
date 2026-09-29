---
title: Installation
description: Install the SDK, pick a wallet adapter and configure your bundler for browser builds.
status: ready
updated: 2026-09-28
sources: bch-intents-sdk/README.md, frontend/vite.config.ts
---

## Install

```codegroup
@@ Everything | bash
npm install @bch-intents/sdk mainnet-js
@@ Builders only | bash
npm install @bch-intents/sdk-cashtokens @bch-intents/sdk-common
@@ Wallet adapter only | bash
npm install @bch-intents/sdk-wallet-adapter
```

`mainnet-js` is only needed if you use the `MainnetJSAdapter`. Browser wallets can use the WalletConnect or WizardConnect adapters instead.

## Browser builds

CashScript and libauth expect a few Node globals. With Vite, add polyfills:

```typescript title="vite.config.ts" {2,7-9}
import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({ globals: { Buffer: true, global: true, process: true }, protocolImports: true }),
  ],
  define: { global: 'window' },
});
```

## Verify

```typescript title="check.ts"
import { IntentBuilder, TokenId, Duration } from '@bch-intents/sdk';

const params = IntentBuilder.dutchAuction()
  .makerAddress('bchtest:qr…')
  .sellToken(TokenId.BCH)
  .buyToken('<token category>')
  .sellAmount(100_000n)
  .startBuyAmount(50n)
  .endBuyAmount(40n)
  .duration(Duration.hours(1))
  .build();

console.log(params);
```
