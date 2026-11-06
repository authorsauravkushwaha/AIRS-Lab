import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from fastapi.testclient import TestClient

os.environ["AEGIS_DATABASE_URL"] = "sqlite:////tmp/aegis_test.db"
if os.path.exists("/tmp/aegis_test.db"):
    os.remove("/tmp/aegis_test.db")

from app.main import app  # noqa: E402


@pytest.fixture()
def client():
    with TestClient(app) as c:
        yield c


def test_health(client):
    assert client.get("/api/health").json()["status"] == "ok"


def test_project_and_model_flow(client):
    p = client.post("/api/projects", json={"name": "T", "description": ""}).json()
    m = client.post("/api/models", json={
        "project_id": p["id"], "name": "Mock", "provider": "mock", "model_id": "mock-v1",
    }).json()
    assert m["provider"] == "mock"
    conn = client.post(f"/api/models/{m['id']}/test-connection").json()
    assert conn["ok"] is True


def test_case_crud_duplicate_search(client):
    p = client.post("/api/projects", json={"name": "P2"}).json()
    s = client.post("/api/test-suites", json={"project_id": p["id"], "name": "S"}).json()
    c = client.post("/api/test-cases", json={
        "suite_id": s["id"], "name": "Factual Q", "category": "factual_accuracy", "prompt": "2+2?",
    }).json()
    assert c["severity"] == "medium"
    dup = client.post(f"/api/test-cases/{c['id']}/duplicate").json()
    assert dup["name"].endswith("(copy)")
    assert len(client.get("/api/test-cases", params={"q": "Factual"}).json()) >= 1
    assert client.delete(f"/api/test-cases/{c['id']}").status_code == 204


def test_case_validation_rejects_bad_severity(client):
    p = client.post("/api/projects", json={"name": "P3"}).json()
    s = client.post("/api/test-suites", json={"project_id": p["id"], "name": "S"}).json()
    r = client.post("/api/test-cases", json={
        "suite_id": s["id"], "name": "x", "prompt": "x", "severity": "bogus",
    })
    assert r.status_code == 422


def test_dashboard_and_report(client):
    p = client.post("/api/projects", json={"name": "Dash"}).json()
    m = client.post("/api/models", json={"project_id": p["id"], "name": "M", "provider": "mock", "model_id": "mock-v1"}).json()
    s = client.post("/api/test-suites", json={"project_id": p["id"], "name": "S"}).json()
    client.post("/api/test-cases", json={"suite_id": s["id"], "name": "C", "category": "factual_accuracy",
                                         "prompt": "What is 2+2?", "reference_answer": "4"})
    run = client.post("/api/evaluations/run", json={"project_id": p["id"], "suite_id": s["id"], "model_id": m["id"]}).json()
    ov = client.get("/api/dashboard/overview", params={"project_id": p["id"]}).json()
    assert ov["total_runs"] >= 1 and ov["pass_rate"] == 100.0
    for fmt in ["json", "csv", "pdf"]:
        r = client.post("/api/reports", json={"project_id": p["id"], "run_id": run["id"], "format": fmt})
        assert r.status_code == 201, r.text
        dl = client.get(f"/api/reports/{r.json()['id']}/download")
        assert dl.status_code == 200
