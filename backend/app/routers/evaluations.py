"""Evaluation run endpoints: execute suites against a model and persist results."""
import json
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import EvaluationResult, EvaluationRun, ModelConfig, TestCase, TestSuite
from app.providers import get_provider
from app.providers.base import ProviderError
from app.services import evaluation_engine as eng

router = APIRouter(prefix="/api/evaluations", tags=["evaluations"])


class RunRequest(BaseModel):
    project_id: str
    suite_id: str
    model_id: str
    repeats: int = Field(default=1, ge=1, le=10)  # for consistency testing


class RunOut(BaseModel):
    id: str
    status: str
    kind: str
    summary: dict
    started_at: datetime
    finished_at: datetime | None


def _summary(results: list[EvaluationResult]) -> dict:
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


@router.post("/run", response_model=RunOut, status_code=201)
def run_evaluation(body: RunRequest, db: Session = Depends(get_db)):
    suite = db.get(TestSuite, body.suite_id)
    model = db.get(ModelConfig, body.model_id)
    if not suite or suite.project_id != body.project_id:
        raise HTTPException(404, "Suite not found in this project")
    if not model or model.project_id != body.project_id:
        raise HTTPException(404, "Model not found in this project")
    if not model.enabled:
        raise HTTPException(400, "Model configuration is disabled")

    run = EvaluationRun(
        id=str(uuid.uuid4()), project_id=body.project_id, suite_id=body.suite_id,
        model_id=body.model_id, kind="reliability", status="running",
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
        return RunOut(id=run.id, status=run.status, kind=run.kind, summary={"error": str(e)},
                      started_at=run.started_at, finished_at=run.finished_at)

    cases = db.query(TestCase).filter(TestCase.suite_id == body.suite_id).all()
    for case in cases:
        try:
            if case.category == "consistency":
                resps = [provider.generate(case.prompt) for _ in range(body.repeats)]
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
    run.summary = json.dumps(_summary(results))
    db.commit()
    db.refresh(run)
    return RunOut(id=run.id, status=run.status, kind=run.kind, summary=json.loads(run.summary),
                  started_at=run.started_at, finished_at=run.finished_at)


@router.get("", response_model=list[RunOut])
def list_runs(project_id: str | None = None, db: Session = Depends(get_db)):
    q = db.query(EvaluationRun)
    if project_id:
        q = q.filter(EvaluationRun.project_id == project_id)
    runs = q.order_by(EvaluationRun.started_at.desc()).limit(100).all()
    return [RunOut(id=r.id, status=r.status, kind=r.kind, summary=json.loads(r.summary or "{}"),
                   started_at=r.started_at, finished_at=r.finished_at) for r in runs]


@router.get("/{run_id}", response_model=RunOut)
def get_run(run_id: str, db: Session = Depends(get_db)):
    r = db.get(EvaluationRun, run_id)
    if not r:
        raise HTTPException(404, "Run not found")
    return RunOut(id=r.id, status=r.status, kind=r.kind, summary=json.loads(r.summary or "{}"),
                  started_at=r.started_at, finished_at=r.finished_at)


@router.get("/{run_id}/results")
def get_results(run_id: str, status: str | None = None, db: Session = Depends(get_db)):
    if not db.get(EvaluationRun, run_id):
        raise HTTPException(404, "Run not found")
    q = db.query(EvaluationResult).filter(EvaluationResult.run_id == run_id)
    if status:
        q = q.filter(EvaluationResult.status == status)
    return [
        {"id": r.id, "test_case_id": r.test_case_id, "status": r.status, "method": r.method,
         "score": r.score, "response": r.response, "evidence": json.loads(r.evidence or "{}"),
         "latency_ms": r.latency_ms, "tokens_in": r.tokens_in, "tokens_out": r.tokens_out,
         "est_cost_usd": r.est_cost_usd}
        for r in q.all()
    ]
