---
title: Tool reference
description: Every tool of the MCP server with its parameters, the shape of results and errors, and the resources and prompts it offers.
status: draft
updated: 2026-10-07
sources: bch-intents-mcp/src/tools/, bch-intents-mcp/src/manifest.ts, bch-intents-mcp/src/resources.ts, bch-intents-mcp/src/prompts.ts
---

This list is generated from the server's own tool declarations, so it cannot drift from what the server registers. Open a tool to see its parameters.

```diagram mcp-tools
```

## Results

Every tool returns the same two things:

- `content`: one text block. Its first line is a sentence a person can read; the JSON of the result follows.
- `structuredContent`: the same result as an object.

```json title="get_quote"
{
  "network": "chipnet",
  "fillable": true,
  "sell": { "amount": "100000", "token": "BCH", "symbol": "BCH", "display": "0.001 BCH" },
  "buy": { "amount": "29", "token": "dfe50223…7b56039b", "symbol": "PUSDTEST", "display": "0.29 PUSDTEST" },
  "effectivePrice": "0.00029",
  "feeBps": 30,
  "route": {
    "type": "MESH_DIRECT",
    "name": "Mesh pool (V3 u9uutda2)",
    "sources": { "meshPct": 100, "cauldronPct": 0, "solverPct": 0 },
    "hops": [{ "type": "MESH_UTXO", "address": "bchtest:pd9tk…uutda2", "amountIn": "100000", "amountOut": "29" }]
  }
}
```

Amounts are objects wherever a token is involved: the base-unit `amount`, the `token` id, and a readable `display` when the token publishes its decimals. `display` is `null` for a token with no metadata; an agent should then show the base units and say so.

## Errors

A tool that cannot do what was asked returns `isError: true` with one line of text saying why and what to do. The agent can correct itself from it:

| Text | Cause |
| --- | --- |
| `'DUP' names 2 tokens on chipnet. Use the category id of the one you mean: …` | A symbol shared by several tokens |
| `makerAddress is a bitcoincash: address but the network is chipnet (expected bchtest:)` | An address of the other network |
| `minBuyAmount is 33.33% below the live quote (3000), more than the 5.00% this server allows by default. …` | The price guard |
| `Too many orders from this client; retry in 24s.` | The per-caller limit |
| `Order creation on mainnet is not enabled on this server yet. …` | Mainnet orders are off |
| `Mesh Server error (400): order BCH side must be >= 10000 sats` | The Mesh Server refused; its message is passed on |
| `The chipnet Mesh Server is unreachable (connection failed).` | The Mesh Server is down |

Some outcomes are answers, not errors: `get_quote` with no route returns `fillable: false` and the reason; `request_refund` before the deadline returns `result: "NOT_ELIGIBLE"` and when it becomes possible.

## Resources

Two short references a client can load into the conversation.

| URI | Content |
| --- | --- |
| `bchintents://guide/conventions` | How amounts, token ids, prices and networks are written |
| `bchintents://guide/order-lifecycle` | From prepared to filled or refunded, and what each status means |

## Prompts

Ready-made workflows a client can offer.

| Prompt | Arguments | What it walks through |
| --- | --- | --- |
| `swap_tokens` | `sell`, `buy` | Resolve tokens, quote, confirm, prepare the order, hand over the funding link |
| `provide_liquidity` | `token`, `budget` | Pick a strategy template, suggest parameters, preview the pools |
| `check_my_orders` | `address` | List an address's orders and explain what each needs |
