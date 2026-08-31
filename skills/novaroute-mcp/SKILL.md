---
name: novaroute-mcp
description: MCP (Model Context Protocol) tools via NovaRoute. Use when the user wants to execute tools, connect to MCP servers, or use plugins.
---

# NovaRoute — MCP Tools

Requires `NOVAROUTE_URL` (and `NOVAROUTE_KEY` if auth enabled). See https://raw.githubusercontent.com/IRNova/NovaRoute/refs/heads/main/skills/novaroute/SKILL.md for setup.

## What is MCP?

MCP (Model Context Protocol) allows AI models to use external tools and services. NovaRoute provides a unified interface to manage and execute MCP tools.

## Discover available tools

```bash
# List all installed MCP servers
curl $NOVAROUTE_URL/api/mcp/servers \
  -H "Authorization: Bearer $NOVAROUTE_KEY"

# List all available tools
curl $NOVAROUTE_URL/api/mcp/tools \
  -H "Authorization: Bearer $NOVAROUTE_KEY"

# Browse plugin catalog
curl $NOVAROUTE_URL/api/mcp/catalog \
  -H "Authorization: Bearer $NOVAROUTE_KEY"
```

## Install an MCP server

```bash
curl -X POST $NOVAROUTE_URL/api/mcp/servers \
  -H "Authorization: Bearer $NOVAROUTE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"pluginId":"exa"}'
```

Available plugins:
- `exa` — Web search and code documentation
- `tavily` — AI-optimized web search
- `browsermcp` — Browser control (requires Chrome extension)
- `filesystem` — File system access

## Execute a tool

```bash
curl -X POST $NOVAROUTE_URL/api/mcp/tools/execute \
  -H "Authorization: Bearer $NOVAROUTE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"toolName":"web_search_exa","args":{"query":"NovaRoute documentation"}}'
```

JS:

```js
const r = await fetch(`${process.env.NOVAROUTE_URL}/api/mcp/tools/execute`, {
  method: "POST",
  headers: { "Authorization": `Bearer ${process.env.NOVAROUTE_KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    toolName: "web_search_exa",
    args: { query: "NovaRoute documentation" }
  }),
});
const result = await r.json();
console.log(result.content);
```

## Tool Policy

Manage which tools are allowed/denied per server:

```bash
curl -X PUT $NOVAROUTE_URL/api/mcp/servers/exa \
  -H "Authorization: Bearer $NOVAROUTE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"toolPolicy":{"web_search_exa":"allow","web_fetch_exa":"deny"}}'
```

## Custom Instructions

Add custom instructions for a server:

```bash
curl -X PUT $NOVAROUTE_URL/api/mcp/servers/exa \
  -H "Authorization: Bearer $NOVAROUTE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"customInstructions":"Always search in English"}'
```
