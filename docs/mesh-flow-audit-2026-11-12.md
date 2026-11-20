# Mesh flow audit - 12 November 2026

## Scope and environment

Reviewed frontend creation, owned positions, public pairs/pools/strategies, V4 detail and owner actions, alongside the meshserver APIs and existing integration/live tests. Frontend ran at http://localhost:5173 against the deployed Chipnet Mesh server. Cham Wallet was connected through its existing localhost wallet. Work was performed in frontend and BCHMesh/meshserver; existing unrelated changes were preserved.

## Changes

- All pools now includes public V4 range positions, with balances, funded bins, status and detail links, alongside V3 pools. V4 listings have loading/error/retry states and client pagination.
- Position totals exclude child pools already accounted for inside V3 strategies.
- Position ranges fetch market reference prices; V4 range boundaries include the final bin ask, matching detail pages.
- Zero token decimals remain zero. Indexed multi-pair params.tokens categories resolve into the proper multi-token labels and metadata.
- Failed position requests show an incomplete-data alert and retry control. Loading pairs no longer flash a false empty state.
- Pool query placeholders do not carry another wallet's data across an owner change.
- Desktop and mobile position avatars receive token metadata. Expanded desktop bin amounts apply token decimals, and mobile bin breakdowns now include token balances.
- Empty V4 detail pages show Closed after withdrawal.
- Mesh landing statistics now use tvlSats, activePools and volume24hSats from the actual API.
- Added regression coverage for double counting, the final V4 ask boundary and indexed multi-token labels.

## Verification

- Final frontend Mesh suite: 235 tests passed across 15 files (including all three new regressions).
- Focused create/routes checks: 70 passed.
- Dashboard tests after all three added regressions: 9 passed.
- Server integration: 50 passed across v4.api.test.ts and pools.v3.api.test.ts.
- Isolated live Chipnet V4 lifecycle: 24 checks passed, zero failed. Covered genesis and metadata, both trade directions, bin reuse, NFT transfer, old-owner withdrawal rejection, new-owner withdrawal, on-chain activity, V3-to-V4 migration and return of remaining test assets to the funder.
- Project-wide TypeScript still reports errors outside Mesh. A subsequent check filtered to Mesh files returned no Mesh diagnostics after the avatar/statistics corrections.
- Browser: public pairs and depth chart loaded; All pools rendered the four original active V4 positions and paginated V3 pools; V4 detail displayed bins and activity; connected Cham discovered its V4/V3 positions and exposed owner controls.
- Browser owner actions: original position withdrawal plan was built and verified without broadcasting; transfer form displayed recipient/custody requirements.
- Browser create: settings advanced to deposit review; 0.002 BCH linked to 0.46 PUSDTEST; the final plan verified all ten bins and the NFT; Cham signed and broadcast; Mesh registered the new position and its detail page recognized ownership.
- Browser cleanup: all liquidity from that newly created position was withdrawn back to Cham. API verification returned sats=0, tokens=0, funded bins=0. The empty NFT remains in Cham and appears as a closed position.
- Public strategy cards loaded all five active strategies. Strategy-to-pool navigation loaded the multi-pair strategy and V3 pool detail with reserves, accepted assets, activity and owner controls.
- Mobile at 390px: owned cards and expanded bins rendered without horizontal overflow; corrected token balances were verified in the rendered page.

### Browser transaction evidence

- Test category: b6602ccda85b7fa4e85c70c97f2c0f6ec5787e9b198fc687d3b8f4959dfb4265
- Creation: https://chipnet.imaginary.cash/tx/89269f7539483e0c8ad6a64edfb4a63ea20833a37e2d2396b51516eb7173f909
- Cleanup withdrawal: https://chipnet.imaginary.cash/tx/02f97e9a7448743eba6c02e7cd5031fa996e35a285323dcc83e5d4b82e7918ac
- Creation network fee: 1,575 sats. Cleanup network fee: 3,990 sats. The creation also included NFT/metadata outputs and token-bin carriers, separately shown in its review.

## Recommended next work

1. Aggregate V4 into public TVL, volume, provider and pair summaries. V4 bins appear in depth and the new listing, while existing pool statistics/pair summaries primarily describe the covenant-pool ledger. Display explicit engine scope until the APIs are unified.
2. Add complete server pagination for public V4 positions and owned-pool aggregation. Current owned pool query defaults to 100 pools; the V4 public endpoint caps a request at 200. The new V4 listing explicitly notes when its fetched set is truncated.
3. Distinguish Active/Unknown from In range when an independent market price is unavailable. The current coverage fallback can still call a funded position in range without a market comparison.
4. Make V4 earned spread/PnL and unavailable fee history explicit. V4 dashboard fee fields currently contain placeholder zeros; do not treat these as audited earnings.
5. Verify persistent Railway storage mounted for the pool/position stores before relying on state surviving a redeploy. The prior handover identified ephemeral storage; this run did not alter hosting.
6. Add repeatable browser regression coverage for wallet restore, create/sign/register, withdraw/refresh, public tabs, pagination, mobile layouts and error states. Keep funded transaction tests on Chipnet.
7. Improve initial loading during large dev-module fetches and wallet rehydration so users do not briefly see a blank page or disconnected empty state.

## Reproduce

From frontend:

    node node_modules/vitest/vitest.mjs run src/lib/mesh/

From BCHMesh/meshserver:

    node node_modules/jest/bin/jest.js test/integration/v4.api.test.ts test/integration/pools.v3.api.test.ts --config jest.config.cjs --runInBand --forceExit
    node node_modules/tsx/dist/cli.mjs test/e2e/e2e_v4_api_live.ts

The live command spends Chipnet test funds using the existing local test configuration. Its data/v4_api_live_* results include throwaway test-wallet recovery material; keep those local rather than publishing raw results. This audit deliberately includes only public transaction identifiers and test counts.