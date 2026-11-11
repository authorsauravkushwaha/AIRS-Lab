"""Security lab endpoints: run defensive & adversarial tests mapped to OWASP & MITRE ATLAS."""

import json

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import SecurityFinding
from app.services.runner import execute_security_run

router = APIRouter(prefix="/api/security", tags=["security"])


class SecurityRunRequest(BaseModel):
    project_id: str
    model_id: str


@router.post("/run")
def run_security(body: SecurityRunRequest, db: Session = Depends(get_db)):
    run, findings_count = execute_security_run(db, project_id=body.project_id, model_id=body.model_id)
    summary = json.loads(run.summary or "{}")
    return {
        "run_id": run.id,
        "findings": findings_count,
        "failures": summary.get("failures", 0),
        "by_severity": summary.get("by_severity", {}),
        "by_owasp": summary.get("by_owasp", {}),
    }


@router.get("/findings")
def list_findings(
    run_id: str | None = None,
    severity: str | None = None,
    outcome: str | None = None,
    owasp_id: str | None = None,
    db: Session = Depends(get_db),
):
    q = db.query(SecurityFinding)
    if run_id:
        q = q.filter(SecurityFinding.run_id == run_id)
    if severity:
        q = q.filter(SecurityFinding.severity == severity)
    if outcome:
        q = q.filter(SecurityFinding.outcome == outcome)
    if owasp_id:
        q = q.filter(SecurityFinding.owasp_id.contains(owasp_id))
    return [
        {
            "id": f.id,
            "run_id": f.run_id,
            "test_name": f.test_name,
            "category": f.category,
            "severity": f.severity,
            "owasp_id": f.owasp_id or "",
            "mitre_atlas_id": f.mitre_atlas_id or "",
            "cwe_id": f.cwe_id or "",
            "test_input": f.test_input,
            "model_response": f.model_response,
            "expected_behavior": f.expected_behavior,
            "actual_behavior": f.actual_behavior,
            "outcome": f.outcome,
            "evidence": json.loads(f.evidence or "{}"),
            "mitigation": f.mitigation,
            "created_at": f.created_at.isoformat(),
        }
        for f in q.order_by(SecurityFinding.created_at.desc()).limit(300).all()
    ]
