# NovaRoute Python SDK

> Python SDK for NovaRoute AI Gateway — unified interface to 369+ LLM providers.

## Installation

```bash
pip install novaroute
```

## Quick Start

```python
from novaroute import NovaRoute

client = NovaRoute(
    base_url="http://localhost:20126",
    api_key="your-api-key"
)

# Chat completion
response = client.chat.completions.create(
    model="openai/gpt-4o",
    messages=[{"role": "user", "content": "Hello!"}]
)
print(response.content)

# Streaming
for chunk in client.chat.completions.stream(
    model="anthropic/claude-sonnet-4",
    messages=[{"role": "user", "content": "Explain quantum computing"}]
):
    print(chunk.choices[0].delta.get("content", ""), end="")

# Embeddings
emb = client.embeddings.create(
    model="openai/text-embedding-3-small",
    input="Hello world"
)
print(emb.vector[:5])

# List models
models = client.models.list()
for m in models.data:
    print(m.id)
```

## CLI Usage

```bash
# Check server status
novaroute status

# List models
novaroute models

# Interactive chat
novaroute chat --model openai/gpt-4o

# A2A request
novaroute a2a health-report "Check system health"
```

## Features

- **369+ Providers** — OpenAI, Anthropic, Google, Mistral, and more
- **Streaming** — Real-time SSE streaming support
- **Embeddings** — Vector embeddings with any provider
- **Images** — DALL-E, Stable Diffusion, etc.
- **Audio** — TTS and STT support
- **A2A Protocol** — Agent-to-agent communication
- **Retry Logic** — Automatic retries with backoff
- **Type Safety** — Pydantic models for all responses
