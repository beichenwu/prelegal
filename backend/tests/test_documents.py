"""Saved-document CRUD — including owner isolation."""

DOC = {
    "slug": "pilot-agreement",
    "title": "Pilot — Acme",
    "values": {"pilotPeriod": "60 days"},
    "markdown": "# Pilot Agreement\n\n60 days.",
}


def _headers(client, email):
    r = client.post("/api/auth/register", json={"email": email, "password": "password123"})
    assert r.status_code == 201
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_requires_auth(client):
    assert client.get("/api/documents").status_code == 401
    assert client.post("/api/documents", json=DOC).status_code == 401


def test_create_then_list_and_get(client, auth_headers):
    created = client.post("/api/documents", json=DOC, headers=auth_headers)
    assert created.status_code == 201
    doc_id = created.json()["id"]

    listed = client.get("/api/documents", headers=auth_headers).json()
    assert [d["id"] for d in listed] == [doc_id]
    assert "markdown" not in listed[0]  # summary only

    full = client.get(f"/api/documents/{doc_id}", headers=auth_headers).json()
    assert full["markdown"] == DOC["markdown"]
    assert full["values"] == DOC["values"]


def test_list_is_newest_first(client, auth_headers):
    first = client.post("/api/documents", json={**DOC, "title": "one"}, headers=auth_headers)
    second = client.post("/api/documents", json={**DOC, "title": "two"}, headers=auth_headers)
    titles = [d["title"] for d in client.get("/api/documents", headers=auth_headers).json()]
    assert titles == ["two", "one"]
    assert first.json()["id"] != second.json()["id"]


def test_delete_removes_document(client, auth_headers):
    doc_id = client.post("/api/documents", json=DOC, headers=auth_headers).json()["id"]
    assert client.delete(f"/api/documents/{doc_id}", headers=auth_headers).status_code == 204
    assert client.get(f"/api/documents/{doc_id}", headers=auth_headers).status_code == 404
    assert client.get("/api/documents", headers=auth_headers).json() == []


def test_owner_isolation(client):
    alice = _headers(client, "alice@example.com")
    bob = _headers(client, "bob@example.com")

    doc_id = client.post("/api/documents", json=DOC, headers=alice).json()["id"]

    assert client.get("/api/documents", headers=bob).json() == []
    assert client.get(f"/api/documents/{doc_id}", headers=bob).status_code == 404
    assert client.delete(f"/api/documents/{doc_id}", headers=bob).status_code == 404
    # Alice still has it.
    assert client.get(f"/api/documents/{doc_id}", headers=alice).status_code == 200


def test_rejects_missing_fields(client, auth_headers):
    r = client.post("/api/documents", json={"slug": "x", "title": "y"}, headers=auth_headers)
    assert r.status_code == 422
