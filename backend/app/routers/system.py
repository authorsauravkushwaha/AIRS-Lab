"""Non-secret runtime introspection & cryptographic audit-chain verifier."""

import os
from pathlib import Path

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.config import EVALUATOR_VERSION, settings
from app.db import get_db
from app.models import (
    AuditEvent,
    EvaluationResult,
    EvaluationRun,
    ProductionTrace,
    ReleaseGate,
    Report,
    ResponseCache,
    SecurityFinding,
)
from app.services.audit import log, verify_audit_chain

router = APIRouter(prefix="/api/system", tags=["system"])

VERSION = "2.1.0"


@router.get("/config")
def config(db: Session = Depends(get_db)):
    static_dir = os.environ.get("AEGIS_STATIC_DIR") or str(Path(__file__).resolve().parents[3] / "frontend" / "dist")
    chain = verify_audit_chain(db)
    return {
        "service": "aegis-ai-lab",
        "version": VERSION,
        "evaluator_version": EVALUATOR_VERSION,
        "database": settings.database_url.split(":", 1)[0],
        "secret_redaction_enabled": settings.secret_redaction_enabled,
        "openai_key_configured": bool(settings.openai_api_key),
        "openai_key_env": "AEGIS_OPENAI_API_KEY",
        "anthropic_key_configured": bool(settings.anthropic_api_key),
        "anthropic_key_env": "AEGIS_ANTHROPIC_API_KEY",
        "ollama_base_url": settings.ollama_base_url,
        "frontend_served": Path(static_dir).is_dir(),
        "audit_chain": chain,
        "counts": {
            "runs": db.query(EvaluationRun).count(),
            "results": db.query(EvaluationResult).count(),
            "findings": db.query(SecurityFinding).count(),
            "reports": db.query(Report).count(),
            "gates": db.query(ReleaseGate).count(),
            "traces": db.query(ProductionTrace).count(),
            "cached_responses": db.query(ResponseCache).count(),
        },
    }


@router.get("/audit")
def audit(limit: int = 30, db: Session = Depends(get_db)):
    limit = max(1, min(limit, 100))
    events = db.query(AuditEvent).order_by(AuditEvent.seq.desc(), AuditEvent.created_at.desc()).limit(limit).all()
    return [
        {
            "id": e.id,
            "seq": e.seq or 0,
            "event_type": e.event_type,
            "entity": e.entity,
            "detail": e.detail,
            "prev_hash": e.prev_hash or "",
            "entry_hash": e.entry_hash or "",
            "created_at": e.created_at.isoformat(),
        }
        for e in events
    ]


@router.get("/audit/verify")
def verify_audit(db: Session = Depends(get_db)):
    return verify_audit_chain(db)


@router.delete("/cache")
def clear_cache(db: Session = Depends(get_db)):
    n = db.query(ResponseCache).delete()
    log(db, "system.cache_cleared", detail=f"deleted_entries={n}")
    db.commit()
    return {"deleted_entries": n}


@router.delete("/runs")
def clear_runs(db: Session = Depends(get_db)):
    runs = db.query(EvaluationRun).all()
    n = len(runs)
    log(db, "system.runs_cleared", detail=f"deleted_runs={n}")
    for r in runs:
        db.delete(r)
    db.commit()
    return {"deleted_runs": n}
