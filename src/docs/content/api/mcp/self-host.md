---
title: Self-hosting the MCP server
description: Run the MCP server yourself, over stdio from npm or as an HTTP service, and point it at any Mesh Server.
status: draft
updated: 2026-10-07
sources: bch-intents-mcp/src/config.ts, bch-intents-mcp/src/http.ts, bch-intents-mcp/src/httpServer.ts, bch-intents-mcp/src/stdio.ts, bch-intents-mcp/Dockerfile
---

The server is one Node package, `@bch-intents/mcp` (Node 20 or later). It needs the URL of a [Mesh Server](api/overview) and nothing else: no chain node, no database, no key.

## Run it

```codegroup
@@ stdio | bash
MESH_URL=https://<your-mesh-server> NETWORK=chipnet npx -y @bch-intents/mcp
@@ HTTP | bash
MESH_URL_CHIPNET=https://<chipnet-mesh> \
MESH_URL_MAINNET=https://<mainnet-mesh> \
APP_URL=https://<app> \
  node dist/http.js          # → http://0.0.0.0:8787/mcp
@@ Docker | bash
docker build -t bch-intents-mcp .
docker run -p 8787:8787 \
  -e MESH_URL_CHIPNET=https://<chipnet-mesh> -e APP_URL=https://<app> -e TRUST_PROXY=1 \
  bch-intents-mcp
```

- **stdio** is for a client that starts the server as a local process. See [Connect a client](api/mcp/connect).
- **HTTP** serves Streamable HTTP at `/mcp`. It is stateless: every request is answered by a fresh instance, so any number of processes can sit behind a load balancer.

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `MESH_URL_CHIPNET`, `MESH_URL_MAINNET` | none | Mesh Server base URL per network. Set at least one |
| `MESH_URL` + `NETWORK` | none | Shorthand for a single network |
| `DEFAULT_NETWORK` | the only one set, else `chipnet` | Network used when a tool call names none |
| `APP_URL` | none | The web app. Prepared orders link to `APP_URL/fund?…`. Without it they explain manual funding instead |
| `ENABLE_MAINNET_ORDERS` | `0` | Order creation on mainnet is refused until this is `1`. Reads always work |
| `ORDERS_PER_MINUTE` | `10` | Orders one caller may create per minute; a TWAP counts once per slice. `0` disables |
| `MAX_PRICE_DEVIATION_BPS` | `500` | An order whose minimum is further below the live quote is refused unless the caller confirms |
| `MESH_TIMEOUT_MS` | `20000` | Timeout of one Mesh request |
| `PORT`, `HOST` | `8787`, `0.0.0.0` | HTTP server |
| `TRUST_PROXY` | `0` | `1` when a proxy in front writes `X-Forwarded-For` |

A Mesh Server serves one network, which is why there is one URL per network.

## HTTP routes

| Route | Purpose |
| --- | --- |
| `POST /mcp` | The MCP endpoint |
| `GET /health` | `{ status, name, version, networks, defaultNetwork }` for health checks |
| `GET /manifest.json` | The tool catalog: every tool with its parameters |

CORS is open to every origin. The server is public and keyless, so there is no cookie or credential a page could borrow.

## Behind a proxy

The per-caller order limit is keyed on the caller's address. Behind a proxy that address is the proxy's, so every caller would share one allowance. Set `TRUST_PROXY=1` and the server takes the first address of `X-Forwarded-For`. Set it only when your proxy writes that header; otherwise a client could choose its own.

The same reasoning applies one level down: the Mesh Server limits requests per address and sees the MCP server as a single client. The per-caller limit here keeps one agent from using up the allowance of all.

## Protocol

It uses the v2 TypeScript SDK and speaks MCP revision `2026-07-28`: no handshake and no sessions. A client on a 2025 revision is answered by the same endpoint through the SDK's stateless fallback.

## Check a deployment

```bash
curl https://<mcp-host>/health
claude mcp add --transport http bch-intents https://<mcp-host>/mcp
```

Then ask the agent which networks are up.
