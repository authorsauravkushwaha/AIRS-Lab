"""Production Trace Flywheel: automatic DLP PII/secret redaction on ingest + 1-click promote to TestCase."""

import json
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import ProductionTrace, Project, TestCase, TestSuite
from app.services.audit import log
from app.services.redaction import redact_text

router = APIRouter(prefix="/api/traces", tags=["traces"])


class TraceIn(BaseModel):
    project_id: str
    model_name: str = "production-agent"
    prompt: str = Field(min_length=1)
    response: str = ""
    expected_answer_hint: str = ""
    flagged_reason: str = "user_thumbs_down"
    latency_ms: float = 0.0
    tokens_in: int = 0
    tokens_out: int = 0


class PromoteIn(BaseModel):
    suite_id: str
    name: str | None = None
    category: str = "factual_accuracy"
    severity: str = Field(default="high", pattern="^(low|medium|high|critical)$")
    reference_answer: str = ""
    expected_keywords: list[str] = []


def _out(t: ProductionTrace) -> dict:
    return {
        "id": t.id,
        "project_id": t.project_id,
        "model_name": t.model_name,
        "prompt_redacted": t.prompt_redacted,
        "response_redacted": t.response_redacted,
        "expected_answer_hint": t.expected_answer_hint,
        "flagged_reason": t.flagged_reason,
        "redactions_applied": json.loads(t.redactions_applied or "[]"),
        "latency_ms": t.latency_ms,
        "tokens_in": t.tokens_in,
        "tokens_out": t.tokens_out,
        "promoted_case_id": t.promoted_case_id or "",
        "created_at": t.created_at.isoformat(),
    }


@router.post("", status_code=201)
def ingest_trace(body: TraceIn, db: Session = Depends(get_db)):
    if not db.get(Project, body.project_id):
        raise HTTPException(404, "Project not found")
    p_clean, p_red = redact_text(body.prompt)
    r_clean, r_red = redact_text(body.response)
    all_red = sorted(set(p_red + r_red))
    t = ProductionTrace(
        id=str(uuid.uuid4()),
        project_id=body.project_id,
        model_name=body.model_name,
        prompt_redacted=p_clean,
        response_redacted=r_clean,
        expected_answer_hint=body.expected_answer_hint,
        flagged_reason=body.flagged_reason,
        redactions_applied=json.dumps(all_red),
        latency_ms=body.latency_ms,
        tokens_in=body.tokens_in,
        tokens_out=body.tokens_out,
    )
    db.add(t)
    log(db, "trace.ingested", entity=t.id, detail=f"reason={t.flagged_reason} redacted={all_red}")
    db.commit()
    db.refresh(t)
    return _out(t)


@router.get("")
def list_traces(project_id: str | None = None, db: Session = Depends(get_db)):
    q = db.query(ProductionTrace)
    if project_id:
        q = q.filter(ProductionTrace.project_id == project_id)
    return [_out(t) for t in q.order_by(ProductionTrace.created_at.desc()).limit(200).all()]


@router.post("/{trace_id}/promote", status_code=201)
def promote_trace(trace_id: str, body: PromoteIn, db: Session = Depends(get_db)):
    t = db.get(ProductionTrace, trace_id)
    if not t:
        raise HTTPException(404, "Trace not found")
    suite = db.get(TestSuite, body.suite_id)
    if not suite:
        raise HTTPException(404, "Suite not found")

    ref = body.reference_answer or t.expected_answer_hint
    case = TestCase(
        id=str(uuid.uuid4()),
        suite_id=suite.id,
        name=body.name or f"[Prod Regression] {t.flagged_reason}: {t.prompt_redacted[:48]}",
        category=body.category,
        prompt=t.prompt_redacted,
        reference_answer=ref,
        expected_keywords=json.dumps(body.expected_keywords),
        source_docs="[]",
        expected_schema="",
        tools_config="",
        expected_behavior="Promoted from sanitized production trace.",
        severity=body.severity,
        evaluation_criteria=f"Prevent recurrence of production failure ({t.flagged_reason}).",
    )
    db.add(case)
    db.flush()
    t.promoted_case_id = case.id
    log(db, "trace.promoted", entity=case.id, detail=f"trace={t.id} suite={suite.name}")
    db.commit()
    return {"trace_id": t.id, "case_id": case.id, "suite_id": suite.id}


@router.delete("/{trace_id}", status_code=204)
def delete_trace(trace_id: str, db: Session = Depends(get_db)):
    t = db.get(ProductionTrace, trace_id)
    if not t:
        raise HTTPException(404, "Trace not found")
    log(db, "trace.deleted", entity=t.id, detail=t.flagged_reason)
    db.delete(t)
    db.commit()
