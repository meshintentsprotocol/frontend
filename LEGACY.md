# Legacy Code Clean-Up Checklist

Retired on **2026-10-19** as part of Phase L (Wallet Connection & Refactor).  
These files are kept for reference until after the beta clean-up. None are part of the live application routes or providers.

---

## Group A: Redirected Pages
These pages are unrouted or redirected to `/` in `App.tsx`.

| File | Why It Is Old | What Replaced It |
| --- | --- | --- |
| `src/pages/SwapPage.tsx` | Earlier Movement swap page | `/trade` (via `BchSwapPage.tsx`) |
| `src/pages/OrdersPage.tsx` | Movement swap orders | Live orders modal / tab in `/trade` |
| `src/pages/ProPage.tsx` | Standalone Pro interface | Mesh / Orderbook pages (`MeshPage.tsx`, `OrderbookPage.tsx`) |
| `src/pages/ResolverPage.tsx` | Early Dutch resolver UI | Automated solvers |
| `src/pages/SolverPage.tsx` | Early solver UI | Standalone resolver / relayer services |
| `src/pages/CrossChainPage.tsx` | Old cross-chain swap interface | Swap server CCTP / 1Click routing |
| `src/pages/CrossOrders.tsx` | Old cross-chain orders list | Live orders list |
| `src/pages/OverviewPage.tsx` | Old dashboard | Landing page (`LandingPage.tsx`) / Portfolio |

---

## Group B: Unrouted Components
These components were imported only by Group A pages or unreferenced.

| File / Directory | Why It Is Old | What Replaced It |
| --- | --- | --- |
| `src/pages/WalletPage.tsx` | Old embedded wallet page | Standalone Cham Wallet (`https://chamwallet.vercel.app`) |
| `src/components/bch/BCHWalletPanel.tsx` | Old BCH wallet tab panel | `components/wallet/` & AppKit/WizardConnect modals |
| `src/components/intent-swap/*` | Movement swap widget components | Live `/trade` card |
| `src/components/pro/*` | Pro chart / orderbook components | Mesh orderbook (`OrderbookPage.tsx`) |

---

## Group C: Old Admin & Oracle Pages
Retired administration and oracle tooling.

| File / Route | Why It Is Old | What Replaced It |
| --- | --- | --- |
| `src/pages/OraclePage.tsx` (`/oracle`) | Standalone oracle price testing page | Automated relayer price feeds |
| `src/pages/AddTokenPage.tsx` (`/add-token`) | Legacy Movement token registration | Curated token registry |
| `src/pages/AdminPage.tsx` (`/admin/legacy`) | Legacy Movement admin console | `/admin` consolidated admin routes |
| `src/pages/AdminPoolPage.tsx` (`/adminpool`) | Old liquidity pool admin panel | Mesh pool management |

---

## Group D: Movement Features & Monitor
Retired Movement monitoring, bento card, and chain routes.

| File / Component | Why It Is Old | What Replaced It |
| --- | --- | --- |
| `src/pages/MonitorPage.tsx` (`/monitor`) | Movement swap order monitor | Explorer / Mesh transaction view |
| `src/components/landing/bento/MovementSwapsCard.tsx` | Bento card showcasing Movement swaps | Live Mesh / multi-chain cards |
| `src/components/transactions/TransactionsTable.tsx` | Movement order history fetching via `useSwap` | Token & account transactions |
| `src/components/wallet/sendChains.ts` | Movement chain in Send modal | Native BCH / EVM / Solana chains |
| `src/components/wallet/ReceiveModal.tsx` | Movement address selection in Receive modal | Native multi-chain wallets |

---

## Group E: Old /trade Flows
Dead HTLC and ZK swap methods in `BCHSwapContext.tsx`.

| Method / Flow | Why It Is Old | What Replaced It |
| --- | --- | --- |
| `executeBCHToSolana`, `executeSolanaToBCH` | Dead HTLC flow | 1Click / CCTP bridge |
| `executeETHToBCH`, `executeBCHToETH` | Dead FRI/ZK verifier flow | 1Click bridge |
| `executeBCHToMovement`, `executeMovementToBCH` | Movement HTLC flow | Marked `(Soon)` in token selector |
| `executeSolanaToMovement`, `executeMovementToSolana` | Movement HTLC flow | Marked `(Soon)` in token selector |
| `executeBCHToXMR`, `executeXMRToBCH` | Monero adaptor swap flow | Marked `(Soon)` in token selector |

---

## Group F: Retired Providers
Global providers unmounted from `App.tsx` and `main.tsx`.

| Provider File | Why It Is Old | What Replaced It |
| --- | --- | --- |
| `src/context/SwapContext.tsx` | Movement swap provider | `BCHSwapContext` & `SwapServerRoot` |
| `src/context/CrossChainContext.tsx` | Old cross-chain provider | `SwapServerRoot` (CCTP) & 1Click |
| `src/context/wallet-provider.tsx` | Movement/Aptos wallet provider | Multi-chain wallet store (`lib/walletStore.ts`) |
| `CashonizeProvider` in `BCHWalletProvider.tsx` | Old Cashonize wallet state | External BCH provider (`ExternalBCHWalletProvider.tsx`) |
