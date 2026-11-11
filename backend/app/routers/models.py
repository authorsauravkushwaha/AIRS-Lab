"""Model configuration endpoints — providers are referenced by env-var NAME only."""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import ModelConfig, Project
from app.providers import get_provider
from app.providers.base import ProviderError
from app.schemas import (
    ConnectionTestOut,
    ModelConfigIn,
    ModelConfigOut,
    ModelConfigUpdate,
    PlaygroundIn,
    PlaygroundOut,
)
from app.services.audit import log
from app.services.pricing import estimate_cost_usd, resolve_rates

router = APIRouter(prefix="/api/models", tags=["models"])


def _out(m: ModelConfig) -> ModelConfigOut:
    eff_in, eff_out, src = resolve_rates(m)
    return ModelConfigOut(
        id=m.id,
        project_id=m.project_id,
        name=m.name,
        provider=m.provider,
        model_id=m.model_id,
        base_url=m.base_url or "",
        api_key_env=m.api_key_env or "",
        system_prompt=m.system_prompt or "",
        temperature=m.temperature if m.temperature is not None else 0.0,
        max_tokens=m.max_tokens or 1024,
        input_cost_per_1m=m.input_cost_per_1m,
        output_cost_per_1m=m.output_cost_per_1m,
        effective_input_cost_per_1m=eff_in,
        effective_output_cost_per_1m=eff_out,
        pricing_source=src,
        enabled=m.enabled,
        last_status=m.last_status,
        created_at=m.created_at,
    )


@router.post("", response_model=ModelConfigOut, status_code=201)
def create_model(body: ModelConfigIn, db: Session = Depends(get_db)):
    if not db.get(Project, body.project_id):
        raise HTTPException(404, "Project not found")
    m = ModelConfig(
        id=str(uuid.uuid4()),
        project_id=body.project_id,
        name=body.name,
        provider=body.provider,
        model_id=body.model_id,
        base_url=body.base_url,
        api_key_env=body.api_key_env,
        system_prompt=body.system_prompt,
        temperature=body.temperature,
        max_tokens=body.max_tokens,
        input_cost_per_1m=body.input_cost_per_1m,
        output_cost_per_1m=body.output_cost_per_1m,
        enabled=body.enabled,
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


@router.post("/{model_id}/playground", response_model=PlaygroundOut)
def playground(model_id: str, body: PlaygroundIn, db: Session = Depends(get_db)):
    m = db.get(ModelConfig, model_id)
    if not m:
        raise HTTPException(404, "Model configuration not found")
    try:
        provider = get_provider(m)
        resp = provider.generate(body.prompt, system=body.system_prompt or "")
    except ProviderError as e:
        raise HTTPException(502, str(e)) from e
    cost = estimate_cost_usd(m, resp.tokens_in, resp.tokens_out)
    return PlaygroundOut(
        response=resp.text,
        latency_ms=resp.latency_ms,
        ttft_ms=resp.ttft_ms,
        tokens_in=resp.tokens_in,
        tokens_out=resp.tokens_out,
        est_cost_usd=cost,
        tool_calls=resp.tool_calls,
    )


@router.delete("/{model_id}", status_code=204)
def delete_model(model_id: str, db: Session = Depends(get_db)):
    m = db.get(ModelConfig, model_id)
    if not m:
        raise HTTPException(404, "Model configuration not found")
    log(db, "model.deleted", entity=m.id, detail=f"{m.name} (also deletes its evaluation runs)")
    db.delete(m)
    db.commit()
