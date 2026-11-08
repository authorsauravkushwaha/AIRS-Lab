"""End-to-end main journey over HTTP (Playwright spec in /e2e covers the browser path)."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from fastapi.testclient import TestClient

from platform_paths import TEMP_DIR, database_url, reset_database

os.environ["AEGIS_REPORT_DIR"] = str(TEMP_DIR / "reports")
os.environ["AEGIS_DATABASE_URL"] = database_url("e2e.db")
reset_database("e2e.db")

from app.main import app  # noqa: E402


@pytest.fixture()
def client():
    with TestClient(app) as c:
        yield c


def test_main_journey(client):
    # 1. create project
    p = client.post("/api/projects", json={"name": "Journey", "description": "e2e"}).json()
    # 2. mock model
    m = client.post("/api/models", json={"project_id": p["id"], "name": "Mock", "provider": "mock", "model_id": "mock-v1"}).json()
    assert client.post(f"/api/models/{m['id']}/test-connection").json()["ok"]
    # 3. suite + cases
    s = client.post("/api/test-suites", json={"project_id": p["id"], "name": "Journey Suite"}).json()
    client.post("/api/test-cases", json={"suite_id": s["id"], "name": "C1", "category": "factual_accuracy",
                                         "prompt": "What is 2+2?", "reference_answer": "4"})
    client.post("/api/test-cases", json={"suite_id": s["id"], "name": "C2", "category": "factual_accuracy",
                                         "prompt": "What is the capital of France?", "reference_answer": "Paris"})
    # 4. run evaluation
    run = client.post("/api/evaluations/run", json={"project_id": p["id"], "suite_id": s["id"], "model_id": m["id"]}).json()
    assert run["status"] == "completed"
    # 5. view results, investigate a case
    results = client.get(f"/api/evaluations/{run['id']}/results").json()
    assert len(results) == 2 and all(r["status"] == "PASS" for r in results)
    # 6. security run + 7. report in all formats
    sec = client.post("/api/security/run", json={"project_id": p["id"], "model_id": m["id"]}).json()
    assert sec["findings"] > 0
    for fmt in ("json", "csv", "pdf"):
        r = client.post("/api/reports", json={"project_id": p["id"], "run_id": run["id"], "format": fmt}).json()
        assert client.get(f"/api/reports/{r['id']}/download").status_code == 200
    # 8. dashboard reflects the run
    ov = client.get("/api/dashboard/overview", params={"project_id": p["id"]}).json()
    assert ov["total_runs"] >= 1 and ov["pass_rate"] == 100.0
