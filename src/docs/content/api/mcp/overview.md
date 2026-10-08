---
title: MCP server
description: A Model Context Protocol server that lets AI agents quote swaps, prepare orders and read Mesh pools. It holds no keys; the user's wallet funds every order.
status: draft
updated: 2026-10-07
sources: bch-intents-mcp/src/server.ts, bch-intents-mcp/src/tools/, bch-intents-mcp/src/guards.ts, bch-intents-mcp/src/config.ts
---

The MCP server gives an AI agent typed tools for BCH Intents and Mesh. Connected to it, a client such as Claude, Cursor or ChatGPT can quote a swap, prepare an order, follow it to its fill, and read pools and strategies. [MCP](https://modelcontextprotocol.io) is the open protocol those clients use to call external tools.

It is a thin client of the [Mesh Server REST API](api/overview): every tool maps to one or two of its routes. It has no chain access and no wallet.

> [!WARNING] Beta
> Start on chipnet, the BCH test network. An agent can misread an amount or a token: read the order on the funding page before you sign.

## Endpoint

```text
$MCP_URL = https://<mcp-host>/mcp
```

| | |
| --- | --- |
| Transports | Streamable HTTP (hosted) and stdio (the npm package `@bch-intents/mcp`) |
| Protocol | Revision `2026-07-28`, stateless. Clients on 2025 revisions are served from the same endpoint |
| Authentication | None. The Mesh API it wraps is public by design; see [Authentication](api/auth) |
| Catalog | `GET <mcp-host>/manifest.json` lists every tool with its parameters |

See [Connect a client](api/mcp/connect) for setup, or [Self-hosting](api/mcp/self-host) to run your own.

## What an agent can do

| Group | Tools |
| --- | --- |
| System | `get_protocol_status` |
| Market data | `search_tokens` · `get_prices` · `get_token_price_history` · `get_quote` · `get_orderbook` · `list_pairs` |
| Orders | `create_swap_order` · `get_order` · `list_orders` · `request_refund` · `quote_twap` · `create_twap_order` · `get_twap_order` |
| Mesh pools | `list_pools` · `get_pool` · `get_pool_activity` · `list_liquidity_providers` · `get_liquidity_provider` |
| Strategies | `list_strategy_templates` · `suggest_strategy_params` · `preview_strategy` · `register_strategy` · `list_strategies` · `get_strategy` · `find_idle_liquidity` · `plan_recycle` |

Parameters are in the [Tool reference](api/mcp/tools).

## Three kinds of tools

| Kind | Count | What it does |
| --- | --- | --- |
| Read-only | 21 | Reads. Changes nothing. |
| You sign | 4 | Returns an order or a plan. Nothing moves until you fund or sign it in your own wallet. `create_swap_order` · `create_twap_order` · `preview_strategy` · `plan_recycle` |
| Server action | 2 | Asks the Mesh Server to act. `request_refund` can only pay the maker, after the deadline. `register_strategy` indexes a strategy that is already on chain. |

## Safety model

- **No keys, no signing.** The server cannot move funds: it has nothing to sign with.
- **You fund every order.** `create_swap_order` and `create_twap_order` return a covenant address and a funding link. Until you fund it, the order is only an address. See [Funding prepared orders](api/mcp/funding).
- **The covenant decides.** Funded coins can be spent two ways: by a fill that pays the maker at least the order's minimum, or back to the maker after the deadline. See [The atomic fill](intents/settlement/fill-transaction) and [Refunds & cancellation](intents/settlement/refunds).
- **Price guard.** An order whose minimum is more than 5% below the live quote is refused. The agent has to confirm the price with you and call again with `acceptPriceDeviation: true`.
- **Address checks.** A maker address is checksum-verified, must be P2PKH, and must belong to the order's network.
- **No operator surface.** Admin routes, solver controls and fill records are not exposed.

## Conventions

The tools use the REST API's conventions and say so in their descriptions:

- **Amounts** are integer strings in base units: satoshis for BCH, the smallest unit for a token. Every result repeats amounts in readable form (`display`), for example `"0.001 BCH"`.
- **Tokens** are `BCH` or a 64-hex CashToken category id. A symbol is accepted when it names exactly one token on that network; otherwise the tool lists the candidates.
- **Networks** are `chipnet` and `mainnet`. Every tool takes an optional `network`. `get_protocol_status` reports which are up and which one is the default.

## Limits

| Limit | Default | Applies to |
| --- | --- | --- |
| Orders per caller | 10 per minute | `create_swap_order`, `create_twap_order` (one per slice), `register_strategy` |
| Price deviation | 500 bps | Orders with a minimum below the live quote |
| Order creation on mainnet | Off | Reads and quotes always work on mainnet |

The Mesh Server's own per-address rate limits still apply behind these. A hosted MCP server reaches the Mesh Server from one address, which is why it limits each of its callers first.

```cards
[
  { "title": "Connect a client", "description": "Claude, Claude Code, Cursor, VS Code, Windsurf, ChatGPT, or any stdio client.", "href": "api/mcp/connect", "icon": "zap" },
  { "title": "Tool reference", "description": "All 27 tools with their parameters.", "href": "api/mcp/tools", "icon": "server" },
  { "title": "Funding prepared orders", "description": "What a prepared order is and how it gets funded.", "href": "api/mcp/funding", "icon": "key" },
  { "title": "Self-hosting", "description": "Run it from npm or as an HTTP service.", "href": "api/mcp/self-host", "icon": "package" }
]
```
