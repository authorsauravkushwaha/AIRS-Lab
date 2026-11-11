import json
import uuid

import yaml
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import TestCase, TestSuite
from app.schemas import CaseIn, CaseOut, CaseUpdate
from app.services.audit import log

router = APIRouter(prefix="/api/test-cases", tags=["test-cases"])


def _out(c: TestCase) -> CaseOut:
    return CaseOut(
        id=c.id,
        suite_id=c.suite_id,
        name=c.name,
        category=c.category,
        prompt=c.prompt,
        reference_answer=c.reference_answer,
        expected_keywords=json.loads(c.expected_keywords or "[]"),
        source_docs=json.loads(c.source_docs or "[]"),
        expected_schema=json.loads(c.expected_schema) if c.expected_schema else None,
        tools_config=json.loads(c.tools_config) if c.tools_config else None,
        expected_behavior=c.expected_behavior,
        severity=c.severity,
        evaluation_criteria=c.evaluation_criteria,
        created_at=c.created_at,
    )


@router.post("", response_model=CaseOut, status_code=201)
def create_case(body: CaseIn, db: Session = Depends(get_db)):
    if not db.get(TestSuite, body.suite_id):
        raise HTTPException(404, "Suite not found")
    c = TestCase(
        id=str(uuid.uuid4()),
        suite_id=body.suite_id,
        name=body.name,
        category=body.category,
        prompt=body.prompt,
        reference_answer=body.reference_answer,
        expected_keywords=json.dumps(body.expected_keywords),
        source_docs=json.dumps(body.source_docs),
        expected_schema=json.dumps(body.expected_schema) if body.expected_schema else "",
        tools_config=json.dumps(body.tools_config) if body.tools_config else "",
        expected_behavior=body.expected_behavior,
        severity=body.severity,
        evaluation_criteria=body.evaluation_criteria,
    )
    db.add(c)
    log(db, "case.created", entity=c.id, detail=c.name)
    db.commit()
    db.refresh(c)
    return _out(c)


@router.get("", response_model=list[CaseOut])
def list_cases(
    suite_id: str | None = None, category: str | None = None, q: str | None = None, db: Session = Depends(get_db)
):
    query = db.query(TestCase)
    if suite_id:
        query = query.filter(TestCase.suite_id == suite_id)
    if category:
        query = query.filter(TestCase.category == category)
    if q:
        query = query.filter(TestCase.name.contains(q))
    return [_out(c) for c in query.order_by(TestCase.created_at.desc()).all()]


@router.get("/export", response_model=list[CaseOut])
def export_cases(suite_id: str | None = None, db: Session = Depends(get_db)):
    return list_cases(suite_id=suite_id, db=db)


@router.post("/import", status_code=201)
async def import_cases(file: UploadFile = File(...), db: Session = Depends(get_db)):
    raw = (await file.read()).decode("utf-8")
    fname = (file.filename or "").lower()
    if fname.endswith(".jsonl"):
        records = [json.loads(line) for line in raw.splitlines() if line.strip()]
    elif fname.endswith((".yaml", ".yml")):
        records = yaml.safe_load(raw)
    else:
        records = json.loads(raw)
    if isinstance(records, dict):
        records = records.get("cases", [records])
    created = 0
    for r in records:
        suite = db.get(TestSuite, r.get("suite_id", ""))
        if not suite:
            raise HTTPException(400, f"Unknown suite_id: {r.get('suite_id')}")
        c = TestCase(
            id=str(uuid.uuid4()),
            suite_id=suite.id,
            name=r["name"],
            category=r.get("category", "general"),
            prompt=r["prompt"],
            reference_answer=r.get("reference_answer", ""),
            expected_keywords=json.dumps(r.get("expected_keywords", [])),
            source_docs=json.dumps(r.get("source_docs", [])),
            expected_schema=json.dumps(r["expected_schema"]) if r.get("expected_schema") else "",
            tools_config=json.dumps(r["tools_config"]) if r.get("tools_config") else "",
            expected_behavior=r.get("expected_behavior", ""),
            severity=r.get("severity", "medium"),
            evaluation_criteria=r.get("evaluation_criteria", ""),
        )
        db.add(c)
        created += 1
    log(db, "case.imported", detail=f"imported={created}")
    db.commit()
    return {"imported": created}


@router.patch("/{case_id}", response_model=CaseOut)
def update_case(case_id: str, body: CaseUpdate, db: Session = Depends(get_db)):
    c = db.get(TestCase, case_id)
    if not c:
        raise HTTPException(404, "Test case not found")
    changes = body.model_dump(exclude_unset=True)
    for field, value in changes.items():
        if field in ("expected_keywords", "source_docs"):
            setattr(c, field, json.dumps(value or []))
        elif field in ("expected_schema", "tools_config"):
            setattr(c, field, json.dumps(value) if value else "")
        else:
            setattr(c, field, value)
    log(db, "case.updated", entity=c.id, detail=c.name)
    db.commit()
    db.refresh(c)
    return _out(c)


@router.post("/{case_id}/duplicate", response_model=CaseOut, status_code=201)
def duplicate_case(case_id: str, db: Session = Depends(get_db)):
    c = db.get(TestCase, case_id)
    if not c:
        raise HTTPException(404, "Test case not found")
    dup = TestCase(
        id=str(uuid.uuid4()),
        suite_id=c.suite_id,
        name=c.name + " (copy)",
        category=c.category,
        prompt=c.prompt,
        reference_answer=c.reference_answer,
        expected_keywords=c.expected_keywords,
        source_docs=c.source_docs,
        expected_schema=c.expected_schema,
        tools_config=c.tools_config,
        expected_behavior=c.expected_behavior,
        severity=c.severity,
        evaluation_criteria=c.evaluation_criteria,
    )
    db.add(dup)
    log(db, "case.duplicated", entity=dup.id, detail=dup.name)
    db.commit()
    db.refresh(dup)
    return _out(dup)


@router.delete("/{case_id}", status_code=204)
def delete_case(case_id: str, db: Session = Depends(get_db)):
    c = db.get(TestCase, case_id)
    if not c:
        raise HTTPException(404, "Test case not found")
    log(db, "case.deleted", entity=c.id, detail=c.name)
    db.delete(c)
    db.commit()
