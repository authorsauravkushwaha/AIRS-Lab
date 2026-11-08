"""Governance Release Gates: automated pre-deployment sign-off & cryptographic certificates."""
import hashlib
import json
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import EvaluationRun, ModelConfig, Project, ReleaseGate, SecurityFinding
from app.services.audit import log, verify_audit_chain
from app.services.runner import execute_reliability_run, execute_security_run

router = APIRouter(prefix="/api/gates", tags=["gates"])


class GateIn(BaseModel):
    project_id: str
    name: str = Field(min_length=1, max_length=200)
    description: str = ""
    suite_id: str = ""
    min_pass_rate: float = Field(default=85.0, ge=0.0, le=100.0)
    max_critical_findings: int = Field(default=0, ge=0)
    max_high_findings: int = Field(default=0, ge=0)
    max_avg_latency_ms: float | None = Field(default=None, gt=0)
    max_cost_per_case_usd: float | None = Field(default=None, gt=0)
    require_audit_integrity: bool = True


class GateEvalRequest(BaseModel):
    model_id: str
    execute_fresh: bool = False


def _out(g: ReleaseGate) -> dict:
    return {
        "id": g.id,
        "project_id": g.project_id,
        "name": g.name,
        "description": g.description,
        "suite_id": g.suite_id or "",
        "min_pass_rate": g.min_pass_rate,
        "max_critical_findings": g.max_critical_findings,
        "max_high_findings": g.max_high_findings,
        "max_avg_latency_ms": g.max_avg_latency_ms,
        "max_cost_per_case_usd": g.max_cost_per_case_usd,
        "require_audit_integrity": g.require_audit_integrity,
        "last_verdict": g.last_verdict,
        "last_model_id": g.last_model_id,
        "last_certificate": json.loads(g.last_certificate or "{}"),
        "last_evaluated_at": g.last_evaluated_at.isoformat() if g.last_evaluated_at else None,
        "created_at": g.created_at.isoformat(),
    }


@router.post("", status_code=201)
def create_gate(body: GateIn, db: Session = Depends(get_db)):
    if not db.get(Project, body.project_id):
        raise HTTPException(404, "Project not found")
    g = ReleaseGate(
        id=str(uuid.uuid4()),
        project_id=body.project_id,
        name=body.name,
        description=body.description,
        suite_id=body.suite_id,
        min_pass_rate=body.min_pass_rate,
        max_critical_findings=body.max_critical_findings,
        max_high_findings=body.max_high_findings,
        max_avg_latency_ms=body.max_avg_latency_ms,
        max_cost_per_case_usd=body.max_cost_per_case_usd,
        require_audit_integrity=body.require_audit_integrity,
    )
    db.add(g)
    log(db, "gate.created", entity=g.id, detail=f"{g.name} (min_pass={g.min_pass_rate}%)")
    db.commit()
    db.refresh(g)
    return _out(g)


@router.get("")
def list_gates(project_id: str | None = None, db: Session = Depends(get_db)):
    q = db.query(ReleaseGate)
    if project_id:
        q = q.filter(ReleaseGate.project_id == project_id)
    return [_out(g) for g in q.order_by(ReleaseGate.created_at.desc()).all()]


def evaluate_gate_for_model(db: Session, gate: ReleaseGate, model: ModelConfig, *, execute_fresh: bool = False) -> dict:
    if execute_fresh:
        if gate.suite_id:
            execute_reliability_run(db, project_id=gate.project_id, suite_id=gate.suite_id, model_id=model.id)
        execute_security_run(db, project_id=gate.project_id, model_id=model.id)

    rel_q = db.query(EvaluationRun).filter(
        EvaluationRun.project_id == gate.project_id,
        EvaluationRun.model_id == model.id,
        EvaluationRun.kind == "reliability",
        EvaluationRun.status == "completed",
    )
    if gate.suite_id:
        rel_q = rel_q.filter(EvaluationRun.suite_id == gate.suite_id)
    rel_run = rel_q.order_by(EvaluationRun.started_at.desc()).first()

    sec_run = db.query(EvaluationRun).filter(
        EvaluationRun.project_id == gate.project_id,
        EvaluationRun.model_id == model.id,
        EvaluationRun.kind == "security",
        EvaluationRun.status == "completed",
    ).order_by(EvaluationRun.started_at.desc()).first()

    blocking_reasons: list[str] = []
    checks: list[dict] = []

    if not rel_run:
        blocking_reasons.append("No completed reliability evaluation run found for this model/suite.")
        pass_rate = None
        avg_lat = None
        rel_summary = {}
    else:
        rel_summary = json.loads(rel_run.summary or "{}")
        pass_rate = rel_summary.get("pass_rate")
        avg_lat = rel_summary.get("avg_latency_ms")
        ok_pass = pass_rate is not None and pass_rate >= gate.min_pass_rate
        checks.append({
            "check": "min_pass_rate",
            "expected": f">= {gate.min_pass_rate}%",
            "actual": f"{pass_rate}%" if pass_rate is not None else "N/A",
            "passed": ok_pass,
        })
        if not ok_pass:
            blocking_reasons.append(f"Pass rate {pass_rate}% is below gate threshold {gate.min_pass_rate}%.")

        if gate.max_avg_latency_ms is not None and avg_lat is not None:
            ok_lat = avg_lat <= gate.max_avg_latency_ms
            checks.append({
                "check": "max_avg_latency_ms",
                "expected": f"<= {gate.max_avg_latency_ms} ms",
                "actual": f"{avg_lat} ms",
                "passed": ok_lat,
            })
            if not ok_lat:
                blocking_reasons.append(f"Average latency {avg_lat} ms exceeds limit {gate.max_avg_latency_ms} ms.")

    if not sec_run:
        blocking_reasons.append("No completed security scan found for this model.")
        crit_fails = None
        high_fails = None
    else:
        sec_findings = db.query(SecurityFinding).filter(SecurityFinding.run_id == sec_run.id).all()
        # Exclude static policy-engine self-test fixtures (which test the policy rules, not the model)
        model_findings = [
            f for f in sec_findings
            if not f.test_name.startswith("Tool policy gate:")
            and not f.test_name.startswith("Tool call simulation:")
        ]
        crit_fails = sum(1 for f in model_findings if f.outcome == "fail" and f.severity == "critical")
        high_fails = sum(1 for f in model_findings if f.outcome == "fail" and f.severity == "high")
        ok_crit = crit_fails <= gate.max_critical_findings
        ok_high = high_fails <= gate.max_high_findings
        checks.append({
            "check": "max_critical_findings",
            "expected": f"<= {gate.max_critical_findings}",
            "actual": str(crit_fails),
            "passed": ok_crit,
        })
        checks.append({
            "check": "max_high_findings",
            "expected": f"<= {gate.max_high_findings}",
            "actual": str(high_fails),
            "passed": ok_high,
        })
        if not ok_crit:
            blocking_reasons.append(f"{crit_fails} critical security failure(s) exceed maximum {gate.max_critical_findings}.")
        if not ok_high:
            blocking_reasons.append(f"{high_fails} high-severity security failure(s) exceed maximum {gate.max_high_findings}.")

    audit_state = verify_audit_chain(db)
    if gate.require_audit_integrity:
        checks.append({
            "check": "audit_chain_integrity",
            "expected": "SHA-256 chain valid",
            "actual": "valid" if audit_state["valid"] else "TAMPERED",
            "passed": audit_state["valid"],
        })
        if not audit_state["valid"]:
            blocking_reasons.append("Workspace cryptographic audit trail failed SHA-256 verification.")

    verdict = "approved" if not blocking_reasons else "blocked"
    now = datetime.now(timezone.utc)
    cert_body = {
        "gate_id": gate.id,
        "gate_name": gate.name,
        "model_id": model.id,
        "model_name": model.name,
        "provider": model.provider,
        "verdict": verdict,
        "reliability_run_id": rel_run.id if rel_run else None,
        "dataset_hash": rel_run.dataset_hash if rel_run else None,
        "security_run_id": sec_run.id if sec_run else None,
        "checks": checks,
        "blocking_reasons": blocking_reasons,
        "evaluated_at": now.isoformat(),
    }
    cert_sig = hashlib.sha256(json.dumps(cert_body, sort_keys=True).encode("utf-8")).hexdigest()
    cert_body["certificate_sha256"] = cert_sig

    gate.last_verdict = verdict
    gate.last_model_id = model.id
    gate.last_evaluated_at = now
    gate.last_certificate = json.dumps(cert_body)
    log(db, f"gate.{verdict}", entity=gate.id, detail=f"model={model.name} sig={cert_sig[:12]}")
    db.commit()
    db.refresh(gate)
    return _out(gate)


@router.post("/{gate_id}/evaluate")
def evaluate_gate(gate_id: str, body: GateEvalRequest, db: Session = Depends(get_db)):
    gate = db.get(ReleaseGate, gate_id)
    if not gate:
        raise HTTPException(404, "Release gate not found")
    model = db.get(ModelConfig, body.model_id)
    if not model or model.project_id != gate.project_id:
        raise HTTPException(404, "Model not found in this project")
    return evaluate_gate_for_model(db, gate, model, execute_fresh=body.execute_fresh)


@router.delete("/{gate_id}", status_code=204)
def delete_gate(gate_id: str, db: Session = Depends(get_db)):
    g = db.get(ReleaseGate, gate_id)
    if not g:
        raise HTTPException(404, "Release gate not found")
    log(db, "gate.deleted", entity=g.id, detail=g.name)
    db.delete(g)
    db.commit()
