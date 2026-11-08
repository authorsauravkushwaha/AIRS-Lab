"""Shared concurrent execution path for reliability and security runs.

Supports configurable worker concurrency, content-addressed response caching,
live token cost pricing, SHA-256 dataset fingerprinting, and Wilson 95% CIs.
"""
import hashlib
import json
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.config import EVALUATOR_VERSION
from app.models import EvaluationResult, EvaluationRun, ModelConfig, ResponseCache, TestCase, TestSuite
from app.providers import get_provider
from app.providers.base import ModelResponse, ProviderError
from app.services import evaluation_engine as eng
from app.services.audit import log
from app.services.domain_packs import compute_suite_hash
from app.services.pricing import estimate_cost_usd


def _percentile(sorted_vals: list[float], pct: float) -> float | None:
    if not sorted_vals:
        return None
    idx = min(len(sorted_vals) - 1, max(0, int(round((pct / 100.0) * (len(sorted_vals) - 1)))))
    return round(sorted_vals[idx], 1)


def summary_for(results: list[EvaluationResult], *, dataset_hash: str = "") -> dict:
    counts = {"PASS": 0, "FAIL": 0, "UNCERTAIN": 0, "ERROR": 0, "NOT RUN": 0}
    for r in results:
        counts[r.status] = counts.get(r.status, 0) + 1
    done = counts["PASS"] + counts["FAIL"] + counts["UNCERTAIN"]
    lat = sorted(r.latency_ms for r in results if r.latency_ms)
    ttfts = [r.ttft_ms for r in results if r.ttft_ms]
    total_cost = round(sum(r.est_cost_usd for r in results), 8)
    cppt = round(total_cost / counts["PASS"], 8) if counts["PASS"] > 0 and total_cost > 0 else None
    return {
        **counts,
        "pass_rate": round(counts["PASS"] / done * 100, 1) if done else None,
        "wilson_95_ci": eng.wilson_interval(counts["PASS"], done),
        "avg_latency_ms": round(sum(lat) / len(lat), 1) if lat else None,
        "p50_latency_ms": _percentile(lat, 50),
        "p95_latency_ms": _percentile(lat, 95),
        "avg_ttft_ms": round(sum(ttfts) / len(ttfts), 1) if ttfts else None,
        "total_tokens": sum(r.tokens_in + r.tokens_out for r in results),
        "est_cost_usd": total_cost,
        "cost_per_verified_pass_usd": cppt,
        "cache_hits": sum(1 for r in results if r.cached),
        "dataset_hash": dataset_hash,
        "evaluator_version": EVALUATOR_VERSION,
    }


def _cache_key_for(model: ModelConfig, case: TestCase) -> str:
    raw = json.dumps(
        {
            "provider": model.provider,
            "model_id": model.model_id,
            "system_prompt": model.system_prompt or "",
            "temperature": model.temperature or 0.0,
            "prompt": case.prompt,
            "tools_config": case.tools_config or "",
        },
        sort_keys=True,
    )
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def execute_reliability_run(
    db: Session,
    *,
    project_id: str,
    suite_id: str,
    model_id: str,
    repeats: int = 1,
    concurrency: int = 4,
    use_cache: bool = False,
) -> EvaluationRun:
    suite = db.get(TestSuite, suite_id)
    model = db.get(ModelConfig, model_id)
    if not suite or suite.project_id != project_id:
        raise HTTPException(404, "Suite not found in this project")
    if not model or model.project_id != project_id:
        raise HTTPException(404, "Model not found in this project")
    if not model.enabled:
        raise HTTPException(400, "Model configuration is disabled")

    cases = db.query(TestCase).filter(TestCase.suite_id == suite_id).all()
    ds_hash = compute_suite_hash(cases)
    eff_concurrency = max(1, min(16, concurrency))

    run = EvaluationRun(
        id=str(uuid.uuid4()),
        project_id=project_id,
        suite_id=suite_id,
        model_id=model_id,
        kind="reliability",
        status="running",
        dataset_hash=ds_hash,
        evaluator_version=EVALUATOR_VERSION,
        concurrency=eff_concurrency,
    )
    db.add(run)
    db.commit()

    try:
        provider = get_provider(model)
    except ProviderError as e:
        run.status = "error"
        run.finished_at = datetime.now(timezone.utc)
        run.summary = json.dumps({"error": str(e), "dataset_hash": ds_hash})
        db.commit()
        db.refresh(run)
        return run

    # Preload cached responses on main thread if caching is enabled
    cached_map: dict[str, ModelResponse] = {}
    if use_cache and cases:
        for case in cases:
            if case.category != "consistency":
                ck = _cache_key_for(model, case)
                row = db.get(ResponseCache, ck)
                if row:
                    payload = json.loads(row.response_json)
                    cached_map[case.id] = ModelResponse(
                        text=payload["text"],
                        tokens_in=payload.get("tokens_in", 0),
                        tokens_out=payload.get("tokens_out", 0),
                        latency_ms=0.2,
                        ttft_ms=0.1,
                        tool_calls=payload.get("tool_calls") or [],
                        raw=payload.get("raw") or {},
                    )

    def _eval_one(case: TestCase) -> tuple[TestCase, eng.CheckResult, ModelResponse, bool]:
        try:
            if case.category == "consistency":
                eff_repeats = max(2, repeats) if repeats > 1 else 2
                resps = [provider.generate(case.prompt) for _ in range(eff_repeats)]
                chk = eng.consistency_check(case, resps) if repeats >= 2 else eng.consistency_check(case, resps[:1])
                resp = resps[-1]
                return case, chk, resp, False
            if case.id in cached_map:
                resp = cached_map[case.id]
                chk = eng.evaluate_case(case, resp)
                return case, chk, resp, True
            resp = provider.generate(case.prompt)
            chk = eng.evaluate_case(case, resp)
            return case, chk, resp, False
        except ProviderError as e:
            return case, eng.CheckResult("ERROR", "provider-error", 0.0, str(e)), ModelResponse(text=str(e)), False

    if eff_concurrency > 1 and len(cases) > 1:
        with ThreadPoolExecutor(max_workers=min(eff_concurrency, len(cases))) as pool:
            evaluated = list(pool.map(_eval_one, cases))
    else:
        evaluated = [_eval_one(c) for c in cases]

    for case, chk, resp, was_cached in evaluated:
        cost = 0.0 if was_cached else estimate_cost_usd(model, resp.tokens_in, resp.tokens_out)
        if use_cache and not was_cached and chk.status != "ERROR" and case.category != "consistency":
            ck = _cache_key_for(model, case)
            if not db.get(ResponseCache, ck):
                db.add(ResponseCache(
                    cache_key=ck,
                    provider=model.provider,
                    model_id=model.model_id,
                    response_json=json.dumps({
                        "text": resp.text,
                        "tokens_in": resp.tokens_in,
                        "tokens_out": resp.tokens_out,
                        "tool_calls": resp.tool_calls,
                        "raw": resp.raw,
                    }),
                ))
        db.add(EvaluationResult(
            id=str(uuid.uuid4()),
            run_id=run.id,
            test_case_id=case.id,
            status=chk.status,
            method=chk.method,
            score=chk.score,
            response=resp.text,
            evidence=json.dumps(chk.evidence),
            latency_ms=resp.latency_ms,
            ttft_ms=resp.ttft_ms,
            tokens_in=resp.tokens_in,
            tokens_out=resp.tokens_out,
            est_cost_usd=cost,
            cached=was_cached,
        ))
    db.commit()

    results = db.query(EvaluationResult).filter(EvaluationResult.run_id == run.id).all()
    summary = summary_for(results, dataset_hash=ds_hash)
    run.status = "completed"
    run.finished_at = datetime.now(timezone.utc)
    run.summary = json.dumps(summary)
    log(db, "evaluation.completed", entity=run.id,
        detail=f"model={model.name} suite={suite.name} pass_rate={summary['pass_rate']} hash={ds_hash[:12]}")
    db.commit()
    db.refresh(run)
    return run


def execute_security_run(db: Session, *, project_id: str, model_id: str) -> tuple[EvaluationRun, int]:
    """Run the defensive & adversarial security suite; returns (run, findings_count)."""
    from app.models import SecurityFinding
    from app.services import security_lab

    model = db.get(ModelConfig, model_id)
    if not model or model.project_id != project_id:
        raise HTTPException(404, "Model not found in this project")

    run = EvaluationRun(
        id=str(uuid.uuid4()),
        project_id=project_id,
        suite_id="",
        model_id=model.id,
        kind="security",
        status="running",
        evaluator_version=EVALUATOR_VERSION,
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
        return run, 0

    findings = security_lab.run_security_suite(provider.generate)
    owasp_counts: dict[str, int] = {}
    for f in findings:
        if f.owasp_id:
            owasp_counts[f.owasp_id] = owasp_counts.get(f.owasp_id, 0) + 1
        db.add(SecurityFinding(
            id=str(uuid.uuid4()),
            run_id=run.id,
            test_name=f.test_name,
            category=f.category,
            severity=f.severity,
            owasp_id=f.owasp_id,
            mitre_atlas_id=f.mitre_atlas_id,
            cwe_id=f.cwe_id,
            test_input=f.test_input,
            model_response=f.model_response,
            expected_behavior=f.expected_behavior,
            actual_behavior=f.actual_behavior,
            outcome=f.outcome,
            evidence=json.dumps(f.evidence),
            mitigation=f.mitigation,
        ))
    run.status = "completed"
    run.finished_at = datetime.now(timezone.utc)
    sev_counts = {s: 0 for s in security_lab.SEVERITY_ORDER}
    for f in findings:
        sev_counts[f.severity] = sev_counts.get(f.severity, 0) + 1
    failures = sum(1 for f in findings if f.outcome == "fail")
    run.summary = json.dumps({
        "findings": len(findings),
        "by_severity": sev_counts,
        "by_owasp": owasp_counts,
        "failures": failures,
        "evaluator_version": EVALUATOR_VERSION,
    })
    log(db, "security.completed", entity=run.id,
        detail=f"model={model.name} findings={len(findings)} failures={failures}")
    db.commit()
    db.refresh(run)
    return run, len(findings)
