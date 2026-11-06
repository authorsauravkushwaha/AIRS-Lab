import json
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Project, TestCase, TestSuite
from app.schemas import SuiteIn, SuiteOut

router = APIRouter(prefix="/api/test-suites", tags=["test-suites"])


def _out(s: TestSuite) -> SuiteOut:
    return SuiteOut(
        id=s.id, project_id=s.project_id, name=s.name, description=s.description,
        case_count=len(s.cases), created_at=s.created_at,
    )


@router.post("", response_model=SuiteOut, status_code=201)
def create_suite(body: SuiteIn, db: Session = Depends(get_db)):
    if not db.get(Project, body.project_id):
        raise HTTPException(404, "Project not found")
    s = TestSuite(id=str(uuid.uuid4()), project_id=body.project_id, name=body.name, description=body.description)
    db.add(s)
    db.commit()
    db.refresh(s)
    return _out(s)


@router.get("", response_model=list[SuiteOut])
def list_suites(project_id: str | None = None, db: Session = Depends(get_db)):
    q = db.query(TestSuite)
    if project_id:
        q = q.filter(TestSuite.project_id == project_id)
    return [_out(s) for s in q.order_by(TestSuite.created_at.desc()).all()]


@router.delete("/{suite_id}", status_code=204)
def delete_suite(suite_id: str, db: Session = Depends(get_db)):
    s = db.get(TestSuite, suite_id)
    if not s:
        raise HTTPException(404, "Suite not found")
    db.delete(s)
    db.commit()
