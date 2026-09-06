"""Document chat endpoint tests. The LLM layer is faked — no network calls."""

import json

import pytest

from app.config import settings

CATALOG = [
    {"slug": "mutual-nda", "label": "Mutual NDA", "description": "confidentiality"},
    {"slug": "pilot-agreement", "label": "Pilot Agreement", "description": "short eval"},
]

NDA_DOC = {
    "slug": "mutual-nda",
    "label": "Mutual NDA",
    "description": "confidentiality",
    "fields": [
        {"name": "purpose", "label": "Purpose", "hint": ""},
        {"name": "governingLaw", "label": "Governing law", "hint": ""},
    ],
    "parties": [
        {"key": "discloser", "label": "Party 1"},
        {"key": "recipient", "label": "Party 2"},
    ],
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
    state = {"tokens": ["Hi", " there"], "extract": {}, "stream_exc": None, "extract_exc": None}

    async def fake_stream(system_prompt, messages):
        if state["stream_exc"] is not None:
            raise state["stream_exc"]
        for tok in state["tokens"]:
            yield tok

    async def fake_extract(system_prompt, messages):
        if state["extract_exc"] is not None:
            raise state["extract_exc"]
        return state["extract"]

    monkeypatch.setattr("app.api.routes.stream_reply", fake_stream)
    monkeypatch.setattr("app.api.routes.extract_json", fake_extract)
    return state


def test_status_reflects_key(client, monkeypatch):
    monkeypatch.setattr(settings, "openrouter_api_key", "sk-test")
    assert client.get("/api/chat").json() == {"enabled": True}
    monkeypatch.setattr(settings, "openrouter_api_key", "")
    assert client.get("/api/chat").json() == {"enabled": False}


def test_triage_streams_and_returns_slug(client, fake_llm):
    fake_llm["extract"] = {"document": "pilot-agreement", "suggestion": None}

    response = client.post(
        "/api/chat",
        json={
            "catalog": CATALOG,
            "document": None,
            "messages": [{"role": "user", "content": "I want to trial a product"}],
            "fields": {},
        },
    )

    assert response.status_code == 200
    events = _events(response.text)
    assert [d["text"] for n, d in events if n == "token"] == ["Hi", " there"]
    result = next(d for n, d in events if n == "result")
    assert result["reply"] == "Hi there"
    assert result["document"] == "pilot-agreement"
    assert result["readyToGenerate"] is False


def test_triage_suggests_closest_for_unsupported(client, fake_llm):
    fake_llm["extract"] = {"document": None, "suggestion": "mutual-nda"}

    events = _events(
        client.post(
            "/api/chat",
            json={
                "catalog": CATALOG,
                "document": None,
                "messages": [{"role": "user", "content": "I need an employment contract"}],
                "fields": {},
            },
        ).text
    )
    result = next(d for n, d in events if n == "result")
    assert result["document"] is None
    assert result["suggestion"] == "mutual-nda"


def test_fill_merges_fields_and_reports_missing(client, fake_llm):
    fake_llm["extract"] = {
        "fields": {
            "purpose": "evaluate a deal",
            "discloser.signatory": "Ada",
            "discloser.entity": "AE",
            "discloser.noticeAddress": "ada@ae.example",
        },
        "ready": False,
    }

    events = _events(
        client.post(
            "/api/chat",
            json={
                "catalog": CATALOG,
                "document": NDA_DOC,
                "messages": [{"role": "user", "content": "start"}],
                "fields": {"governingLaw": "Delaware"},
            },
        ).text
    )
    result = next(d for n, d in events if n == "result")
    assert result["fields"]["purpose"] == "evaluate a deal"
    assert result["fields"]["governingLaw"] == "Delaware"  # carried from request
    assert "recipient.signatory" in result["missingFields"]
    assert result["readyToGenerate"] is False


def test_fill_ready_only_when_nothing_missing(client, fake_llm):
    fake_llm["extract"] = {
        "fields": {
            "purpose": "x",
            "governingLaw": "Delaware",
            "discloser.signatory": "Ada",
            "discloser.entity": "AE",
            "discloser.noticeAddress": "a@e.x",
            "recipient.signatory": "Bo",
            "recipient.entity": "BE",
            "recipient.noticeAddress": "b@e.x",
        },
        "ready": True,
    }

    events = _events(
        client.post(
            "/api/chat",
            json={
                "catalog": CATALOG,
                "document": NDA_DOC,
                "messages": [{"role": "user", "content": "here it all is"}],
                "fields": {},
            },
        ).text
    )
    result = next(d for n, d in events if n == "result")
    assert result["missingFields"] == []
    assert result["readyToGenerate"] is True


def _triage_body():
    return {
        "catalog": CATALOG,
        "document": None,
        "messages": [{"role": "user", "content": "hi"}],
        "fields": {},
    }


def test_unavailable_when_stream_raises(client, fake_llm):
    from app.llm import LLMUnavailable

    fake_llm["stream_exc"] = LLMUnavailable("no key")
    events = _events(client.post("/api/chat", json=_triage_body()).text)
    assert [(n, d["code"]) for n, d in events] == [("error", "unavailable")]


def test_provider_error_when_stream_raises(client, fake_llm):
    from app.llm import LLMError

    fake_llm["stream_exc"] = LLMError("503")
    events = _events(client.post("/api/chat", json=_triage_body()).text)
    assert [(n, d["code"]) for n, d in events] == [("error", "provider")]


def test_extraction_failure_keeps_reply_and_fields(client, fake_llm):
    from app.llm import LLMError

    fake_llm["extract_exc"] = LLMError("bad json twice")
    events = _events(
        client.post(
            "/api/chat",
            json={
                "catalog": CATALOG,
                "document": NDA_DOC,
                "messages": [{"role": "user", "content": "hi"}],
                "fields": {"purpose": "keep me"},
            },
        ).text
    )
    result = next(d for n, d in events if n == "result")
    assert result["reply"] == "Hi there"
    assert result["degraded"] is True
    assert result["fields"]["purpose"] == "keep me"


def test_rejects_empty_messages(client, fake_llm):
    r = client.post(
        "/api/chat",
        json={"catalog": CATALOG, "document": None, "messages": [], "fields": {}},
    )
    assert r.status_code == 422


def test_unknown_api_route_is_json_404(client):
    r = client.get("/api/nope")
    assert r.status_code == 404
    assert r.headers["content-type"].startswith("application/json")
