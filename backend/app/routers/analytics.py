"""Dashboard overview, paired statistical model comparison & inference arbitrage ROI."""
import json
from collections import Counter

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import (
    EvaluationResult,
    EvaluationRun,
    ModelConfig,
    ProductionTrace,
    ReleaseGate,
    Report,
    SecurityFinding,
    TestCase,
    TestSuite,
)
from app.services.audit import verify_audit_chain
from app.services.evaluation_engine import mcnemar_paired_test, wilson_interval
from app.services.pricing import compute_arbitrage_roi

router = APIRouter(prefix="/api", tags=["analytics"])


@router.get("/dashboard/overview")
def overview(project_id: str | None = None, db: Session = Depends(get_db)):
    runs_q = db.query(EvaluationRun)
    if project_id:
        runs_q = runs_q.filter(EvaluationRun.project_id == project_id)
    runs = runs_q.all()

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
    all_findings = findings_q.all()
    sev = Counter(f.severity for f in all_findings)

    if project_id:
        total_cases = db.query(TestCase).join(TestSuite, TestCase.suite_id == TestSuite.id) \
                        .filter(TestSuite.project_id == project_id).count()
    else:
        total_cases = db.query(TestCase).count()

    lat = sorted(r.latency_ms for r in results if r.latency_ms)
    p95_idx = min(len(lat) - 1, int(round(0.95 * (len(lat) - 1)))) if lat else 0
    p95_lat = round(lat[p95_idx], 1) if lat else None

    model_names = {m.id: m.name for m in db.query(ModelConfig).all()}
    recent = sorted(runs, key=lambda r: r.started_at or 0, reverse=True)[:10]

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
        {
            "category": c,
            "total": cat_total[c],
            "passed": cat_pass[c],
            "pass_rate": round(cat_pass[c] / cat_total[c] * 100, 1) if cat_total[c] else None,
        }
        for c in sorted(cat_total, key=lambda c: (-cat_total[c], c))
    ]

    gates_q = db.query(ReleaseGate)
    traces_q = db.query(ProductionTrace)
    if project_id:
        gates_q = gates_q.filter(ReleaseGate.project_id == project_id)
        traces_q = traces_q.filter(ProductionTrace.project_id == project_id)
    gates = gates_q.all()
    audit_status = verify_audit_chain(db)

    return {
        "total_runs": len(runs),
        "total_test_cases": total_cases,
        "pass_rate": round(counts["PASS"] / done * 100, 1) if done else None,
        "wilson_95_ci": wilson_interval(counts["PASS"], done),
        "failed": counts["FAIL"],
        "uncertain": counts["UNCERTAIN"],
        "errors": counts["ERROR"],
        "security_by_severity": {s: sev.get(s, 0) for s in ["critical", "high", "medium", "low", "info"]},
        "avg_latency_ms": round(sum(lat) / len(lat), 1) if lat else None,
        "p95_latency_ms": p95_lat,
        "total_tokens": sum(r.tokens_in + r.tokens_out for r in results),
        "total_cost_usd": round(sum(r.est_cost_usd for r in results), 6),
        "total_reports": db.query(Report).count(),
        "total_gates": len(gates),
        "approved_gates": sum(1 for g in gates if g.last_verdict == "approved"),
        "total_traces": traces_q.count(),
        "audit_chain_valid": audit_status["valid"],
        "audit_events_verified": audit_status["checked_events"],
        "pass_rate_trend": trend,
        "category_breakdown": category_breakdown,
        "recent_runs": [
            {
                "id": r.id,
                "kind": r.kind,
                "status": r.status,
                "model_name": model_names.get(r.model_id),
                "dataset_hash": r.dataset_hash or "",
                "summary": json.loads(r.summary or "{}"),
                "started_at": r.started_at.isoformat(),
            }
            for r in recent
        ],
    }


class CompareRequest(BaseModel):
    project_id: str
    model_ids: list[str]
    suite_id: str | None = None
    monthly_calls: int = Field(default=1_000_000, ge=1_000, le=1_000_000_000)


@router.post("/comparisons/run")
def compare(body: CompareRequest, db: Session = Depends(get_db)):
    if len(body.model_ids) < 2:
        raise HTTPException(400, "Select at least two models")

    case_names = {c.id: c.name for c in db.query(TestCase).all()}
    per_model: dict[str, dict] = {}
    latest_case_outcomes: dict[str, dict[str, tuple[str, bool]]] = {}

    for mid in body.model_ids:
        q = db.query(EvaluationRun).filter(
            EvaluationRun.model_id == mid,
            EvaluationRun.project_id == body.project_id,
            EvaluationRun.status == "completed",
            EvaluationRun.kind == "reliability",
        )
        if body.suite_id:
            q = q.filter(EvaluationRun.suite_id == body.suite_id)
        runs = q.order_by(EvaluationRun.started_at.desc()).limit(5).all()
        results = (
            db.query(EvaluationResult).filter(EvaluationResult.run_id.in_([r.id for r in runs])).all()
            if runs else []
        )
        counts = Counter(r.status for r in results)
        done = counts["PASS"] + counts["FAIL"] + counts["UNCERTAIN"]
        lat = sorted(r.latency_ms for r in results if r.latency_ms)
        p95_idx = min(len(lat) - 1, int(round(0.95 * (len(lat) - 1)))) if lat else 0
        total_cost = sum(r.est_cost_usd for r in results)
        avg_cost_per_call = (total_cost / len(results)) if results else 0.0
        cppt = (total_cost / counts["PASS"]) if counts["PASS"] > 0 and total_cost > 0 else None

        if runs:
            latest_results = db.query(EvaluationResult).filter(EvaluationResult.run_id == runs[0].id).all()
            latest_case_outcomes[mid] = {
                r.test_case_id: (case_names.get(r.test_case_id, r.test_case_id[:8]), r.status == "PASS")
                for r in latest_results
            }
        else:
            latest_case_outcomes[mid] = {}

        per_model[mid] = {
            "runs": len(runs),
            "pass_rate": round(counts["PASS"] / done * 100, 1) if done else None,
            "wilson_95_ci": wilson_interval(counts["PASS"], done),
            "avg_latency_ms": round(sum(lat) / len(lat), 1) if lat else None,
            "p95_latency_ms": round(lat[p95_idx], 1) if lat else None,
            "total_tokens": sum(r.tokens_in + r.tokens_out for r in results),
            "est_cost_usd": round(total_cost, 6),
            "avg_cost_per_call_usd": round(avg_cost_per_call, 8),
            "cost_per_verified_pass_usd": round(cppt, 8) if cppt is not None else None,
            "fail": counts["FAIL"],
            "uncertain": counts["UNCERTAIN"],
            "dataset_hashes": sorted({r.dataset_hash for r in runs if r.dataset_hash}),
        }

    # Paired statistical tests & Inference Arbitrage vs first selected model (Baseline)
    baseline_id = body.model_ids[0]
    base_stats = per_model[baseline_id]
    paired: dict[str, dict] = {}
    arbitrage: dict[str, dict] = {}
    for cand_id in body.model_ids[1:]:
        cand_stats = per_model[cand_id]
        paired[cand_id] = mcnemar_paired_test(
            latest_case_outcomes.get(baseline_id, {}),
            latest_case_outcomes.get(cand_id, {}),
        )
        arbitrage[cand_id] = compute_arbitrage_roi(
            baseline_cost_per_call=base_stats["avg_cost_per_call_usd"],
            candidate_cost_per_call=cand_stats["avg_cost_per_call_usd"],
            baseline_pass_rate=base_stats["pass_rate"],
            candidate_pass_rate=cand_stats["pass_rate"],
            monthly_calls=body.monthly_calls,
        )

    return {
        "baseline_model_id": baseline_id,
        "models": per_model,
        "paired_vs_baseline": paired,
        "arbitrage_vs_baseline": arbitrage,
    }
