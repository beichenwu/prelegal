"""Request models for `POST /api/chat`.

The frontend owns the document library, so it sends everything the backend needs:
the catalogue (for triage) and, once a document is chosen, that document's field
spec. The backend stays stateless and file-free.
"""

from typing import Literal

from pydantic import BaseModel, Field


class CatalogEntry(BaseModel):
    slug: str
    label: str
    description: str


class FieldSpec(BaseModel):
    name: str
    label: str
    hint: str = ""


class PartySpec(BaseModel):
    key: str
    label: str


class SelectedDocument(BaseModel):
    slug: str
    label: str
    description: str = ""
    fields: list[FieldSpec] = []
    parties: list[PartySpec] = []


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=8000)


class ChatRequest(BaseModel):
    catalog: list[CatalogEntry] = Field(min_length=1, max_length=50)
    document: SelectedDocument | None = None
    messages: list[ChatTurn] = Field(min_length=1, max_length=60)
    fields: dict[str, str] = Field(default_factory=dict)
