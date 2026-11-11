"""Test suite CRUD, SHA-256 dataset fingerprinting, and 1-click Domain Pack installer."""

import json
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Project, TestCase, TestSuite
from app.schemas import InstallPackIn, SuiteIn, SuiteOut, SuiteUpdate
from app.services.audit import log
from app.services.domain_packs import DOMAIN_PACKS, compute_suite_hash

router = APIRouter(prefix="/api/test-suites", tags=["test-suites"])


def _out(s: TestSuite) -> SuiteOut:
    return SuiteOut(
        id=s.id,
        project_id=s.project_id,
        name=s.name,
        description=s.description,
        domain_pack=s.domain_pack or "",
        dataset_hash=compute_suite_hash(s.cases),
        case_count=len(s.cases),
        created_at=s.created_at,
    )


@router.get("/templates")
def list_templates():
    return [
        {
            "id": p["id"],
            "name": p["name"],
            "audience": p["audience"],
            "description": p["description"],
            "case_count": len(p["cases"]),
            "categories": sorted({c["category"] for c in p["cases"]}),
        }
        for p in DOMAIN_PACKS.values()
    ]


@router.post("/install-template", response_model=SuiteOut, status_code=201)
def install_template(body: InstallPackIn, db: Session = Depends(get_db)):
    if not db.get(Project, body.project_id):
        raise HTTPException(404, "Project not found")
    pack = DOMAIN_PACKS.get(body.pack_id)
    if not pack:
        raise HTTPException(404, f"Unknown domain pack: {body.pack_id}")

    suite = TestSuite(
        id=str(uuid.uuid4()),
        project_id=body.project_id,
        name=pack["name"],
        description=pack["description"],
        domain_pack=pack["id"],
    )
    db.add(suite)
    db.flush()
    for c in pack["cases"]:
        db.add(
            TestCase(
                id=str(uuid.uuid4()),
                suite_id=suite.id,
                name=c["name"],
                category=c["category"],
                prompt=c["prompt"],
                reference_answer=c.get("reference_answer", ""),
                expected_keywords=json.dumps(c.get("expected_keywords", [])),
                source_docs=json.dumps(c.get("source_docs", [])),
                expected_schema=json.dumps(c["expected_schema"]) if c.get("expected_schema") else "",
                tools_config=json.dumps(c["tools_config"]) if c.get("tools_config") else "",
                expected_behavior=c.get("expected_behavior", ""),
                severity=c.get("severity", "medium"),
                evaluation_criteria=c.get("evaluation_criteria", ""),
            )
        )
    log(db, "suite.template_installed", entity=suite.id, detail=f"pack={pack['id']} cases={len(pack['cases'])}")
    db.commit()
    db.refresh(suite)
    return _out(suite)


@router.post("", response_model=SuiteOut, status_code=201)
def create_suite(body: SuiteIn, db: Session = Depends(get_db)):
    if not db.get(Project, body.project_id):
        raise HTTPException(404, "Project not found")
    s = TestSuite(
        id=str(uuid.uuid4()),
        project_id=body.project_id,
        name=body.name,
        description=body.description,
        domain_pack=body.domain_pack or "",
    )
    db.add(s)
    log(db, "suite.created", entity=s.id, detail=s.name)
    db.commit()
    db.refresh(s)
    return _out(s)


@router.get("", response_model=list[SuiteOut])
def list_suites(project_id: str | None = None, db: Session = Depends(get_db)):
    q = db.query(TestSuite)
    if project_id:
        q = q.filter(TestSuite.project_id == project_id)
    return [_out(s) for s in q.order_by(TestSuite.created_at.desc()).all()]


@router.patch("/{suite_id}", response_model=SuiteOut)
def update_suite(suite_id: str, body: SuiteUpdate, db: Session = Depends(get_db)):
    s = db.get(TestSuite, suite_id)
    if not s:
        raise HTTPException(404, "Suite not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(s, field, value)
    log(db, "suite.updated", entity=s.id, detail=s.name)
    db.commit()
    db.refresh(s)
    return _out(s)


@router.delete("/{suite_id}", status_code=204)
def delete_suite(suite_id: str, db: Session = Depends(get_db)):
    s = db.get(TestSuite, suite_id)
    if not s:
        raise HTTPException(404, "Suite not found")
    log(db, "suite.deleted", entity=s.id, detail=f"{s.name} (also deletes its test cases)")
    db.delete(s)
    db.commit()
