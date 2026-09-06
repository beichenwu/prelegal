"""Auth endpoint tests."""

import jwt

from app.config import settings

GOOD = {"email": "a@example.com", "password": "password123"}


def test_register_returns_token_and_user(client):
    r = client.post("/api/auth/register", json=GOOD)
    assert r.status_code == 201
    body = r.json()
    assert body["token_type"] == "bearer"
    assert body["user"]["email"] == "a@example.com"
    payload = jwt.decode(body["access_token"], settings.secret_key, algorithms=["HS256"])
    assert payload["sub"] == str(body["user"]["id"])


def test_register_rejects_duplicate_email(client):
    client.post("/api/auth/register", json=GOOD)
    r = client.post("/api/auth/register", json={**GOOD, "password": "different1"})
    assert r.status_code == 409


def test_register_rejects_short_password(client):
    r = client.post("/api/auth/register", json={"email": "b@example.com", "password": "short"})
    assert r.status_code == 422


def test_register_rejects_bad_email(client):
    r = client.post("/api/auth/register", json={"email": "not-an-email", "password": "password123"})
    assert r.status_code == 422


def test_login_succeeds_with_correct_password(client):
    client.post("/api/auth/register", json=GOOD)
    r = client.post("/api/auth/login", json=GOOD)
    assert r.status_code == 200
    assert r.json()["access_token"]


def test_login_is_case_insensitive_on_email(client):
    client.post("/api/auth/register", json=GOOD)
    r = client.post("/api/auth/login", json={"email": "A@EXAMPLE.COM", "password": "password123"})
    assert r.status_code == 200


def test_login_fails_with_wrong_password(client):
    client.post("/api/auth/register", json=GOOD)
    r = client.post("/api/auth/login", json={**GOOD, "password": "wrongpass1"})
    assert r.status_code == 401


def test_login_fails_for_unknown_user(client):
    r = client.post("/api/auth/login", json=GOOD)
    assert r.status_code == 401


def test_me_returns_current_user(client, auth_headers):
    r = client.get("/api/auth/me", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["email"] == "tester@example.com"


def test_me_rejects_missing_token(client):
    assert client.get("/api/auth/me").status_code == 401


def test_me_rejects_garbage_token(client):
    r = client.get("/api/auth/me", headers={"Authorization": "Bearer not.a.jwt"})
    assert r.status_code == 401


def test_me_rejects_expired_token(client, auth_headers, monkeypatch):
    import app.auth as auth_module

    # A token minted with a negative TTL is already expired.
    monkeypatch.setattr(settings, "access_token_ttl_hours", -1)
    token = auth_module.create_access_token(1)
    r = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401
