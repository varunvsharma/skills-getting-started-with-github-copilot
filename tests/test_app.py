from fastapi.testclient import TestClient
from src.app import app
import uuid

client = TestClient(app)


def unique_email():
    return f"testuser+{uuid.uuid4().hex[:8]}@example.com"


def test_get_activities():
    resp = client.get("/activities")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, dict)
    assert "Chess Club" in data


def test_signup_and_unregister_flow():
    email = unique_email()
    activity = "Chess Club"

    # ensure not present
    resp = client.get("/activities")
    assert email not in resp.json()[activity]["participants"]

    # signup
    resp2 = client.post(f"/activities/{activity}/signup", params={"email": email})
    assert resp2.status_code == 200

    # check present
    resp3 = client.get("/activities")
    assert email in resp3.json()[activity]["participants"]

    # unregister
    resp4 = client.delete(f"/activities/{activity}/participants", params={"email": email})
    assert resp4.status_code == 200

    # check removed
    resp5 = client.get("/activities")
    assert email not in resp5.json()[activity]["participants"]


def test_signup_duplicate():
    email = unique_email()
    activity = "Chess Club"

    resp = client.post(f"/activities/{activity}/signup", params={"email": email})
    assert resp.status_code == 200

    resp2 = client.post(f"/activities/{activity}/signup", params={"email": email})
    assert resp2.status_code == 400

    # cleanup
    client.delete(f"/activities/{activity}/participants", params={"email": email})


def test_unregister_not_registered():
    email = unique_email()
    activity = "Chess Club"

    resp = client.delete(f"/activities/{activity}/participants", params={"email": email})
    assert resp.status_code == 404


def test_activity_not_found():
    email = unique_email()
    activity = "Nonexistent Activity 12345"

    resp = client.post(f"/activities/{activity}/signup?email={email}")
    assert resp.status_code == 404
