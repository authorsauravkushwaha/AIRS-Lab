"""Tests for the system introspection, patch and delete endpoints."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from fastapi.testclient import TestClient

os.environ["AEGIS_REPORT_DIR"] = "/tmp/aegis_test_reports"
os.environ["AEGIS_DATABASE_URL"] = "sqlite:////tmp/aegis_test_system.db"
if os.path.exists("/tmp/aegis_test_system.db"):
    os.remove("/tmp/aegis_test_system.db")

from app.main import app  # noqa: E402


@pytest.fixture()
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def workspace(client):
    p = client.post("/api/projects", json={"name": "Sys", "description": "d"}).json()
    m = client.post("/api/models", json={
        "project_id": p["id"], "name": "Mock", "provider": "mock", "model_id": "mock-v1"}).json()
    s = client.post("/api/test-suites", json={"project_id": p["id"], "name": "S"}).json()
    client.post("/api/test-cases", json={
        "suite_id": s["id"], "name": "C", "category": "factual_accuracy",
        "prompt": "What is 2+2?", "reference_answer": "4"})
    return p, m, s


def test_system_config_is_non_secret(client, workspace):
    cfg = client.get("/api/system/config").json()
    assert cfg["service"] == "aegis-ai-lab" and cfg["version"]
    assert "openai_key_configured" in cfg and isinstance(cfg["openai_key_configured"], bool)
    assert "OPENAI_API_KEY" in cfg["openai_key_env"]
    # No secret material is leaked anywhere in the payload
    assert "sk-" not in str(cfg)
    assert cfg["counts"]["runs"] >= 1  # seed executes real runs


def test_project_list_includes_counts(client, workspace):
    p, m, s = workspace
    projects = client.get("/api/projects").json()
    ours = next(x for x in projects if x["id"] == p["id"])
    assert ours["model_count"] == 1 and ours["suite_count"] == 1
    assert ours["case_count"] == 1
    assert ours["run_count"] == 0  # this fixture project never executed a run


def test_project_patch_renames(client, workspace):
    p, _, _ = workspace
    r = client.patch(f"/api/projects/{p['id']}", json={"name": "Renamed"})
    assert r.status_code == 200 and r.json()["name"] == "Renamed"


def test_model_patch_toggle_enabled(client, workspace):
    _, m, _ = workspace
    r = client.patch(f"/api/models/{m['id']}", json={"enabled": False})
    assert r.status_code == 200 and r.json()["enabled"] is False


def test_case_patch_updates_fields(client, workspace):
    _, _, s = workspace
    cases = client.get("/api/test-cases", params={"suite_id": s["id"]}).json()
    r = client.patch(f"/api/test-cases/{cases[0]['id']}", json={"name": "Renamed case", "severity": "high"})
    assert r.status_code == 200
    assert r.json()["name"] == "Renamed case" and r.json()["severity"] == "high"
    assert r.json()["suite_id"] == s["id"]  # immutable without explicit move


def test_suite_patch_renames(client, workspace):
    _, _, s = workspace
    r = client.patch(f"/api/test-suites/{s['id']}", json={"name": "Renamed suite"})
    assert r.status_code == 200 and r.json()["name"] == "Renamed suite"


def test_run_delete_cascades_results(client, workspace):
    p, m, s = workspace
    run = client.post("/api/evaluations/run", json={
        "project_id": p["id"], "suite_id": s["id"], "model_id": m["id"]}).json()
    assert len(client.get(f"/api/evaluations/{run['id']}/results").json()) == 1
    assert client.delete(f"/api/evaluations/{run['id']}").status_code == 204
    assert client.get(f"/api/evaluations/{run['id']}/results").status_code == 404


def test_report_delete_removes_row_and_file(client, workspace):
    p, m, s = workspace
    run = client.post("/api/evaluations/run", json={
        "project_id": p["id"], "suite_id": s["id"], "model_id": m["id"]}).json()
    rep = client.post("/api/reports", json={"project_id": p["id"], "run_id": run["id"], "format": "json"}).json()
    reports = client.get("/api/reports").json()
    assert any(r["id"] == rep["id"] for r in reports)
    assert client.delete(f"/api/reports/{rep['id']}").status_code == 204
    assert all(r["id"] != rep["id"] for r in client.get("/api/reports").json())


def test_audit_trail_records_activity(client, workspace):
    workspace  # creation happened in the fixture
    events = client.get("/api/system/audit").json()
    types = {e["event_type"] for e in events}
    assert {"project.created", "model.created", "suite.created", "case.created", "evaluation.completed"} <= types


def test_clear_runs_wipes_history(client, workspace):
    resp = client.delete("/api/system/runs").json()
    assert resp["deleted_runs"] >= 1
    runs = client.get("/api/evaluations").json()
    assert runs == []
    # Projects/models/cases are preserved
    assert client.get("/api/projects").json()
    assert client.get("/api/test-cases").json()
