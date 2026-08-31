---
name: novaroute
description: Entry point for NovaRoute — local/remote AI gateway with OpenAI-compatible REST for chat, image, TTS, embeddings, web search, web fetch, MCP tools, and smart routing. Use when the user mentions NovaRoute, NOVAROUTE_URL, or wants AI without writing provider boilerplate. This skill covers setup + indexes capability skills; fetch the relevant capability SKILL.md from the URLs below when needed.
---

# NovaRoute

Local/remote AI gateway exposing OpenAI-compatible REST. One key, many providers, auto-fallback, smart routing.

## Setup

```bash
export NOVAROUTE_URL="http://localhost:20126"      # or VPS / tunnel URL
export NOVAROUTE_KEY="sk-..."                      # from Dashboard → Keys (only if requireApiKey=true)
```

All requests: `${NOVAROUTE_URL}/v1/...` with header `Authorization: Bearer ${NOVAROUTE_KEY}` (omit if auth disabled).

Verify: `curl $NOVAROUTE_URL/api/health` → `{"ok":true}`

## Discover models

```bash
curl $NOVAROUTE_URL/v1/models                  # chat/LLM (default)
curl $NOVAROUTE_URL/v1/models/image            # image-gen
curl $NOVAROUTE_URL/v1/models/tts              # text-to-speech
curl $NOVAROUTE_URL/v1/models/embedding        # embeddings
curl $NOVAROUTE_URL/v1/models/web              # web search + fetch (entries have `kind` field)
curl $NOVAROUTE_URL/v1/models/stt              # speech-to-text
curl $NOVAROUTE_URL/v1/models/image-to-text    # vision
curl $NOVAROUTE_URL/v1/models/mcp              # MCP tools
curl $NOVAROUTE_URL/v1/models/video            # video generation
```

Use `data[].id` as `model` field in requests. Combos appear with `owned_by:"combo"`.

Response shape:
```json
{ "object": "list", "data": [
  { "id": "openai/gpt-5", "object": "model", "owned_by": "openai", "created": 1735000000 },
  { "id": "tavily/search", "object": "model", "kind": "webSearch", "owned_by": "tavily", "created": 1735000000 }
]}
```

## Capability skills

When the user needs a specific capability, fetch that skill's `SKILL.md` from its raw URL:

| Capability | Raw URL |
|---|---|
| Chat / code-gen | https://raw.githubusercontent.com/IRNova/NovaRoute/refs/heads/main/skills/novaroute-chat/SKILL.md |
| Image generation | https://raw.githubusercontent.com/IRNova/NovaRoute/refs/heads/main/skills/novaroute-image/SKILL.md |
| Text-to-speech | https://raw.githubusercontent.com/IRNova/NovaRoute/refs/heads/main/skills/novaroute-tts/SKILL.md |
| Speech-to-text | https://raw.githubusercontent.com/IRNova/NovaRoute/refs/heads/main/skills/novaroute-stt/SKILL.md |
| Embeddings | https://raw.githubusercontent.com/IRNova/NovaRoute/refs/heads/main/skills/novaroute-embeddings/SKILL.md |
| Web search | https://raw.githubusercontent.com/IRNova/NovaRoute/refs/heads/main/skills/novaroute-web-search/SKILL.md |
| Web fetch (URL → markdown) | https://raw.githubusercontent.com/IRNova/NovaRoute/refs/heads/main/skills/novaroute-web-fetch/SKILL.md |
| MCP Tools | https://raw.githubusercontent.com/IRNova/NovaRoute/refs/heads/main/skills/novaroute-mcp/SKILL.md |
| NovaBot Agent | https://raw.githubusercontent.com/IRNova/NovaRoute/refs/heads/main/skills/novaroute-novabot/SKILL.md |
| Smart Router | https://raw.githubusercontent.com/IRNova/NovaRoute/refs/heads/main/skills/novaroute-smart-router/SKILL.md |
| Video generation | https://raw.githubusercontent.com/IRNova/NovaRoute/refs/heads/main/skills/novaroute-video/SKILL.md |

## Smart Routing

NovaRoute includes intelligent routing that automatically selects the best provider based on:
- **Cost optimization** — cheapest provider first
- **Quality optimization** — best model for the task
- **Speed optimization** — fastest response time
- **Availability** — health monitoring and auto-fallback

Enable smart routing in Dashboard → Endpoint → Smart Router.

## NovaBot

NovaRoute includes NovaBot — an AI agent system that can:
- Execute tasks autonomously
- Use tools and MCP servers
- Manage multi-turn conversations
- Learn from experience

Enable NovaBot in Dashboard → NovaBot.

## Errors

- 401 → set/refresh `NOVAROUTE_KEY` (Dashboard → Keys)
- 400 `Invalid model format` → check `model` exists in `/v1/models/<kind>`
- 503 `All accounts unavailable` → wait `retry-after` or add another provider account
