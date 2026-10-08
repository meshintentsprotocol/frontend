---
title: Connect a client
description: Point Claude, Claude Code, Cursor, VS Code, Windsurf, ChatGPT or any stdio client at the MCP server.
status: draft
updated: 2026-10-07
sources: bch-intents-mcp/README.md, frontend/src/mcp/clients.ts
---

Every client needs one thing: the endpoint.

```text
$MCP_URL = https://<mcp-host>/mcp
```

There is no account and no key. The [MCP page](/mcp) shows the same snippets with the live URL filled in.

> [!NOTE]
> Client settings screens move. These steps were checked against each client's documentation on 2026-10-07.

## Claude

Works in Claude on the web and in Claude Desktop.

1. Open **Customize → Connectors**.
2. Click **+ Add**, then **Add custom connector**.
3. Name it `BCH Intents` and paste `$MCP_URL`.
4. Click **Add**.

Claude connects from Anthropic's servers, so the endpoint must be public. A server on `localhost` does not work here.

## Claude Code

```bash
claude mcp add --transport http bch-intents $MCP_URL
```

Add `--scope user` to have it in every project.

## Cursor

Add to `.cursor/mcp.json` in a project, or `~/.cursor/mcp.json` for every project.

```json title="mcp.json"
{
  "mcpServers": {
    "bch-intents": { "url": "https://<mcp-host>/mcp" }
  }
}
```

## VS Code

```json title=".vscode/mcp.json"
{
  "servers": {
    "bch-intents": { "type": "http", "url": "https://<mcp-host>/mcp" }
  }
}
```

## Windsurf

Add to `~/.config/devin/mcp_config.json` (on Windows, `%APPDATA%\devin\mcp_config.json`). Older Windsurf builds read `~/.codeium/windsurf/mcp_config.json`.

```json title="mcp_config.json"
{
  "mcpServers": {
    "bch-intents": { "serverUrl": "https://<mcp-host>/mcp" }
  }
}
```

## ChatGPT

1. Open **Settings → Apps & Connectors** and turn on **Developer mode** (under Advanced).
2. Click **Create**, name it `BCH Intents` and paste `$MCP_URL`.
3. Set authentication to **None** and save.

Developer mode is on paid plans; in a workspace an admin may have to allow custom connectors. ChatGPT also needs a public endpoint.

## Local (stdio)

A client that starts MCP servers as a local process can run the npm package. It needs the URL of a Mesh Server.

```codegroup
@@ Client config | json
{
  "mcpServers": {
    "bch-intents": {
      "command": "npx",
      "args": ["-y", "@bch-intents/mcp"],
      "env": { "MESH_URL": "https://<your-mesh-server>", "NETWORK": "chipnet" }
    }
  }
}
@@ Claude Code | bash
claude mcp add --env MESH_URL=https://<your-mesh-server> --env NETWORK=chipnet \
  --transport stdio bch-intents -- npx -y @bch-intents/mcp
```

All settings are in [Self-hosting](api/mcp/self-host).

## Check it works

Ask the agent:

> Which networks is BCH Intents up on?

It calls `get_protocol_status` and answers with the networks, the default one and the protocol totals. Then try a quote:

> What would I get right now for 0.01 BCH in PUSD, and by which route?
