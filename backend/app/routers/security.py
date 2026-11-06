"""Security lab endpoints: run defensive tests and retrieve findings."""
import json
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import EvaluationRun, ModelConfig, SecurityFinding
from app.providers import get_provider
from app.services import security_lab

router = APIRouter(prefix="/api/security", tags=["security"])


class SecurityRunRequest(BaseModel):
    project_id: str
    model_id: str


@router.post("/run")
def run_security(body: SecurityRunRequest, db: Session = Depends(get_db)):
    model = db.get(ModelConfig, body.model_id)
    if not model or model.project_id != body.project_id:
        raise HTTPException(404, "Model not found in this project")
    run = EvaluationRun(id=str(uuid.uuid4()), project_id=body.project_id, suite_id="",
                        model_id=model.id, kind="security", status="running")
    db.add(run)
    db.commit()
    provider = get_provider(model)
    findings = security_lab.run_security_suite(provider.generate)
    for f in findings:
        db.add(SecurityFinding(
            id=str(uuid.uuid4()), run_id=run.id, test_name=f.test_name, category=f.category,
            severity=f.severity, test_input=f.test_input, model_response=f.model_response,
            expected_behavior=f.expected_behavior, actual_behavior=f.actual_behavior,
            outcome=f.outcome, evidence=json.dumps(f.evidence), mitigation=f.mitigation,
        ))
    run.status = "completed"
    run.finished_at = datetime.now(timezone.utc)
    sev_counts = {s: 0 for s in security_lab.SEVERITY_ORDER}
    for f in findings:
        sev_counts[f.severity] = sev_counts.get(f.severity, 0) + 1
    run.summary = json.dumps({"findings": len(findings), "by_severity": sev_counts,
                              "failures": sum(1 for f in findings if f.outcome == "fail")})
    db.commit()
    return {"run_id": run.id, "findings": len(findings), "by_severity": sev_counts}


@router.get("/findings")
def list_findings(run_id: str | None = None, severity: str | None = None, db: Session = Depends(get_db)):
    q = db.query(SecurityFinding)
    if run_id:
        q = q.filter(SecurityFinding.run_id == run_id)
    if severity:
        q = q.filter(SecurityFinding.severity == severity)
    return [
        {"id": f.id, "run_id": f.run_id, "test_name": f.test_name, "category": f.category,
         "severity": f.severity, "test_input": f.test_input, "model_response": f.model_response,
         "expected_behavior": f.expected_behavior, "actual_behavior": f.actual_behavior,
         "outcome": f.outcome, "evidence": json.loads(f.evidence or "{}"),
         "mitigation": f.mitigation, "created_at": f.created_at.isoformat()}
        for f in q.order_by(SecurityFinding.created_at.desc()).limit(200).all()
    ]
