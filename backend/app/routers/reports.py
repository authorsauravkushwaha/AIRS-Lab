"""Report generation — exports are built only from stored evaluation data."""
import csv
import io
import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import EvaluationResult, EvaluationRun, Report, SecurityFinding
from app.services.audit import log

router = APIRouter(prefix="/api/reports", tags=["reports"])

REPORT_DIR = Path(os.environ.get("AEGIS_REPORT_DIR", Path(__file__).resolve().parent.parent.parent / "reports_out"))
REPORT_DIR.mkdir(parents=True, exist_ok=True)


class ReportRequest(BaseModel):
    project_id: str
    run_id: str
    format: str = "json"  # json | csv | pdf
    title: str = "AEGIS Evaluation Report"


def _collect(run_id: str, db: Session) -> dict:
    run = db.get(EvaluationRun, run_id)
    if not run:
        raise HTTPException(404, "Run not found")
    results = db.query(EvaluationResult).filter(EvaluationResult.run_id == run_id).all()
    findings = db.query(SecurityFinding).filter(SecurityFinding.run_id == run_id).all()
    return {
        "title": "AEGIS Evaluation Report",
        "run_id": run.id, "kind": run.kind, "status": run.status,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "summary": json.loads(run.summary or "{}"),
        "results": [{"test_case_id": r.test_case_id, "status": r.status, "method": r.method,
                     "score": r.score, "latency_ms": r.latency_ms,
                     "tokens": r.tokens_in + r.tokens_out} for r in results],
        "security_findings": [{"test_name": f.test_name, "category": f.category, "severity": f.severity,
                               "outcome": f.outcome, "mitigation": f.mitigation} for f in findings],
        "limitations": "Rule-based checks only; UNCERTAIN results are not forced to pass/fail. "
                        "Passing tests does not certify the model as secure.",
    }


@router.post("", status_code=201)
def create_report(body: ReportRequest, db: Session = Depends(get_db)):
    data = _collect(body.run_id, db)
    rid = str(uuid.uuid4())
    if body.format == "json":
        path = REPORT_DIR / f"{rid}.json"
        path.write_text(json.dumps(data, indent=2))
    elif body.format == "csv":
        path = REPORT_DIR / f"{rid}.csv"
        buf = io.StringIO()
        w = csv.writer(buf)
        w.writerow(["test_case_id", "status", "method", "score", "latency_ms", "tokens"])
        for r in data["results"]:
            w.writerow([r["test_case_id"], r["status"], r["method"], r["score"], r["latency_ms"], r["tokens"]])
        path.write_text(buf.getvalue())
    elif body.format == "pdf":
        from reportlab.lib.pagesizes import A4
        from reportlab.pdfgen import canvas
        path = REPORT_DIR / f"{rid}.pdf"
        c = canvas.Canvas(str(path), pagesize=A4)
        c.setFont("Helvetica-Bold", 16)
        c.drawString(50, 800, data["title"])
        c.setFont("Helvetica", 10)
        y = 770
        s = data["summary"]
        for line in [f"Run: {data['run_id']}", f"Status: {data['status']}",
                     f"Pass rate: {s.get('pass_rate')}%  Fail: {s.get('FAIL', 0)}  Uncertain: {s.get('UNCERTAIN', 0)}",
                     f"Avg latency: {s.get('avg_latency_ms')} ms  Tokens: {s.get('total_tokens')}",
                     "", data["limitations"]]:
            c.drawString(50, y, line[:110]); y -= 16
        y -= 10
        c.setFont("Helvetica-Bold", 12); c.drawString(50, y, "Results"); y -= 16
        c.setFont("Helvetica", 9)
        for r in data["results"][:40]:
            c.drawString(50, y, f"{r['status']:10s} {r['method']:24s} {r['test_case_id'][:8]}"); y -= 13
        c.save()
    else:
        raise HTTPException(400, "Unsupported format")
    rep = Report(id=rid, project_id=body.project_id, run_id=body.run_id, format=body.format,
                 title=body.title, file_path=str(path))
    db.add(rep)
    log(db, "report.created", entity=rid, detail=f"format={body.format} run={body.run_id}")
    db.commit()
    return {"id": rid, "format": body.format, "file": path.name}


@router.get("")
def list_reports(project_id: str | None = None, db: Session = Depends(get_db)):
    q = db.query(Report)
    if project_id:
        q = q.filter(Report.project_id == project_id)
    return [{"id": r.id, "project_id": r.project_id, "run_id": r.run_id, "format": r.format,
             "title": r.title, "created_at": r.created_at.isoformat()} for r in q.order_by(Report.created_at.desc()).all()]


@router.get("/{report_id}/download")
def download(report_id: str, db: Session = Depends(get_db)):
    r = db.get(Report, report_id)
    if not r:
        raise HTTPException(404, "Report not found")
    path = Path(r.file_path)
    if not path.exists():
        raise HTTPException(404, "Report file missing")
    media = {"json": "application/json", "csv": "text/csv", "pdf": "application/pdf"}[r.format]
    return FileResponse(path, media_type=media, filename=path.name)


@router.delete("/{report_id}", status_code=204)
def delete_report(report_id: str, db: Session = Depends(get_db)):
    r = db.get(Report, report_id)
    if not r:
        raise HTTPException(404, "Report not found")
    path = Path(r.file_path)
    if path.exists():
        try:
            path.unlink()
        except OSError:
            pass  # row removal still proceeds; orphaned file is harmless in reports_out/
    log(db, "report.deleted", entity=r.id, detail=f"format={r.format}")
    db.delete(r)
    db.commit()
