"""Dashboard overview, model comparison and recommendations — all derived from stored rows."""
import json
from collections import Counter

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import EvaluationResult, EvaluationRun, ModelConfig, Report, SecurityFinding, TestCase

router = APIRouter(prefix="/api", tags=["analytics"])


@router.get("/dashboard/overview")
def overview(project_id: str | None = None, db: Session = Depends(get_db)):
    runs_q = db.query(EvaluationRun)
    if project_id:
        runs_q = runs_q.filter(EvaluationRun.project_id == project_id)
    runs = runs_q.all()
    run_ids = [r.id for r in runs]

    results_q = db.query(EvaluationResult)
    if project_id:
        results_q = results_q.join(EvaluationRun, EvaluationResult.run_id == EvaluationRun.id) \
                             .filter(EvaluationRun.project_id == project_id)
    results = results_q.all()

    counts = Counter(r.status for r in results)
    done = counts["PASS"] + counts["FAIL"] + counts["UNCERTAIN"]

    findings_q = db.query(SecurityFinding)
    if project_id:
        findings_q = findings_q.join(EvaluationRun, SecurityFinding.run_id == EvaluationRun.id) \
                               .filter(EvaluationRun.project_id == project_id)
    sev = Counter(f.severity for f in findings_q.all())

    from app.models import TestSuite
    if project_id:
        total_cases = db.query(TestCase).join(TestSuite, TestCase.suite_id == TestSuite.id) \
                        .filter(TestSuite.project_id == project_id).count()
    else:
        total_cases = db.query(TestCase).count()

    lat = sorted(r.latency_ms for r in results if r.latency_ms)

    model_names = {m.id: m.name for m in db.query(ModelConfig).all()}
    recent = sorted(runs, key=lambda r: r.started_at or 0, reverse=True)[:10]

    # Pass-rate trend over the 12 most recent completed reliability/security runs.
    completed = [r for r in runs if r.status == "completed"]
    completed.sort(key=lambda r: r.started_at)
    trend = []
    for r in completed[-12:]:
        summary = json.loads(r.summary or "{}")
        if r.kind == "security":
            continue
        trend.append({
            "id": r.id,
            "label": r.started_at.strftime("%d %b %H:%M") if r.started_at else r.id[:8],
            "pass_rate": summary.get("pass_rate"),
        })

    # Per-category breakdown across the stored results.
    case_meta = {c.id: c for c in db.query(TestCase).all()}
    cat_total: Counter = Counter()
    cat_pass: Counter = Counter()
    for r in results:
        case = case_meta.get(r.test_case_id)
        category = case.category if case else "unknown"
        cat_total[category] += 1
        if r.status == "PASS":
            cat_pass[category] += 1
    category_breakdown = [
        {"category": c, "total": cat_total[c], "passed": cat_pass[c],
         "pass_rate": round(cat_pass[c] / cat_total[c] * 100, 1) if cat_total[c] else None}
        for c in sorted(cat_total, key=lambda c: (-cat_total[c], c))
    ]

    total_reports = db.query(Report).count()

    return {
        "total_runs": len(runs),
        "total_test_cases": total_cases,
        "pass_rate": round(counts["PASS"] / done * 100, 1) if done else None,
        "failed": counts["FAIL"],
        "uncertain": counts["UNCERTAIN"],
        "errors": counts["ERROR"],
        "security_by_severity": {s: sev.get(s, 0) for s in ["critical", "high", "medium", "low", "info"]},
        "avg_latency_ms": round(sum(lat) / len(lat), 1) if lat else None,
        "total_tokens": sum(r.tokens_in + r.tokens_out for r in results),
        "total_reports": total_reports,
        "pass_rate_trend": trend,
        "category_breakdown": category_breakdown,
        "recent_runs": [{"id": r.id, "kind": r.kind, "status": r.status,
                         "model_name": model_names.get(r.model_id),
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
        raise HTTPException(400, "Select at least two models")
    per_model = {}
    for mid in body.model_ids:
        q = db.query(EvaluationRun).filter(
            EvaluationRun.model_id == mid, EvaluationRun.project_id == body.project_id,
            EvaluationRun.status == "completed", EvaluationRun.kind == "reliability")
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
