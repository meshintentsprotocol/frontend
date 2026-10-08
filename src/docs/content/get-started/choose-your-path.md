---
title: Choose your path
description: Pick the integration that matches what you're building, from a no-code swap link to a full solver.
status: ready
updated: 2026-09-28
---

There are five ways to build on BCH Intents. They share the same covenants, so an order created by one integration can be filled by any solver.

| You are building | Start with | You'll use |
| --- | --- | --- |
| A swap screen, wallet or bot that **creates orders** | [Quickstart](get-started/quickstart) | Mesh Server REST API or `@bch-intents/sdk` |
| An **AI agent** that quotes and prepares orders | [MCP server](api/mcp/overview) | The MCP endpoint, from Claude, Cursor, ChatGPT or your own agent |
| A **liquidity strategy** that earns fees | [Strategy pools](mesh/pools/strategy-pools) | `StrategyCovenantV2`, `POST /positions` |
| A **solver** that fills orders for surplus | [Why solvers](solvers/overview) | Matcher, Cauldron, your own inventory |
| A **cross-chain** flow (SOL, BSC) | [Cross-chain overview](intents/cross-chain/overview) | ZK relayer APIs |

## Integrators

```cards
[
  { "title": "REST API", "description": "Language-agnostic. Quote, create, fund, track. Best for backends and non-TypeScript stacks.", "href": "api/overview", "icon": "server" },
  { "title": "Intents SDK", "description": "Typed builders, covenant artifacts and wallet adapters for TypeScript apps.", "href": "sdk/intents/overview", "icon": "package" },
  { "title": "Frontend fees", "description": "Set frontendPkh and a surplus mode to earn on every fill you originate.", "href": "sdk/guides/frontend-fees", "icon": "key" },
  { "title": "WebSocket stream", "description": "Live intent lifecycle events and pool fills for real-time UIs.", "href": "api/websocket", "icon": "zap" },
  { "title": "MCP server", "description": "Typed tools for AI agents: quote, prepare orders, read pools. The user's wallet signs.", "href": "api/mcp/overview", "icon": "bot" }
]
```

## Liquidity providers and solvers

```cards
[
  { "title": "Provide liquidity", "description": "One UTXO per pool, fixed price, 100% of fees to you, exit with one signature.", "href": "mesh/pools/lifecycle", "icon": "network" },
  { "title": "Run a solver", "description": "Plan fills across three routes and capture surplus.", "href": "solvers/run", "icon": "bot" }
]
```

> [!NOTE]
> The Mesh SDK and Solver SDK are planned. Until they ship, LPs and solvers integrate through the covenants and the REST API directly; both are fully documented here.
