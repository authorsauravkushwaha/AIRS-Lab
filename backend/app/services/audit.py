"""Append-only audit log for workspace activity.

Written from routers/services whenever the workspace changes or evidence is
produced. Never stores secrets — only entity references and short details.
"""
import uuid

from sqlalchemy.orm import Session

from app.models import AuditEvent


def log(db: Session, event_type: str, entity: str = "", detail: str = "") -> None:
    db.add(AuditEvent(id=str(uuid.uuid4()), event_type=event_type,
                      entity=entity[:100], detail=detail[:2000]))
