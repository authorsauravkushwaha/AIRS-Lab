"""Model configuration endpoints — providers are referenced by env-var NAME only."""
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import ModelConfig, Project
from app.providers import get_provider
from app.providers.base import ProviderError
from app.schemas import ConnectionTestOut, ModelConfigIn, ModelConfigOut, ModelConfigUpdate
from app.services.audit import log

router = APIRouter(prefix="/api/models", tags=["models"])


def _out(m: ModelConfig) -> ModelConfigOut:
    return ModelConfigOut(**{c: getattr(m, c) for c in ModelConfigOut.model_fields if c != "id"} | {"id": m.id})


@router.post("", response_model=ModelConfigOut, status_code=201)
def create_model(body: ModelConfigIn, db: Session = Depends(get_db)):
    if not db.get(Project, body.project_id):
        raise HTTPException(404, "Project not found")
    m = ModelConfig(
        id=str(uuid.uuid4()), project_id=body.project_id, name=body.name, provider=body.provider,
        model_id=body.model_id, base_url=body.base_url, api_key_env=body.api_key_env, enabled=body.enabled,
    )
    db.add(m)
    log(db, "model.created", entity=m.id, detail=f"{m.name} ({m.provider}/{m.model_id})")
    db.commit()
    db.refresh(m)
    return _out(m)


@router.get("", response_model=list[ModelConfigOut])
def list_models(project_id: str | None = None, db: Session = Depends(get_db)):
    q = db.query(ModelConfig)
    if project_id:
        q = q.filter(ModelConfig.project_id == project_id)
    return [_out(m) for m in q.order_by(ModelConfig.created_at.desc()).all()]


@router.patch("/{model_id}", response_model=ModelConfigOut)
def update_model(model_id: str, body: ModelConfigUpdate, db: Session = Depends(get_db)):
    m = db.get(ModelConfig, model_id)
    if not m:
        raise HTTPException(404, "Model configuration not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(m, field, value)
    log(db, "model.updated", entity=m.id, detail=f"enabled={m.enabled} name={m.name}")
    db.commit()
    db.refresh(m)
    return _out(m)


@router.post("/{model_id}/test-connection", response_model=ConnectionTestOut)
def test_connection(model_id: str, db: Session = Depends(get_db)):
    m = db.get(ModelConfig, model_id)
    if not m:
        raise HTTPException(404, "Model configuration not found")
    try:
        provider = get_provider(m)
        ok, message = provider.test_connection()
    except ProviderError as e:
        ok, message = False, str(e)
    m.last_status = "ok" if ok else "error"
    log(db, "model.test_connection", entity=m.id, detail=f"ok={ok} {message[:200]}")
    db.commit()
    return ConnectionTestOut(ok=ok, message=message)


@router.delete("/{model_id}", status_code=204)
def delete_model(model_id: str, db: Session = Depends(get_db)):
    m = db.get(ModelConfig, model_id)
    if not m:
        raise HTTPException(404, "Model configuration not found")
    log(db, "model.deleted", entity=m.id, detail=f"{m.name} (also deletes its evaluation runs)")
    db.delete(m)
    db.commit()
