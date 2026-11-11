"""Tamper-evident cryptographic SHA-256 hash-chained audit log.

Every workspace mutation or evaluation run appends an AuditEvent whose
`entry_hash` commits to `prev_hash`, `seq`, `event_type`, `entity`, `detail`,
and canonical UTC timestamp. Modifying or deleting any historical row breaks
the chain and is caught by `verify_audit_chain()`.
"""

import hashlib
import uuid
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.models import AuditEvent


def _canonical_ts(dt: datetime) -> str:
    if dt.tzinfo is not None:
        dt = dt.astimezone(UTC).replace(tzinfo=None)
    return dt.isoformat(timespec="microseconds")


def _compute_hash(seq: int, prev_hash: str, event_type: str, entity: str, detail: str, ts: str) -> str:
    payload = f"{seq}|{prev_hash}|{event_type}|{entity}|{detail}|{ts}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def log(db: Session, event_type: str, entity: str = "", detail: str = "") -> AuditEvent:
    db.flush()
    last = db.query(AuditEvent).order_by(AuditEvent.seq.desc(), AuditEvent.created_at.desc()).first()
    seq = (last.seq + 1) if (last and last.seq is not None) else 1
    prev_hash = (last.entry_hash or "GENESIS") if last else "GENESIS"
    now = datetime.now(UTC).replace(tzinfo=None)
    ent = (entity or "")[:100]
    det = (detail or "")[:2000]
    ts = _canonical_ts(now)
    entry_hash = _compute_hash(seq, prev_hash, event_type, ent, det, ts)
    ev = AuditEvent(
        id=str(uuid.uuid4()),
        seq=seq,
        event_type=event_type,
        entity=ent,
        detail=det,
        prev_hash=prev_hash,
        entry_hash=entry_hash,
        created_at=now,
    )
    db.add(ev)
    db.flush()
    return ev


def verify_audit_chain(db: Session) -> dict:
    """Verify the entire SHA-256 hash chain from GENESIS to head."""
    events = db.query(AuditEvent).order_by(AuditEvent.seq.asc(), AuditEvent.created_at.asc()).all()
    if not events:
        return {"valid": True, "checked_events": 0, "head_hash": "GENESIS", "broken_at": None}

    expected_prev = "GENESIS"
    for idx, ev in enumerate(events):
        # Legacy v1 rows without hashes are skipped gracefully if at start of chain
        if not ev.entry_hash:
            continue
        ts = _canonical_ts(ev.created_at)
        recomputed = _compute_hash(ev.seq, ev.prev_hash, ev.event_type, ev.entity or "", ev.detail or "", ts)
        if ev.prev_hash != expected_prev or ev.entry_hash != recomputed:
            return {
                "valid": False,
                "checked_events": idx + 1,
                "head_hash": events[-1].entry_hash,
                "broken_at": {
                    "id": ev.id,
                    "seq": ev.seq,
                    "event_type": ev.event_type,
                    "expected_prev_hash": expected_prev,
                    "actual_prev_hash": ev.prev_hash,
                    "expected_entry_hash": recomputed,
                    "actual_entry_hash": ev.entry_hash,
                },
            }
        expected_prev = ev.entry_hash

    return {
        "valid": True,
        "checked_events": len(events),
        "head_hash": expected_prev,
        "broken_at": None,
    }
