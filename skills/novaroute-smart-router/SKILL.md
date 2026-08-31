---
name: novaroute-smart-router
description: Smart routing via NovaRoute. Use when the user wants intelligent provider selection, cost optimization, or quality-based routing.
---

# NovaRoute — Smart Router

NovaRoute's Smart Router automatically selects the best provider based on multiple factors.

## How it works

The Smart Router analyzes:
1. **Provider Health** — Success rate, response time, availability
2. **Cost** — Token pricing across providers
3. **Quality** — Model capabilities and benchmarks
4. **Speed** — Historical response times

## Routing strategies

| Strategy | Description |
|---|---|
| `balanced` | Default — balances cost, quality, and speed |
| `cost` | Prioritizes cheapest provider |
| `quality` | Prioritizes best model quality |
| `speed` | Prioritizes fastest response |

## Get current strategy

```bash
curl $NOVAROUTE_URL/api/routing/smart \
  -H "Authorization: Bearer $NOVAROUTE_KEY"
```

## Update strategy

```bash
curl -X PUT $NOVAROUTE_URL/api/routing/smart/strategy \
  -H "Authorization: Bearer $NOVAROUTE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"strategy":"cost"}'
```

## Get provider health

```bash
curl "$NOVAROUTE_URL/api/routing/smart?action=health" \
  -H "Authorization: Bearer $NOVAROUTE_KEY"
```

Response:
```json
{
  "health": [
    {
      "key": "openai:gpt-4",
      "successes": 150,
      "failures": 2,
      "avgResponseTime": 1200,
      "score": 0.95,
      "available": true
    }
  ]
}
```

## Get routing statistics

```bash
curl "$NOVAROUTE_URL/api/routing/smart?action=stats" \
  -H "Authorization: Bearer $NOVAROUTE_KEY"
```

Response:
```json
{
  "totalRoutings": 1234,
  "providerCounts": {
    "openai": 500,
    "anthropic": 400,
    "glm": 200,
    "kiro": 134
  },
  "currentStrategy": "balanced"
}
```

## Route a request manually

```bash
curl -X POST $NOVAROUTE_URL/api/routing/smart/route \
  -H "Authorization: Bearer $NOVAROUTE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "request": {"model": "gpt-4", "inputTokens": 1000, "outputTokens": 500},
    "availableProviders": [
      {"provider": "openai", "model": "gpt-4"},
      {"provider": "anthropic", "model": "claude-3-sonnet"},
      {"provider": "glm", "model": "glm-4"}
    ]
  }'
```

Response:
```json
{
  "selected": {
    "provider": "glm",
    "model": "glm-4",
    "score": 0.85
  },
  "strategy": "balanced"
}
```

## Create combos for fallback

Combos let you define fallback sequences:

```bash
curl -X POST $NOVAROUTE_URL/api/combos \
  -H "Authorization: Bearer $NOVAROUTE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "smart-stack",
    "models": [
      "cc/claude-opus-4-7",
      "glm/glm-5.1",
      "kr/claude-sonnet-4.5"
    ]
  }'
```

Use the combo name as model in requests — NovaRoute will automatically fallback through the list.
