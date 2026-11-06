import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import ModelConfig, Project
from app.providers import get_provider
from app.providers.base import ProviderError
from app.schemas import ConnectionTestOut, ModelConfigIn, ModelConfigOut

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
    db.commit()
    db.refresh(m)
    return _out(m)


@router.get("", response_model=list[ModelConfigOut])
def list_models(project_id: str | None = None, db: Session = Depends(get_db)):
    q = db.query(ModelConfig)
    if project_id:
        q = q.filter(ModelConfig.project_id == project_id)
    return [_out(m) for m in q.order_by(ModelConfig.created_at.desc()).all()]


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
    db.commit()
    return ConnectionTestOut(ok=ok, message=message)


@router.delete("/{model_id}", status_code=204)
def delete_model(model_id: str, db: Session = Depends(get_db)):
    m = db.get(ModelConfig, model_id)
    if not m:
        raise HTTPException(404, "Model configuration not found")
    db.delete(m)
    db.commit()
