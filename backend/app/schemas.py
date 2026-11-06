"""Pydantic request/response schemas."""
from datetime import datetime

from pydantic import BaseModel, Field


class ProjectIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str = ""


class ProjectOut(BaseModel):
    id: str
    name: str
    description: str
    created_at: datetime
    model_count: int = 0
    suite_count: int = 0
    case_count: int = 0
    run_count: int = 0


class ModelConfigIn(BaseModel):
    project_id: str
    name: str = Field(min_length=1, max_length=200)
    provider: str = Field(pattern="^(mock|openai_compat|ollama)$")
    model_id: str = Field(min_length=1, max_length=200)
    base_url: str = ""
    api_key_env: str = ""   # env var NAME only — never a raw key
    enabled: bool = True


class ModelConfigOut(BaseModel):
    id: str
    project_id: str
    name: str
    provider: str
    model_id: str
    base_url: str
    api_key_env: str
    enabled: bool
    last_status: str
    created_at: datetime


class ConnectionTestOut(BaseModel):
    ok: bool
    message: str


class SuiteIn(BaseModel):
    project_id: str
    name: str = Field(min_length=1, max_length=200)
    description: str = ""


class SuiteOut(BaseModel):
    id: str
    project_id: str
    name: str
    description: str
    case_count: int = 0
    created_at: datetime


class CaseIn(BaseModel):
    suite_id: str
    name: str = Field(min_length=1, max_length=300)
    category: str = "general"
    prompt: str = Field(min_length=1)
    reference_answer: str = ""
    expected_keywords: list[str] = []
    source_docs: list[str] = []
    expected_schema: dict | None = None
    expected_behavior: str = ""
    severity: str = Field(default="medium", pattern="^(low|medium|high|critical)$")
    evaluation_criteria: str = ""


class CaseOut(BaseModel):
    id: str
    suite_id: str
    name: str
    category: str
    prompt: str
    reference_answer: str
    expected_keywords: list[str]
    source_docs: list[str]
    expected_schema: dict | None
    expected_behavior: str
    severity: str
    evaluation_criteria: str
    created_at: datetime


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None


class ModelConfigUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    model_id: str | None = Field(default=None, min_length=1, max_length=200)
    base_url: str | None = None
    api_key_env: str | None = None
    enabled: bool | None = None


class CaseUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=300)
    category: str | None = None
    prompt: str | None = Field(default=None, min_length=1)
    reference_answer: str | None = None
    expected_keywords: list[str] | None = None
    source_docs: list[str] | None = None
    expected_schema: dict | None = None
    expected_behavior: str | None = None
    severity: str | None = Field(default=None, pattern="^(low|medium|high|critical)$")
    evaluation_criteria: str | None = None


class SuiteUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
