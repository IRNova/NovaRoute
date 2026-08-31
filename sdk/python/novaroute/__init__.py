"""
NovaRoute Python SDK — Unified interface to 369+ LLM providers.

Usage:
    from novaroute import NovaRoute

    client = NovaRoute(base_url="http://localhost:20126", api_key="your-key")

    # Chat completion
    response = client.chat.completions.create(
        model="openai/gpt-4o",
        messages=[{"role": "user", "content": "Hello!"}]
    )

    # Streaming
    for chunk in client.chat.completions.stream(
        model="anthropic/claude-sonnet-4",
        messages=[{"role": "user", "content": "Explain quantum computing"}]
    ):
        print(chunk.choices[0].delta.content, end="")

    # Embeddings
    embedding = client.embeddings.create(
        model="openai/text-embedding-3-small",
        input="Hello world"
    )

    # List models
    models = client.models.list()
"""

__version__ = "1.0.0"

from novaroute.client import NovaRoute
from novaroute.types import (
    ChatCompletion,
    ChatCompletionChunk,
    Embedding,
    Model,
    Message,
    Usage,
)

__all__ = [
    "NovaRoute",
    "ChatCompletion",
    "ChatCompletionChunk",
    "Embedding",
    "Model",
    "Message",
    "Usage",
]
