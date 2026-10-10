# Wallet icons

Placeholders, one per wallet the app can connect. Replace a file with the real logo and keep its name:

| File | Shown for |
|---|---|
| `main.svg` | The built-in wallet |
| `cashonize.svg` | Cashonize |
| `paytaca.svg` | Paytaca |
| `walletconnect.svg` | Any other WalletConnect wallet |
| `bch-intents.svg` | The BCH Intents Wallet browser extension |

Square artwork, SVG preferred. To use a PNG, change the extension in `src/components/wallet/WalletIcon.tsx`.
If a file is missing the app falls back to a generic wallet glyph.
