"""Dashboard overview, model comparison and recommendations — all derived from stored rows."""
import json
from collections import Counter

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import EvaluationResult, EvaluationRun, SecurityFinding, TestCase

router = APIRouter(prefix="/api", tags=["analytics"])


@router.get("/dashboard/overview")
def overview(project_id: str | None = None, db: Session = Depends(get_db)):
    runs_q = db.query(EvaluationRun)
    if project_id:
        runs_q = runs_q.filter(EvaluationRun.project_id == project_id)
    runs = runs_q.all()
    results = db.query(EvaluationResult).join(EvaluationRun).filter(
        EvaluationRun.project_id == project_id).all() if project_id else db.query(EvaluationResult).all()
    counts = Counter(r.status for r in results)
    done = counts["PASS"] + counts["FAIL"] + counts["UNCERTAIN"]
    findings_q = db.query(SecurityFinding)
    if project_id:
        findings_q = findings_q.join(EvaluationRun).filter(EvaluationRun.project_id == project_id)
    sev = Counter(f.severity for f in findings_q.all())
    cases_q = db.query(TestCase)
    recent = runs_q.order_by(EvaluationRun.started_at.desc()).limit(10).all()
    lat = sorted(r.latency_ms for r in results if r.latency_ms)
    return {
        "total_runs": len(runs),
        "total_test_cases": cases_q.count(),
        "pass_rate": round(counts["PASS"] / done * 100, 1) if done else None,
        "failed": counts["FAIL"],
        "uncertain": counts["UNCERTAIN"],
        "errors": counts["ERROR"],
        "security_by_severity": {s: sev.get(s, 0) for s in ["critical", "high", "medium", "low", "info"]},
        "avg_latency_ms": round(sum(lat) / len(lat), 1) if lat else None,
        "total_tokens": sum(r.tokens_in + r.tokens_out for r in results),
        "recent_runs": [{"id": r.id, "kind": r.kind, "status": r.status,
                         "summary": json.loads(r.summary or "{}"), "started_at": r.started_at.isoformat()}
                        for r in recent],
    }


class CompareRequest(BaseModel):
    project_id: str
    model_ids: list[str]
    suite_id: str | None = None


@router.post("/comparisons/run")
def compare(body: CompareRequest, db: Session = Depends(get_db)):
    if len(body.model_ids) < 2:
        from fastapi import HTTPException
        raise HTTPException(400, "Select at least two models")
    per_model = {}
    for mid in body.model_ids:
        q = db.query(EvaluationRun).filter(
            EvaluationRun.model_id == mid, EvaluationRun.project_id == body.project_id,
            EvaluationRun.status == "completed")
        if body.suite_id:
            q = q.filter(EvaluationRun.suite_id == body.suite_id)
        runs = q.order_by(EvaluationRun.started_at.desc()).limit(5).all()
        results = db.query(EvaluationResult).filter(EvaluationResult.run_id.in_([r.id for r in runs])).all() \
            if runs else []
        counts = Counter(r.status for r in results)
        done = counts["PASS"] + counts["FAIL"] + counts["UNCERTAIN"]
        lat = sorted(r.latency_ms for r in results if r.latency_ms)
        per_model[mid] = {
            "runs": len(runs),
            "pass_rate": round(counts["PASS"] / done * 100, 1) if done else None,
            "avg_latency_ms": round(sum(lat) / len(lat), 1) if lat else None,
            "total_tokens": sum(r.tokens_in + r.tokens_out for r in results),
            "fail": counts["FAIL"], "uncertain": counts["UNCERTAIN"],
        }
    return {"models": per_model}
