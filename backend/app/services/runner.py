"""Shared execution path for evaluation runs.

Extracted from the router so the HTTP layer and the first-run seeder execute
the *same* code — a seeded run is a real engine execution over the mock
provider, not a fabricated row.
"""
import json
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import EvaluationResult, EvaluationRun, ModelConfig, TestCase, TestSuite
from app.providers import get_provider
from app.providers.base import ProviderError
from app.services import evaluation_engine as eng
from app.services.audit import log


def summary_for(results: list[EvaluationResult]) -> dict:
    counts = {"PASS": 0, "FAIL": 0, "UNCERTAIN": 0, "ERROR": 0, "NOT RUN": 0}
    for r in results:
        counts[r.status] = counts.get(r.status, 0) + 1
    done = counts["PASS"] + counts["FAIL"] + counts["UNCERTAIN"]
    lat = sorted(r.latency_ms for r in results if r.latency_ms)
    return {
        **counts,
        "pass_rate": round(counts["PASS"] / done * 100, 1) if done else None,
        "avg_latency_ms": round(sum(lat) / len(lat), 1) if lat else None,
        "total_tokens": sum(r.tokens_in + r.tokens_out for r in results),
        "est_cost_usd": round(sum(r.est_cost_usd for r in results), 6),
    }


def execute_reliability_run(db: Session, *, project_id: str, suite_id: str,
                            model_id: str, repeats: int = 1) -> EvaluationRun:
    suite = db.get(TestSuite, suite_id)
    model = db.get(ModelConfig, model_id)
    if not suite or suite.project_id != project_id:
        raise HTTPException(404, "Suite not found in this project")
    if not model or model.project_id != project_id:
        raise HTTPException(404, "Model not found in this project")
    if not model.enabled:
        raise HTTPException(400, "Model configuration is disabled")

    run = EvaluationRun(
        id=str(uuid.uuid4()), project_id=project_id, suite_id=suite_id,
        model_id=model_id, kind="reliability", status="running",
    )
    db.add(run)
    db.commit()

    try:
        provider = get_provider(model)
    except ProviderError as e:
        run.status = "error"
        run.finished_at = datetime.now(timezone.utc)
        run.summary = json.dumps({"error": str(e)})
        db.commit()
        db.refresh(run)
        return run

    cases = db.query(TestCase).filter(TestCase.suite_id == suite_id).all()
    for case in cases:
        try:
            if case.category == "consistency":
                resps = [provider.generate(case.prompt) for _ in range(repeats)]
                chk = eng.consistency_check(case, resps)
                resp = resps[-1]
            else:
                resp = provider.generate(case.prompt)
                chk = eng.evaluate_case(case, resp)
        except ProviderError as e:
            chk, resp = eng.CheckResult("ERROR", "provider-error", 0.0, str(e)), eng.ModelResponse(text=str(e))
        db.add(EvaluationResult(
            id=str(uuid.uuid4()), run_id=run.id, test_case_id=case.id, status=chk.status,
            method=chk.method, score=chk.score, response=resp.text,
            evidence=json.dumps(chk.evidence), latency_ms=resp.latency_ms,
            tokens_in=resp.tokens_in, tokens_out=resp.tokens_out,
        ))
    db.commit()

    results = db.query(EvaluationResult).filter(EvaluationResult.run_id == run.id).all()
    run.status = "completed"
    run.finished_at = datetime.now(timezone.utc)
    run.summary = json.dumps(summary_for(results))
    log(db, "evaluation.completed", entity=run.id,
        detail=f"model={model.name} suite={suite.name} pass_rate={summary_for(results)['pass_rate']}")
    db.commit()
    db.refresh(run)
    return run


def execute_security_run(db: Session, *, project_id: str, model_id: str) -> tuple[EvaluationRun, int]:
    """Run the defensive security suite; returns (run, findings_count)."""
    import json as _json
    from app.models import SecurityFinding
    from app.services import security_lab

    model = db.get(ModelConfig, model_id)
    if not model or model.project_id != project_id:
        raise HTTPException(404, "Model not found in this project")

    run = EvaluationRun(id=str(uuid.uuid4()), project_id=project_id, suite_id="",
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
            outcome=f.outcome, evidence=_json.dumps(f.evidence), mitigation=f.mitigation,
        ))
    run.status = "completed"
    run.finished_at = datetime.now(timezone.utc)
    sev_counts = {s: 0 for s in security_lab.SEVERITY_ORDER}
    for f in findings:
        sev_counts[f.severity] = sev_counts.get(f.severity, 0) + 1
    failures = sum(1 for f in findings if f.outcome == "fail")
    run.summary = _json.dumps({"findings": len(findings), "by_severity": sev_counts,
                               "failures": failures})
    log(db, "security.completed", entity=run.id,
        detail=f"model={model.name} findings={len(findings)} failures={failures}")
    db.commit()
    db.refresh(run)
    return run, len(findings)
