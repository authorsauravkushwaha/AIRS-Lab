"""Report & signed reproducible Evidence Bundle (.zip) generation.

Exports are built strictly from persisted evaluation rows — nothing is re-executed.
Every generated artifact is fingerprinted with SHA-256.
"""
import csv
import hashlib
import io
import json
import os
import uuid
import zipfile
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import EvaluationResult, EvaluationRun, ModelConfig, Report, SecurityFinding, TestCase
from app.services.audit import log, verify_audit_chain

router = APIRouter(prefix="/api/reports", tags=["reports"])

def _get_report_dir() -> Path:
    d = Path(os.environ.get("AEGIS_REPORT_DIR", Path(__file__).resolve().parent.parent.parent / "reports_out"))
    d.mkdir(parents=True, exist_ok=True)
    return d


class ReportRequest(BaseModel):
    project_id: str
    run_id: str
    format: str = "json"  # json | csv | pdf | bundle
    title: str = "AEGIS Evaluation Report"


def _collect(run_id: str, title: str, db: Session) -> dict:
    run = db.get(EvaluationRun, run_id)
    if not run:
        raise HTTPException(404, "Run not found")
    model = db.get(ModelConfig, run.model_id)
    case_map = {c.id: c for c in db.query(TestCase).all()}
    results = db.query(EvaluationResult).filter(EvaluationResult.run_id == run_id).all()
    findings = db.query(SecurityFinding).filter(SecurityFinding.run_id == run_id).all()
    audit_chain = verify_audit_chain(db)

    return {
        "title": title or "AEGIS Evaluation Report",
        "run_id": run.id,
        "project_id": run.project_id,
        "model": {
            "id": model.id if model else run.model_id,
            "name": model.name if model else "Unknown",
            "provider": model.provider if model else "unknown",
            "model_id": model.model_id if model else "unknown",
        },
        "kind": run.kind,
        "status": run.status,
        "dataset_hash": run.dataset_hash or "",
        "evaluator_version": run.evaluator_version or "2.0.0",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "audit_chain_integrity": {
            "valid": audit_chain["valid"],
            "checked_events": audit_chain["checked_events"],
            "head_hash": audit_chain["head_hash"],
        },
        "summary": json.loads(run.summary or "{}"),
        "results": [
            {
                "test_case_id": r.test_case_id,
                "case_name": case_map[r.test_case_id].name if r.test_case_id in case_map else "",
                "category": case_map[r.test_case_id].category if r.test_case_id in case_map else "",
                "status": r.status,
                "method": r.method,
                "score": r.score,
                "latency_ms": r.latency_ms,
                "tokens": r.tokens_in + r.tokens_out,
                "est_cost_usd": r.est_cost_usd,
            }
            for r in results
        ],
        "security_findings": [
            {
                "test_name": f.test_name,
                "category": f.category,
                "severity": f.severity,
                "owasp_id": f.owasp_id or "",
                "mitre_atlas_id": f.mitre_atlas_id or "",
                "cwe_id": f.cwe_id or "",
                "outcome": f.outcome,
                "mitigation": f.mitigation,
            }
            for f in findings
        ],
        "compliance_mapping": {
            "frameworks": ["EU AI Act Art. 15 (Accuracy, Robustness & Cybersecurity)", "NIST AI RMF 1.0 (MEASURE)", "OWASP LLM Top 10 (2025)", "MITRE ATLAS"],
            "limitations": (
                "Deterministic & schema checks only; UNCERTAIN results are preserved as evidence and never forced to PASS/FAIL. "
                "Passing fixtures do not constitute a blanket safety certification."
            ),
        },
        "limitations": (
            "Deterministic & schema checks only; UNCERTAIN results are not forced to pass/fail. "
            "Passing tests does not certify the model as secure."
        ),
    }


def _sha256_bytes(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


@router.post("", status_code=201)
def create_report(body: ReportRequest, db: Session = Depends(get_db)):
    report_dir = _get_report_dir()
    data = _collect(body.run_id, body.title, db)
    rid = str(uuid.uuid4())

    if body.format == "json":
        path = report_dir / f"{rid}.json"
        payload = json.dumps(data, indent=2).encode("utf-8")
        path.write_bytes(payload)
    elif body.format == "csv":
        path = report_dir / f"{rid}.csv"
        buf = io.StringIO()
        w = csv.writer(buf)
        w.writerow(["test_case_id", "case_name", "category", "status", "method", "score", "latency_ms", "tokens", "est_cost_usd"])
        for r in data["results"]:
            w.writerow([r["test_case_id"], r["case_name"], r["category"], r["status"], r["method"], r["score"], r["latency_ms"], r["tokens"], r["est_cost_usd"]])
        path.write_bytes(buf.getvalue().encode("utf-8"))
    elif body.format == "pdf":
        from reportlab.lib.pagesizes import A4
        from reportlab.pdfgen import canvas
        path = report_dir / f"{rid}.pdf"
        c = canvas.Canvas(str(path), pagesize=A4)
        c.setFont("Helvetica-Bold", 15)
        c.drawString(45, 805, data["title"][:75])
        c.setFont("Helvetica", 9)
        c.drawString(45, 790, f"AEGIS AI LAB Compliance & Reliability Evidence Dossier · Generated {data['generated_at'][:19]}Z")
        y = 768
        s = data["summary"]
        ci = s.get("wilson_95_ci")
        ci_txt = f" (95% Wilson CI: {ci[0]}%-{ci[1]}%)" if ci else ""
        meta_lines = [
            f"Run ID: {data['run_id']}   Kind: {data['kind']}   Status: {data['status']}",
            f"Model: {data['model']['name']} ({data['model']['provider']} / {data['model']['model_id']})",
            f"Dataset SHA-256: {data['dataset_hash'] or 'n/a (security suite)'}",
            f"Audit Chain Integrity: {'VERIFIED' if data['audit_chain_integrity']['valid'] else 'BROKEN'} (head: {str(data['audit_chain_integrity']['head_hash'])[:24]}...)",
            f"Pass Rate: {s.get('pass_rate')}%{ci_txt}   Fail: {s.get('FAIL', s.get('failures', 0))}   Uncertain: {s.get('UNCERTAIN', 0)}",
            f"Latency Avg/P95: {s.get('avg_latency_ms')} / {s.get('p95_latency_ms')} ms   Tokens: {s.get('total_tokens', 0)}   Est. Cost: ${s.get('est_cost_usd', 0)}",
            f"Governance Note: {data['limitations'][:105]}",
        ]
        for line in meta_lines:
            c.drawString(45, y, line[:115])
            y -= 14

        if data["results"]:
            y -= 8
            c.setFont("Helvetica-Bold", 11)
            c.drawString(45, y, "Case-Level Reliability Evidence")
            y -= 14
            c.setFont("Helvetica", 8.5)
            for r in data["results"][:28]:
                if y < 60:
                    c.showPage()
                    y = 800
                    c.setFont("Helvetica", 8.5)
                c.drawString(45, y, f"{r['status']:10s} {r['method'][:22]:22s} {(r['case_name'] or r['test_case_id'])[:50]:50s} {r['latency_ms']:.0f}ms")
                y -= 12

        if data["security_findings"]:
            y -= 8
            if y < 100:
                c.showPage()
                y = 800
            c.setFont("Helvetica-Bold", 11)
            c.drawString(45, y, "OWASP LLM Top 10 & MITRE ATLAS Security Findings")
            y -= 14
            c.setFont("Helvetica", 8.5)
            for f in data["security_findings"][:25]:
                if y < 60:
                    c.showPage()
                    y = 800
                    c.setFont("Helvetica", 8.5)
                c.drawString(45, y, f"[{f['severity'].upper():8s}] {f['outcome'].upper():9s} {f['owasp_id'][:24]:24s} {f['test_name'][:42]}")
                y -= 12
        c.save()
    elif body.format == "bundle":
        path = report_dir / f"{rid}.airsbundle.zip"
        evidence_bytes = json.dumps(data, indent=2, sort_keys=True).encode("utf-8")
        csv_buf = io.StringIO()
        w = csv.writer(csv_buf)
        w.writerow(["test_case_id", "case_name", "category", "status", "method", "score", "latency_ms", "tokens", "est_cost_usd"])
        for r in data["results"]:
            w.writerow([r["test_case_id"], r["case_name"], r["category"], r["status"], r["method"], r["score"], r["latency_ms"], r["tokens"], r["est_cost_usd"]])
        csv_bytes = csv_buf.getvalue().encode("utf-8")
        verify_md = (
            "# AEGIS AI LAB — Offline Evidence Bundle Verification\n\n"
            f"- Bundle ID: `{rid}`\n"
            f"- Run ID: `{data['run_id']}`\n"
            f"- Dataset SHA-256: `{data['dataset_hash']}`\n"
            f"- Evaluator Version: `{data['evaluator_version']}`\n\n"
            "Verify offline with:\n```bash\npython -m airs_cli verify-bundle <bundle.airsbundle.zip>\n```\n"
        ).encode("utf-8")
        manifest = {
            "bundle_id": rid,
            "format_version": "2.0",
            "run_id": data["run_id"],
            "dataset_hash": data["dataset_hash"],
            "evaluator_version": data["evaluator_version"],
            "generated_at": data["generated_at"],
            "files": {
                "run_evidence.json": _sha256_bytes(evidence_bytes),
                "results.csv": _sha256_bytes(csv_bytes),
                "VERIFY.md": _sha256_bytes(verify_md),
            },
        }
        manifest["bundle_signature_sha256"] = _sha256_bytes(json.dumps(manifest["files"], sort_keys=True).encode("utf-8"))
        with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
            zf.writestr("run_evidence.json", evidence_bytes)
            zf.writestr("results.csv", csv_bytes)
            zf.writestr("VERIFY.md", verify_md)
            zf.writestr("manifest.json", json.dumps(manifest, indent=2).encode("utf-8"))
    else:
        raise HTTPException(400, "Unsupported format")

    digest = _sha256_bytes(path.read_bytes())
    rep = Report(
        id=rid,
        project_id=body.project_id,
        run_id=body.run_id,
        format=body.format,
        title=body.title,
        file_path=str(path),
        sha256_hash=digest,
    )
    db.add(rep)
    log(db, "report.created", entity=rid, detail=f"format={body.format} run={body.run_id} sha256={digest[:12]}")
    db.commit()
    return {"id": rid, "format": body.format, "file": path.name, "sha256_hash": digest}


@router.get("")
def list_reports(project_id: str | None = None, db: Session = Depends(get_db)):
    q = db.query(Report)
    if project_id:
        q = q.filter(Report.project_id == project_id)
    return [
        {
            "id": r.id,
            "project_id": r.project_id,
            "run_id": r.run_id,
            "format": r.format,
            "title": r.title,
            "sha256_hash": r.sha256_hash or "",
            "created_at": r.created_at.isoformat(),
        }
        for r in q.order_by(Report.created_at.desc()).all()
    ]


@router.get("/{report_id}/download")
def download(report_id: str, db: Session = Depends(get_db)):
    r = db.get(Report, report_id)
    if not r:
        raise HTTPException(404, "Report not found")
    path = Path(r.file_path)
    if not path.exists():
        raise HTTPException(404, "Report file missing")
    media = {
        "json": "application/json",
        "csv": "text/csv",
        "pdf": "application/pdf",
        "bundle": "application/zip",
    }.get(r.format, "application/octet-stream")
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
            pass
    log(db, "report.deleted", entity=r.id, detail=f"format={r.format}")
    db.delete(r)
    db.commit()
