"""NovaRoute Python SDK — Main client implementation."""

from __future__ import annotations
import json
import time
from typing import Optional, List, Dict, Any, Iterator, Union
from urllib.parse import urljoin

import requests
import httpx

from novaroute.types import (
    ChatCompletion,
    ChatCompletionChunk,
    Embedding,
    Model,
    ModelList,
    Message,
)


class ChatResource:
    """Chat completions resource."""

    def __init__(self, client: "NovaRoute"):
        self._client = client

    def create(
        self,
        model: str,
        messages: List[Dict[str, str]],
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        top_p: Optional[float] = None,
        stream: bool = False,
        **kwargs,
    ) -> Union[ChatCompletion, Iterator[ChatCompletionChunk]]:
        """Create a chat completion.

        Args:
            model: Model identifier (e.g. "openai/gpt-4o", "anthropic/claude-sonnet-4")
            messages: List of message dicts with "role" and "content"
            temperature: Sampling temperature (0-2)
            max_tokens: Maximum tokens to generate
            top_p: Nucleus sampling parameter
            stream: If True, returns an iterator of chunks
            **kwargs: Additional parameters

        Returns:
            ChatCompletion or Iterator[ChatCompletionChunk]
        """
        payload = {"model": model, "messages": messages, "stream": stream}
        if temperature is not None:
            payload["temperature"] = temperature
        if max_tokens is not None:
            payload["max_tokens"] = max_tokens
        if top_p is not None:
            payload["top_p"] = top_p
        payload.update(kwargs)

        if stream:
            return self._client._stream("/v1/chat/completions", payload)

        data = self._client._post("/v1/chat/completions", payload)
        return ChatCompletion(**data)

    def stream(
        self,
        model: str,
        messages: List[Dict[str, str]],
        **kwargs,
    ) -> Iterator[ChatCompletionChunk]:
        """Stream a chat completion."""
        return self.create(model=model, messages=messages, stream=True, **kwargs)


class EmbeddingsResource:
    """Embeddings resource."""

    def __init__(self, client: "NovaRoute"):
        self._client = client

    def create(
        self,
        model: str,
        input: Union[str, List[str]],
        **kwargs,
    ) -> Embedding:
        """Create embeddings.

        Args:
            model: Embedding model (e.g. "openai/text-embedding-3-small")
            input: Text or list of texts to embed

        Returns:
            Embedding object
        """
        payload = {"model": model, "input": input}
        payload.update(kwargs)
        data = self._client._post("/v1/embeddings", payload)
        return Embedding(**data)


class ModelsResource:
    """Models resource."""

    def __init__(self, client: "NovaRoute"):
        self._client = client

    def list(self) -> ModelList:
        """List all available models."""
        data = self._client._get("/v1/models")
        return ModelList(**data)

    def retrieve(self, model_id: str) -> Model:
        """Retrieve a specific model."""
        data = self._client._get(f"/v1/models/{model_id}")
        return Model(**data)


class ImagesResource:
    """Image generation resource."""

    def __init__(self, client: "NovaRoute"):
        self._client = client

    def generate(
        self,
        model: str,
        prompt: str,
        n: int = 1,
        size: str = "1024x1024",
        **kwargs,
    ) -> Dict[str, Any]:
        """Generate an image.

        Args:
            model: Image model (e.g. "openai/dall-e-3")
            prompt: Text description
            n: Number of images
            size: Image size

        Returns:
            Image generation response
        """
        payload = {"model": model, "prompt": prompt, "n": n, "size": size}
        payload.update(kwargs)
        return self._client._post("/v1/images/generations", payload)


class AudioResource:
    """Audio resource (TTS/STT)."""

    def __init__(self, client: "NovaRoute"):
        self._client = client

    def speech(
        self,
        model: str,
        input: str,
        voice: str = "alloy",
        **kwargs,
    ) -> bytes:
        """Text to speech.

        Args:
            model: TTS model
            input: Text to speak
            voice: Voice name

        Returns:
            Audio bytes
        """
        payload = {"model": model, "input": input, "voice": voice}
        payload.update(kwargs)
        url = urljoin(self._client.base_url, "/v1/audio/speech")
        headers = self._client._headers()
        response = requests.post(url, json=payload, headers=headers, timeout=60)
        response.raise_for_status()
        return response.content

    def transcribe(
        self,
        model: str,
        file_path: str,
        language: Optional[str] = None,
        **kwargs,
    ) -> Dict[str, Any]:
        """Speech to text.

        Args:
            model: STT model (e.g. "openai/whisper-1")
            file_path: Path to audio file
            language: Language code

        Returns:
            Transcription result
        """
        url = urljoin(self._client.base_url, "/v1/audio/transcriptions")
        headers = self._client._headers()
        # Remove content-type for multipart
        headers.pop("content-type", None)

        with open(file_path, "rb") as f:
            files = {"file": (file_path, f)}
            data = {"model": model}
            if language:
                data["language"] = language
            data.update(kwargs)
            response = requests.post(url, files=files, data=data, headers=headers, timeout=120)
            response.raise_for_status()
            return response.json()


class A2AResource:
    """A2A (Agent-to-Agent) resource."""

    def __init__(self, client: "NovaRoute"):
        self._client = client

    def send(
        self,
        skill: str,
        messages: List[Dict[str, str]],
        metadata: Optional[Dict[str, Any]] = None,
        **kwargs,
    ) -> Dict[str, Any]:
        """Send a message to an A2A skill.

        Args:
            skill: Skill name (e.g. "smart-routing", "health-report")
            messages: List of messages
            metadata: Additional metadata

        Returns:
            A2A response
        """
        payload = {
            "jsonrpc": "2.0",
            "id": str(int(time.time() * 1000)),
            "method": "message/send",
            "params": {
                "skill": skill,
                "messages": messages,
                "metadata": metadata or {},
            },
        }
        payload["params"].update(kwargs)
        return self._client._post("/a2a", payload)

    def get_agent_card(self) -> Dict[str, Any]:
        """Get the agent card for discovery."""
        return self._client._get("/.well-known/agent.json")


class NovaRoute:
    """NovaRoute Python SDK client.

    Usage:
        from novaroute import NovaRoute

        client = NovaRoute(base_url="http://localhost:20126", api_key="your-key")

        # Chat
        response = client.chat.completions.create(
            model="openai/gpt-4o",
            messages=[{"role": "user", "content": "Hello!"}]
        )
        print(response.content)

        # Streaming
        for chunk in client.chat.completions.stream(
            model="anthropic/claude-sonnet-4",
            messages=[{"role": "user", "content": "Hi"}]
        ):
            print(chunk.choices[0].delta.get("content", ""), end="")

        # Embeddings
        emb = client.embeddings.create(
            model="openai/text-embedding-3-small",
            input="Hello world"
        )
        print(emb.vector[:5])  # First 5 dimensions
    """

    def __init__(
        self,
        base_url: str = "http://localhost:20126",
        api_key: Optional[str] = None,
        timeout: int = 120,
        max_retries: int = 3,
    ):
        """Initialize NovaRoute client.

        Args:
            base_url: NovaRoute server URL
            api_key: API key for authentication
            timeout: Request timeout in seconds
            max_retries: Maximum number of retries
        """
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.timeout = timeout
        self.max_retries = max_retries

        # Sub-resources
        self.chat = ChatResource(self)
        self.embeddings = EmbeddingsResource(self)
        self.models = ModelsResource(self)
        self.images = ImagesResource(self)
        self.audio = AudioResource(self)
        self.a2a = A2AResource(self)

    def _headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    def _get(self, path: str, **kwargs) -> Any:
        url = urljoin(self.base_url + "/", path.lstrip("/"))
        for attempt in range(self.max_retries):
            try:
                response = requests.get(
                    url, headers=self._headers(), timeout=self.timeout, **kwargs
                )
                response.raise_for_status()
                return response.json()
            except requests.exceptions.HTTPError as e:
                if attempt == self.max_retries - 1:
                    raise
                time.sleep(2 ** attempt)
        return None

    def _post(self, path: str, payload: Dict[str, Any], **kwargs) -> Any:
        url = urljoin(self.base_url + "/", path.lstrip("/"))
        for attempt in range(self.max_retries):
            try:
                response = requests.post(
                    url, json=payload, headers=self._headers(), timeout=self.timeout, **kwargs
                )
                response.raise_for_status()
                return response.json()
            except requests.exceptions.HTTPError as e:
                if attempt == self.max_retries - 1:
                    raise
                time.sleep(2 ** attempt)
        return None

    def _stream(self, path: str, payload: Dict[str, Any]) -> Iterator[ChatCompletionChunk]:
        """Stream SSE response."""
        url = urljoin(self.base_url + "/", path.lstrip("/"))
        headers = self._headers()

        with httpx.Client(timeout=self.timeout) as client:
            with client.stream("POST", url, json=payload, headers=headers) as response:
                response.raise_for_status()
                for line in response.iter_lines():
                    if line.startswith("data: "):
                        data = line[6:]
                        if data.strip() == "[DONE]":
                            break
                        try:
                            chunk_data = json.loads(data)
                            yield ChatCompletionChunk(**chunk_data)
                        except json.JSONDecodeError:
                            continue

    def health(self) -> Dict[str, Any]:
        """Check server health."""
        return self._get("/api/health")

    def status(self) -> Dict[str, Any]:
        """Get server status."""
        return self._get("/api/monitoring/health")
