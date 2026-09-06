def test_serves_index(client):
    response = client.get("/")

    assert response.status_code == 200
    assert "Prelegal" in response.text


def test_serves_nested_route(client):
    response = client.get("/tools/mutual-nda/")

    assert response.status_code == 200
    assert "Mutual NDA" in response.text


def test_unknown_frontend_route_serves_404_page(client):
    response = client.get("/no/such/page")

    assert response.status_code == 404
    assert "page not found" in response.text


def test_unknown_api_route_stays_json(client):
    response = client.get("/api/nope")

    assert response.status_code == 404
    assert response.headers["content-type"].startswith("application/json")
