"""Project endpoints — the top-level workspace container."""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import EvaluationRun, ModelConfig, Project, TestCase, TestSuite
from app.schemas import ProjectIn, ProjectOut, ProjectUpdate
from app.services.audit import log

router = APIRouter(prefix="/api/projects", tags=["projects"])


def _out(db: Session, p: Project) -> ProjectOut:
    suite_ids = [s.id for s in db.query(TestSuite.id).filter(TestSuite.project_id == p.id)]
    case_count = (
        db.query(TestCase)
        .join(TestSuite, TestCase.suite_id == TestSuite.id)
        .filter(TestSuite.project_id == p.id)
        .count()
        if suite_ids
        else 0
    )
    return ProjectOut(
        id=p.id,
        name=p.name,
        description=p.description,
        created_at=p.created_at,
        model_count=db.query(ModelConfig).filter(ModelConfig.project_id == p.id).count(),
        suite_count=len(suite_ids),
        case_count=case_count,
        run_count=db.query(EvaluationRun).filter(EvaluationRun.project_id == p.id).count(),
    )


@router.post("", response_model=ProjectOut, status_code=201)
def create_project(body: ProjectIn, db: Session = Depends(get_db)):
    p = Project(id=str(uuid.uuid4()), name=body.name, description=body.description)
    db.add(p)
    db.commit()
    db.refresh(p)
    log(db, "project.created", entity=p.id, detail=p.name)
    db.commit()
    return _out(db, p)


@router.get("", response_model=list[ProjectOut])
def list_projects(db: Session = Depends(get_db)):
    return [_out(db, p) for p in db.query(Project).order_by(Project.created_at.desc()).all()]


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(project_id: str, db: Session = Depends(get_db)):
    p = db.get(Project, project_id)
    if not p:
        raise HTTPException(404, "Project not found")
    return _out(db, p)


@router.patch("/{project_id}", response_model=ProjectOut)
def update_project(project_id: str, body: ProjectUpdate, db: Session = Depends(get_db)):
    p = db.get(Project, project_id)
    if not p:
        raise HTTPException(404, "Project not found")
    if body.name is not None:
        p.name = body.name
    if body.description is not None:
        p.description = body.description
    log(db, "project.updated", entity=p.id, detail=p.name)
    db.commit()
    db.refresh(p)
    return _out(db, p)


@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: str, db: Session = Depends(get_db)):
    p = db.get(Project, project_id)
    if not p:
        raise HTTPException(404, "Project not found")
    log(db, "project.deleted", entity=p.id, detail=p.name)
    db.delete(p)
    db.commit()
