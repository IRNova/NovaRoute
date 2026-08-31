"""NovaRoute SDK Types — Pydantic models for API requests/responses."""

from __future__ import annotations
from typing import Optional, List, Dict, Any, Literal, Iterator
from pydantic import BaseModel, Field


class Message(BaseModel):
    role: Literal["system", "user", "assistant", "tool"]
    content: Optional[str] = None
    name: Optional[str] = None
    tool_calls: Optional[List[Dict[str, Any]]] = None
    tool_call_id: Optional[str] = None


class Usage(BaseModel):
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0


class Choice(BaseModel):
    index: int = 0
    message: Optional[Message] = None
    delta: Optional[Dict[str, Any]] = None
    finish_reason: Optional[str] = None


class ChatCompletion(BaseModel):
    id: str = ""
    object: str = "chat.completion"
    created: int = 0
    model: str = ""
    choices: List[Choice] = []
    usage: Optional[Usage] = None
    provider: Optional[str] = None
    cost: Optional[float] = None

    @property
    def content(self) -> str:
        if self.choices and self.choices[0].message:
            return self.choices[0].message.content or ""
        return ""


class ChatCompletionChunk(BaseModel):
    id: str = ""
    object: str = "chat.completion.chunk"
    created: int = 0
    model: str = ""
    choices: List[Choice] = []


class EmbeddingData(BaseModel):
    object: str = "embedding"
    embedding: List[float] = []
    index: int = 0


class Embedding(BaseModel):
    object: str = "list"
    data: List[EmbeddingData] = []
    model: str = ""
    usage: Optional[Usage] = None

    @property
    def vector(self) -> List[float]:
        if self.data:
            return self.data[0].embedding
        return []


class Model(BaseModel):
    id: str
    object: str = "model"
    created: int = 0
    owned_by: Optional[str] = None


class ModelList(BaseModel):
    object: str = "list"
    data: List[Model] = []


class ImageURL(BaseModel):
    url: str
    detail: Optional[str] = None


class ImagePart(BaseModel):
    type: Literal["image_url"] = "image_url"
    image_url: ImageURL


class TextPart(BaseModel):
    type: Literal["text"] = "text"
    text: str


class AudioPart(BaseModel):
    type: Literal["input_audio"] = "input_audio"
    input_audio: Dict[str, Any]


class ContentPart(BaseModel):
    """Multi-modal content part."""
    type: str
    text: Optional[str] = None
    image_url: Optional[ImageURL] = None
    input_audio: Optional[Dict[str, Any]] = None
