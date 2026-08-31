---
name: novaroute-embeddings
description: Generate embeddings via NovaRoute /v1/embeddings using OpenAI / Cohere / Jina / Voyage / Nomic / self-hosted models. Use when the user wants to create vector embeddings, semantic search, or text similarity.
---

# NovaRoute — Embeddings

Requires `NOVAROUTE_URL` (and `NOVAROUTE_KEY` if auth enabled). See https://raw.githubusercontent.com/IRNova/NovaRoute/refs/heads/main/skills/novaroute/SKILL.md for setup.

## Discover

```bash
curl $NOVAROUTE_URL/v1/models/embedding | jq '.data[].id'
curl "$NOVAROUTE_URL/v1/models/info?id=openai/text-embedding-3-small"
```

## Endpoint

`POST $NOVAROUTE_URL/v1/embeddings`

| Field | Required | Notes |
|---|---|---|
| `model` | yes | from `/v1/models/embedding` |
| `input` | yes | string or array of strings |
| `dimensions` | no | output dimensions (some models) |

## Examples

```bash
curl -X POST $NOVAROUTE_URL/v1/embeddings \
  -H "Authorization: Bearer $NOVAROUTE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"openai/text-embedding-3-small","input":"Hello world"}'
```

JS:

```js
const r = await fetch(`${process.env.NOVAROUTE_URL}/v1/embeddings`, {
  method: "POST",
  headers: { "Authorization": `Bearer ${process.env.NOVAROUTE_KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({ model: "openai/text-embedding-3-small", input: ["Hello", "World"] }),
});
const { data } = await r.json();
console.log(data[0].embedding); // [0.0023, -0.0093, ...]
```

## Response shape

```json
{
  "object": "list",
  "data": [
    { "object": "embedding", "embedding": [0.0023, -0.0093, ...], "index": 0 }
  ],
  "model": "openai/text-embedding-3-small",
  "usage": { "prompt_tokens": 8, "total_tokens": 8 }
}
```

## Self-hosted

Point `providerSpecificData.baseUrl` to your local server:
- llama-server: `http://host:8080/v1`
- vLLM: `http://host:8000/v1`
- Infinity: `http://host:7997/v1`
