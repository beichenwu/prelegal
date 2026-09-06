from datetime import datetime


def test_health_ok(client):
    response = client.get("/api/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["database"] == "ok"
    assert body["initialized_at"]


def test_health_timestamp_is_iso(client):
    body = client.get("/api/health").json()

    # Raises ValueError if the stamp is not a valid ISO-8601 datetime.
    datetime.fromisoformat(body["initialized_at"])
