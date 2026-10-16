---
title: V4 positions
description: Mesh V4 liquidity positions are NFTs that own in-place bins on a price grid. What they are, how to create, trade, transfer and withdraw them, and what to watch out for.
status: ready
updated: 2026-10-16
sources: contracts-bch-swap/v4/docs/MeshBinV4.md, contracts-bch-swap/v4/docs/PositionNft.md, docs-site/docs/LPS/v4plan/DECISIONS.md, BCHMesh/meshserver/src/api/routes/v4.ts
---

**Mesh V4** turns a liquidity position into **an NFT you hold**. The NFT owns a set of **bins**, small pools that each sit at one price on a shared grid. Traders buy and sell through the bins. Whoever holds the NFT can withdraw or move the liquidity, and sending the NFT to someone else hands them the whole position.

V4 is built on Bitcoin Cash covenants and CashTokens. No admin key can touch your funds, and no keeper can move them unless you set one up.

## What's new compared with V3

| | V3 pools | V4 positions |
|---|---|---|
| A price level | A pool that pays out into a separate "proceeds" output; fills leave fragments behind | **One bin that flips in place**: the same UTXO buys tokens at its bid and sells them back at its ask |
| Cost per price level a trade crosses | ~1,100 bytes | **~400 bytes** (about 2.7× cheaper) |
| Who owns it | The key that created it | **Whoever holds the position NFT**: it can be sent, sold or held by a vault |
| Fragmentation | Pools split into many small UTXOs over time | Each bin stays **one UTXO** |
| Your earnings | A fee on each fill | The **spread**: each bin buys one grid step below where it sells, and compounds in the bin |

V3 keeps working for token↔token pairs and existing positions. V4 is for BCH↔token pairs.

## How a bin works

A bin holds BCH, the pair's token, or both. It has two prices one grid step apart:

- **bid:** the price at which it buys the token (pays BCH);
- **ask:** one step higher, the price at which it sells the token.

When the market falls through a bin, traders sell it tokens at its bid, and it fills up with tokens. When the market rises back, traders buy those tokens at its ask, one step higher. The bin keeps the difference and returns to BCH. It is always the same UTXO at the same address. A V4 bin never splits.

Bins sit on a **shared price grid**, where level *i* is (1 + step)^*i* sats per token unit. With a 1% step, levels are 1% apart. Every position uses the same levels, so liquidity from many LPs stacks up at the same prices.

## Create a position

In the app: **Pool → New pool → Range**. For a BCH/token range the engine switch at the top of the preview is set to **V4 bins** (choose **V3 pools** to deploy the older way).

1. **Choose the pair, the range and the step.** For example: pUSD, 1% step, from about 1,940 to 2,020 sats per pUSD unit.
2. **Say where the market is.** Bins at or below the market price start as **BCH bids** (they wait to buy the token as the price falls). Bins above it start as **token asks** (they wait to sell as the price rises).
3. **Choose the deposits and the shape.**
   - *Spot* puts the same amount in every bin.
   - *Curve* puts most of it near the market.
   - *Bid-ask* puts most of it at the edges.
4. **Sign one transaction.** It creates the position NFT, funds every bin and publishes the position's metadata. Your wallet needs a coin that is "output #0" of its transaction; the app can make one with a small self-send.

The app (or the API's `preview`) shows every bin before you sign: its prices, what goes into it, and the transaction size. Before the review opens, your browser checks the plan itself: every bin's address is rebuilt from the audited contract, each bin's prices must be the grid prices of its level, the NFT must go to your wallet, and nothing may be paid anywhere else. If any check fails, the app refuses to continue.

V4 bins have no separate fee: a bin buys at its level and sells one level up, so each round trip earns the bin step.

## Your positions in the app

- **Pool → My pools** lists every V4 position whose NFT your wallet holds, including ones you bought or received, above your V3 strategies.
- The **position page** shows the name, the NFT, who holds it, whether the market is inside the range, and its value. It also has a strip of bins on the price grid (BCH waiting to buy, tokens waiting to sell, market marked) and every deposit, fill and withdrawal read from the chain.
- The **depth chart** on the Pools tab shows V4 bins in a darker shade on the same price levels as V3 pools.

## Your position NFT

- It shows up in **CashToken wallets** such as Cashonize and Paytaca with its name and details: pair token, bin step, price levels, number of bins and creation block. Wallets read this from the position's **metadata**, a small file stored on IPFS whose fingerprint is written on chain, so it can't be swapped.
- **Holding it is owning the position.** To withdraw, your wallet signs with the NFT; the bins check that the NFT is in the transaction.
- **Sending it sends the position**, with everything the bins hold. Only send it to someone you mean to give the position to.

## Trading through V4 bins

Traders don't do anything differently. Quotes and swaps route through V4 bins together with V3 pools and Cauldron, and one swap can cross many bins in one transaction. Each bin's price check is enforced by its own covenant, so a trader can never take more from a bin than its price allows.

## Withdraw

Withdraw some or all bins in one transaction. The app asks the server for a **withdraw plan**, and your wallet signs only the NFT input. The bins release their BCH and tokens to you, and the NFT comes back to you unchanged. The network fee comes out of what you withdraw.

On the position page: **Withdraw**, choose all bins or some, **Prepare**, then sign. The app checks the plan against your position's bins before you sign.

You can also withdraw to rebuild the position at new prices: withdraw, then create a new position (or reuse the NFT's bins at new levels in a later version with a keeper).

## Send the position

On the position page: **Send**, enter a wallet address and confirm. The NFT moves to that wallet, and with it every bin: the new holder can withdraw everything, and you no longer can. The app only sends to ordinary wallet addresses (P2PKH), because an NFT sent to a contract address could be locked for good.

## Move a V3 range to V4

On a V3 range strategy's page: **Manage → Move to V4 → Preview**. One transaction docks every V3 pool and opens a V4 position with the same range, step and shape, funded from what the pools hold. The preview compares pools and UTXOs now with bins after, and shows what goes into the position, what comes back to your wallet and the network fee. Grid and ladder strategies move later.

The fee is mostly the V3 side: each V3 pool docked adds about 1.1 KB (7 pools ≈ 9,400 sats at 1.2 sat/byte on chipnet).

## Costs

| | |
|---|---|
| Creating a position | One transaction: 44–79 bytes per bin plus about 600 bytes (inputs, the NFT, the metadata pointer); 4 bins ≈ 1,060 bytes. Each ask bin carries 1,000 sats, the NFT output 1,000 sats, and Mesh's identity output 800 sats |
| A trade through your bins | Paid by the trader: ~400 bytes per bin crossed |
| Withdrawing | About 355 bytes per bin plus ~400 for the NFT and outputs, paid from the withdrawn sats |
| Each bin's minimum | 1,000 sats always stay in a bin, so it can keep trading |

## Safety: read this

- **Don't lose the NFT.** There is no recovery key: that's what keeps your funds free of any admin. If the NFT is lost or burned, the bins keep trading but nobody can withdraw them. Keep it in a wallet you back up, like any coin.
- **Check before sending the NFT.** Sending it hands over the position, and there's no undo.
- **Price risk is the same as any range position.** As the price falls through your range, your bins end up holding the token; as it rises, they end up holding BCH. Your earnings are the spreads collected along the way.
- **Your NFT is mutable.** Its holder can update its details, and it keeps owning the bins whatever they say. An NFT downgraded to immutable with its details erased can't be told apart from a plain token. The app never does this, but avoid tools that rewrite NFT commitments.

## Glossary

| Term | Meaning |
|---|---|
| Bin | One small pool at one grid level: buys at its bid, sells at its ask (one step up), flips in place |
| Grid level | A price on the shared grid: (1 + step)^level sats per token unit |
| Bin step | Distance between levels, in basis points (100 = 1%) |
| Position NFT | The CashToken NFT that owns a position's bins. Its token ID is the position's category |
| Category | The position's ID: the txid of the coin spent first when it was created |
| Genesis | The transaction that creates the NFT and funds the bins |
| Metadata (BCMR) | The file wallets read to show the NFT's name and fields, published on IPFS with its fingerprint on chain |

**For developers:** see [V4 positions API](/docs/api/v4).
