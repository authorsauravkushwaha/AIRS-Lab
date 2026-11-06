"""Non-secret runtime introspection for the Settings page.

Never returns API key material: only whether a key is configured, which
environment variable it lives in, and other runtime facts safe to display.
"""
import os
from pathlib import Path

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.models import AuditEvent, EvaluationRun, SecurityFinding, EvaluationResult, Report
from app.services.audit import log

router = APIRouter(prefix="/api/system", tags=["system"])

VERSION = "1.0.0"


@router.get("/config")
def config(db: Session = Depends(get_db)):
    static_dir = os.environ.get("AEGIS_STATIC_DIR") or str(Path(__file__).resolve().parents[3] / "frontend" / "dist")
    return {
        "service": "aegis-ai-lab",
        "version": VERSION,
        "database": settings.database_url.split(":", 1)[0],  # e.g. "sqlite" — never credentials
        "secret_redaction_enabled": settings.secret_redaction_enabled,
        "openai_key_configured": bool(settings.openai_api_key),
        "openai_key_env": "AEGIS_OPENAI_API_KEY",
        "ollama_base_url": settings.ollama_base_url,
        "frontend_served": Path(static_dir).is_dir(),
        "counts": {
            "runs": db.query(EvaluationRun).count(),
            "results": db.query(EvaluationResult).count(),
            "findings": db.query(SecurityFinding).count(),
            "reports": db.query(Report).count(),
        },
    }


@router.get("/audit")
def audit(limit: int = 30, db: Session = Depends(get_db)):
    limit = max(1, min(limit, 100))
    events = db.query(AuditEvent).order_by(AuditEvent.created_at.desc()).limit(limit).all()
    return [{"id": e.id, "event_type": e.event_type, "entity": e.entity,
             "detail": e.detail, "created_at": e.created_at.isoformat()} for e in events]


@router.delete("/runs")
def clear_runs(db: Session = Depends(get_db)):
    # ORM-level delete so results/findings cascade (bulk SQL delete would orphan them).
    runs = db.query(EvaluationRun).all()
    n = len(runs)
    log(db, "system.runs_cleared", detail=f"deleted_runs={n}")
    for r in runs:
        db.delete(r)
    db.commit()
    return {"deleted_runs": n}
