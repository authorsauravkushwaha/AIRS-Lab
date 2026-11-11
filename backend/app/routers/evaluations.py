"""Evaluation run endpoints: execute suites concurrently against a model and persist evidence."""

import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import EvaluationResult, EvaluationRun, TestCase
from app.services.audit import log
from app.services.runner import execute_reliability_run

router = APIRouter(prefix="/api/evaluations", tags=["evaluations"])


class RunRequest(BaseModel):
    project_id: str
    suite_id: str
    model_id: str
    repeats: int = Field(default=1, ge=1, le=10)
    concurrency: int = Field(default=4, ge=1, le=16)
    use_cache: bool = False


class RunOut(BaseModel):
    id: str
    project_id: str = ""
    suite_id: str = ""
    model_id: str = ""
    status: str
    kind: str
    dataset_hash: str = ""
    evaluator_version: str = "2.0.0"
    concurrency: int = 1
    summary: dict
    started_at: datetime
    finished_at: datetime | None


def _run_out(r: EvaluationRun) -> RunOut:
    return RunOut(
        id=r.id,
        project_id=r.project_id,
        suite_id=r.suite_id or "",
        model_id=r.model_id,
        status=r.status,
        kind=r.kind,
        dataset_hash=r.dataset_hash or "",
        evaluator_version=r.evaluator_version or "2.0.0",
        concurrency=r.concurrency or 1,
        summary=json.loads(r.summary or "{}"),
        started_at=r.started_at,
        finished_at=r.finished_at,
    )


@router.post("/run", response_model=RunOut, status_code=201)
def run_evaluation(body: RunRequest, db: Session = Depends(get_db)):
    run = execute_reliability_run(
        db,
        project_id=body.project_id,
        suite_id=body.suite_id,
        model_id=body.model_id,
        repeats=body.repeats,
        concurrency=body.concurrency,
        use_cache=body.use_cache,
    )
    return _run_out(run)


@router.get("", response_model=list[RunOut])
def list_runs(
    project_id: str | None = None, kind: str | None = None, status: str | None = None, db: Session = Depends(get_db)
):
    q = db.query(EvaluationRun)
    if project_id:
        q = q.filter(EvaluationRun.project_id == project_id)
    if kind:
        q = q.filter(EvaluationRun.kind == kind)
    if status:
        q = q.filter(EvaluationRun.status == status)
    runs = q.order_by(EvaluationRun.started_at.desc()).limit(100).all()
    return [_run_out(r) for r in runs]


@router.get("/{run_id}", response_model=RunOut)
def get_run(run_id: str, db: Session = Depends(get_db)):
    r = db.get(EvaluationRun, run_id)
    if not r:
        raise HTTPException(404, "Run not found")
    return _run_out(r)


@router.delete("/{run_id}", status_code=204)
def delete_run(run_id: str, db: Session = Depends(get_db)):
    r = db.get(EvaluationRun, run_id)
    if not r:
        raise HTTPException(404, "Run not found")
    log(db, "evaluation.deleted", entity=r.id, detail=f"kind={r.kind}")
    db.delete(r)
    db.commit()


@router.get("/{run_id}/results")
def get_results(run_id: str, status: str | None = None, db: Session = Depends(get_db)):
    if not db.get(EvaluationRun, run_id):
        raise HTTPException(404, "Run not found")
    q = db.query(EvaluationResult, TestCase).join(TestCase, EvaluationResult.test_case_id == TestCase.id)
    q = q.filter(EvaluationResult.run_id == run_id)
    if status:
        q = q.filter(EvaluationResult.status == status)
    return [
        {
            "id": r.id,
            "test_case_id": r.test_case_id,
            "case_name": c.name,
            "case_category": c.category,
            "case_severity": c.severity,
            "prompt": c.prompt,
            "reference_answer": c.reference_answer,
            "status": r.status,
            "method": r.method,
            "score": r.score,
            "response": r.response,
            "evidence": json.loads(r.evidence or "{}"),
            "latency_ms": r.latency_ms,
            "ttft_ms": r.ttft_ms or 0.0,
            "tokens_in": r.tokens_in,
            "tokens_out": r.tokens_out,
            "est_cost_usd": r.est_cost_usd,
            "cached": bool(r.cached),
        }
        for r, c in q.all()
    ]
