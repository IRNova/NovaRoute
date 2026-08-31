---
name: novaroute-novabot
description: NovaBot AI agent system via NovaRoute. Use when the user wants to delegate tasks to AI agents, create autonomous workflows, or use the agent system.
---

# NovaRoute — NovaBot

NovaBot is an AI agent system that can execute tasks autonomously, use tools, and manage multi-turn conversations.

## What is NovaBot?

NovaBot is a multi-agent system with:
- **CEO Agent** — Routes tasks to employees
- **Employee Agents** — Execute specific tasks
- **Supervisor Agents** — Review and quality-check work
- **Skills System** — Learn and apply new capabilities
- **Memory System** — Remember past interactions

## Create a session

```bash
curl -X POST $NOVAROUTE_URL/api/sessions \
  -H "Authorization: Bearer $NOVAROUTE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"agentId":"default","provider":"openai","model":"gpt-4"}'
```

## Send a message

```bash
curl -X POST $NOVAROUTE_URL/api/sessions/{sessionId}/messages \
  -H "Authorization: Bearer $NOVAROUTE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"role":"user","content":"Search for the latest news about AI"}'
```

## Get conversation history

```bash
curl $NOVAROUTE_URL/api/sessions/{sessionId}/messages \
  -H "Authorization: Bearer $NOVAROUTE_KEY"
```

## Agent capabilities

NovaBot agents can:
- **Execute shell commands** — Run commands on the server
- **Browse the web** — Search and fetch web content
- **Read/write files** — Manage files on the server
- **Use MCP tools** — Execute MCP server tools
- **Learn from experience** — Remember what works

## Task delegation

When you send a message to NovaBot:
1. CEO agent analyzes the request
2. Task is delegated to the best employee agent
3. Employee executes the task using available tools
4. Supervisor reviews the work
5. Result is returned to you

## Example workflow

```bash
# 1. Create session
SESSION=$(curl -s -X POST $NOVAROUTE_URL/api/sessions \
  -H "Authorization: Bearer $NOVAROUTE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"agentId":"default"}' | jq -r '.session.id')

# 2. Send task
curl -X POST $NOVAROUTE_URL/api/sessions/$SESSION/messages \
  -H "Authorization: Bearer $NOVAROUTE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"role":"user","content":"Find the top 5 AI news from today and summarize them"}'

# 3. Wait for response (NovaBot will execute autonomously)
# 4. Get results
curl $NOVAROUTE_URL/api/sessions/$SESSION/messages \
  -H "Authorization: Bearer $NOVAROUTE_KEY"
```
