"""AI-chat endpoint tests. The LLM layer is faked — no network calls."""

import json

import pytest

from app.config import settings
from app.llm import ExtractionResult, LLMError, LLMUnavailable, _loads_object
from app.nda_schema import NdaFields, missing_required

COMPLETE_FIELDS = {
    "purpose": "Evaluate a partnership",
    "effectiveDate": "2026-01-02",
    "mndaTermKind": "years",
    "mndaTermYears": 2,
    "confidentialityTermKind": "perpetuity",
    "confidentialityTermYears": None,
    "governingLaw": "Delaware",
    "jurisdiction": "New Castle, Delaware",
    "modifications": None,
    "party1": {
        "name": "Ada Lovelace",
        "title": "CEO",
        "company": "Analytical Engines",
        "noticeAddress": "ada@ae.example",
    },
    "party2": {
        "name": "Alan Turing",
        "title": None,
        "company": "Bletchley Ltd",
        "noticeAddress": "alan@bp.example",
    },
}


def _events(raw: str) -> list[tuple[str, dict]]:
    out = []
    for block in raw.strip().split("\n\n"):
        if not block.strip():
            continue
        name = data = None
        for line in block.splitlines():
            if line.startswith("event: "):
                name = line[len("event: ") :]
            elif line.startswith("data: "):
                data = json.loads(line[len("data: ") :])
        out.append((name, data))
    return out


@pytest.fixture
def fake_llm(monkeypatch):
    """Patch the names as imported into the routes module."""

    state = {"tokens": ["Hi", " there"], "extract": None, "stream_exc": None}

    async def fake_stream(messages):
        if state["stream_exc"] is not None:
            raise state["stream_exc"]
        for tok in state["tokens"]:
            yield tok

    async def fake_extract(messages, current):
        if isinstance(state["extract"], Exception):
            raise state["extract"]
        return state["extract"] or ExtractionResult(
            fields=current, missing_fields=missing_required(current)
        )

    monkeypatch.setattr("app.api.routes.stream_reply", fake_stream)
    monkeypatch.setattr("app.api.routes.extract_fields", fake_extract)
    return state


def test_chat_status_reflects_key(client, monkeypatch):
    monkeypatch.setattr(settings, "openrouter_api_key", "sk-test")
    assert client.get("/api/nda/chat").json() == {"enabled": True}
    monkeypatch.setattr(settings, "openrouter_api_key", "")
    assert client.get("/api/nda/chat").json() == {"enabled": False}


def test_chat_streams_tokens_then_result(client, fake_llm):
    fields = NdaFields.model_validate(COMPLETE_FIELDS)
    fake_llm["extract"] = ExtractionResult(
        fields=fields, missing_fields=[], ready_to_generate=True
    )

    response = client.post(
        "/api/nda/chat",
        json={"messages": [{"role": "user", "content": "Let's start"}], "fields": {}},
    )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    events = _events(response.text)

    assert [d["text"] for name, d in events if name == "token"] == ["Hi", " there"]
    result = next(d for name, d in events if name == "result")
    assert result["reply"] == "Hi there"
    assert result["readyToGenerate"] is True
    assert result["missingFields"] == []
    assert result["fields"]["governingLaw"] == "Delaware"


def test_chat_reports_unavailable_when_no_key(client, fake_llm):
    fake_llm["stream_exc"] = LLMUnavailable("no key")

    events = _events(
        client.post(
            "/api/nda/chat",
            json={"messages": [{"role": "user", "content": "hi"}], "fields": {}},
        ).text
    )

    assert [(n, d["code"]) for n, d in events] == [("error", "unavailable")]


def test_chat_reports_provider_error(client, fake_llm):
    fake_llm["stream_exc"] = LLMError("503 from provider")

    events = _events(
        client.post(
            "/api/nda/chat",
            json={"messages": [{"role": "user", "content": "hi"}], "fields": {}},
        ).text
    )

    assert [(n, d["code"]) for n, d in events] == [("error", "provider")]


def test_chat_keeps_reply_when_extraction_fails(client, fake_llm):
    fake_llm["extract"] = LLMError("bad json twice")

    events = _events(
        client.post(
            "/api/nda/chat",
            json={
                "messages": [{"role": "user", "content": "hi"}],
                "fields": {"purpose": "Evaluate a deal"},
            },
        ).text
    )

    result = next(d for name, d in events if name == "result")
    assert result["reply"] == "Hi there"
    assert result["degraded"] is True
    assert result["fields"]["purpose"] == "Evaluate a deal"


def test_chat_rejects_empty_message_list(client, fake_llm):
    assert client.post("/api/nda/chat", json={"messages": [], "fields": {}}).status_code == 422


# --- schema / parsing helpers ---------------------------------------------------


def test_missing_required_lists_everything_when_blank():
    missing = missing_required(NdaFields())
    for key in ("purpose", "effectiveDate", "governingLaw", "jurisdiction",
                "party1.name", "party1.company", "party1.noticeAddress",
                "party2.name", "party2.company", "party2.noticeAddress"):
        assert key in missing


def test_missing_required_empty_when_complete():
    assert missing_required(NdaFields.model_validate(COMPLETE_FIELDS)) == []


def test_missing_required_flags_year_count_only_for_years_kind():
    base = {**COMPLETE_FIELDS, "confidentialityTermKind": "years", "confidentialityTermYears": None}
    assert "confidentialityTermYears" in missing_required(NdaFields.model_validate(base))


def test_loads_object_tolerates_code_fences_and_prose():
    assert _loads_object('```json\n{"purpose": "x"}\n```') == {"purpose": "x"}
    assert _loads_object('Here you go: {"a": 1} — done') == {"a": 1}
