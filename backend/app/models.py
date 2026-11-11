"""SQLAlchemy entities for AEGIS AI LAB v2.0."""

from datetime import UTC, datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def utcnow() -> datetime:
    return datetime.now(UTC)


class Project(Base):
    __tablename__ = "projects"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    models: Mapped[list["ModelConfig"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    suites: Mapped[list["TestSuite"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    runs: Mapped[list["EvaluationRun"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    reports: Mapped[list["Report"]] = relationship(cascade="all, delete-orphan")
    gates: Mapped[list["ReleaseGate"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    traces: Mapped[list["ProductionTrace"]] = relationship(back_populates="project", cascade="all, delete-orphan")


class ModelConfig(Base):
    __tablename__ = "model_configs"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    # mock | openai_compat | anthropic | ollama | custom_webhook
    provider: Mapped[str] = mapped_column(String(50), nullable=False)
    model_id: Mapped[str] = mapped_column(String(200), nullable=False)
    base_url: Mapped[str] = mapped_column(String(500), default="")
    api_key_env: Mapped[str] = mapped_column(String(120), default="")  # env var NAME only, never the value
    system_prompt: Mapped[str] = mapped_column(Text, default="")
    temperature: Mapped[float] = mapped_column(Float, default=0.0)
    max_tokens: Mapped[int] = mapped_column(Integer, default=1024)
    input_cost_per_1m: Mapped[float | None] = mapped_column(Float, nullable=True, default=None)
    output_cost_per_1m: Mapped[float | None] = mapped_column(Float, nullable=True, default=None)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    last_status: Mapped[str] = mapped_column(String(50), default="unknown")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    project: Mapped[Project] = relationship(back_populates="models")
    runs: Mapped[list["EvaluationRun"]] = relationship(back_populates="model", cascade="all, delete-orphan")


class TestSuite(Base):
    __tablename__ = "test_suites"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    domain_pack: Mapped[str] = mapped_column(String(80), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    project: Mapped[Project] = relationship(back_populates="suites")
    cases: Mapped[list["TestCase"]] = relationship(back_populates="suite", cascade="all, delete-orphan")


class TestCase(Base):
    __tablename__ = "test_cases"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    suite_id: Mapped[str] = mapped_column(String(36), ForeignKey("test_suites.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    category: Mapped[str] = mapped_column(String(100), default="general")
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    reference_answer: Mapped[str] = mapped_column(Text, default="")
    expected_keywords: Mapped[str] = mapped_column(Text, default="")  # JSON list
    source_docs: Mapped[str] = mapped_column(Text, default="")  # JSON list
    expected_schema: Mapped[str] = mapped_column(Text, default="")  # JSON schema
    tools_config: Mapped[str] = mapped_column(Text, default="")  # JSON tool definitions & expected call
    expected_behavior: Mapped[str] = mapped_column(Text, default="")
    severity: Mapped[str] = mapped_column(String(20), default="medium")
    evaluation_criteria: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    suite: Mapped[TestSuite] = relationship(back_populates="cases")


class EvaluationRun(Base):
    __tablename__ = "evaluation_runs"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id"), nullable=False)
    suite_id: Mapped[str] = mapped_column(String(36), default="")
    model_id: Mapped[str] = mapped_column(String(36), ForeignKey("model_configs.id"), nullable=False)
    kind: Mapped[str] = mapped_column(String(30), default="reliability")  # reliability | security | comparison
    status: Mapped[str] = mapped_column(String(20), default="pending")
    dataset_hash: Mapped[str] = mapped_column(String(64), default="")
    evaluator_version: Mapped[str] = mapped_column(String(32), default="2.0.0")
    concurrency: Mapped[int] = mapped_column(Integer, default=1)
    summary: Mapped[str] = mapped_column(Text, default="{}")  # JSON aggregate metrics
    started_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    project: Mapped[Project] = relationship(back_populates="runs")
    model: Mapped[ModelConfig] = relationship(back_populates="runs")
    results: Mapped[list["EvaluationResult"]] = relationship(back_populates="run", cascade="all, delete-orphan")
    findings: Mapped[list["SecurityFinding"]] = relationship(back_populates="run", cascade="all, delete-orphan")


class EvaluationResult(Base):
    __tablename__ = "evaluation_results"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    run_id: Mapped[str] = mapped_column(String(36), ForeignKey("evaluation_runs.id"), nullable=False)
    test_case_id: Mapped[str] = mapped_column(String(36), ForeignKey("test_cases.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)  # PASS|FAIL|UNCERTAIN|ERROR|NOT RUN
    method: Mapped[str] = mapped_column(String(100), default="")
    score: Mapped[float] = mapped_column(Float, default=0.0)
    response: Mapped[str] = mapped_column(Text, default="")
    evidence: Mapped[str] = mapped_column(Text, default="{}")  # JSON
    latency_ms: Mapped[float] = mapped_column(Float, default=0.0)
    ttft_ms: Mapped[float] = mapped_column(Float, default=0.0)
    tokens_in: Mapped[int] = mapped_column(Integer, default=0)
    tokens_out: Mapped[int] = mapped_column(Integer, default=0)
    est_cost_usd: Mapped[float] = mapped_column(Float, default=0.0)
    cached: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    run: Mapped[EvaluationRun] = relationship(back_populates="results")


class SecurityFinding(Base):
    __tablename__ = "security_findings"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    run_id: Mapped[str] = mapped_column(String(36), ForeignKey("evaluation_runs.id"), nullable=False)
    test_name: Mapped[str] = mapped_column(String(300), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    severity: Mapped[str] = mapped_column(String(20), nullable=False)  # critical|high|medium|low|info
    owasp_id: Mapped[str] = mapped_column(String(64), default="")
    mitre_atlas_id: Mapped[str] = mapped_column(String(64), default="")
    cwe_id: Mapped[str] = mapped_column(String(64), default="")
    test_input: Mapped[str] = mapped_column(Text, default="")
    model_response: Mapped[str] = mapped_column(Text, default="")
    expected_behavior: Mapped[str] = mapped_column(Text, default="")
    actual_behavior: Mapped[str] = mapped_column(Text, default="")
    outcome: Mapped[str] = mapped_column(String(20), nullable=False)  # pass|fail|uncertain
    evidence: Mapped[str] = mapped_column(Text, default="{}")
    mitigation: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    run: Mapped[EvaluationRun] = relationship(back_populates="findings")


class Report(Base):
    __tablename__ = "reports"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id"), nullable=False)
    run_id: Mapped[str] = mapped_column(String(36), ForeignKey("evaluation_runs.id"), nullable=False)
    format: Mapped[str] = mapped_column(String(16), nullable=False)  # json | csv | pdf | bundle
    title: Mapped[str] = mapped_column(String(300), default="Evaluation report")
    file_path: Mapped[str] = mapped_column(String(500), default="")
    sha256_hash: Mapped[str] = mapped_column(String(64), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class AuditEvent(Base):
    __tablename__ = "audit_events"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    seq: Mapped[int] = mapped_column(Integer, default=0)
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    entity: Mapped[str] = mapped_column(String(100), default="")
    detail: Mapped[str] = mapped_column(Text, default="")
    prev_hash: Mapped[str] = mapped_column(String(64), default="GENESIS")
    entry_hash: Mapped[str] = mapped_column(String(64), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class ResponseCache(Base):
    __tablename__ = "response_cache"
    cache_key: Mapped[str] = mapped_column(String(64), primary_key=True)
    provider: Mapped[str] = mapped_column(String(50), nullable=False)
    model_id: Mapped[str] = mapped_column(String(200), nullable=False)
    response_json: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class ReleaseGate(Base):
    __tablename__ = "release_gates"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    suite_id: Mapped[str] = mapped_column(String(36), default="")
    min_pass_rate: Mapped[float] = mapped_column(Float, default=85.0)
    max_critical_findings: Mapped[int] = mapped_column(Integer, default=0)
    max_high_findings: Mapped[int] = mapped_column(Integer, default=0)
    max_avg_latency_ms: Mapped[float | None] = mapped_column(Float, nullable=True, default=None)
    max_cost_per_case_usd: Mapped[float | None] = mapped_column(Float, nullable=True, default=None)
    require_audit_integrity: Mapped[bool] = mapped_column(Boolean, default=True)
    last_verdict: Mapped[str] = mapped_column(String(20), default="untested")  # approved | blocked | untested
    last_model_id: Mapped[str] = mapped_column(String(36), default="")
    last_certificate: Mapped[str] = mapped_column(Text, default="{}")  # JSON signed verdict
    last_evaluated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    project: Mapped[Project] = relationship(back_populates="gates")


class ProductionTrace(Base):
    __tablename__ = "production_traces"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id"), nullable=False)
    model_name: Mapped[str] = mapped_column(String(200), default="production")
    prompt_redacted: Mapped[str] = mapped_column(Text, nullable=False)
    response_redacted: Mapped[str] = mapped_column(Text, default="")
    expected_answer_hint: Mapped[str] = mapped_column(Text, default="")
    flagged_reason: Mapped[str] = mapped_column(String(200), default="user_thumbs_down")
    redactions_applied: Mapped[str] = mapped_column(Text, default="[]")  # JSON list of redacted entity types
    latency_ms: Mapped[float] = mapped_column(Float, default=0.0)
    tokens_in: Mapped[int] = mapped_column(Integer, default=0)
    tokens_out: Mapped[int] = mapped_column(Integer, default=0)
    promoted_case_id: Mapped[str] = mapped_column(String(36), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    project: Mapped[Project] = relationship(back_populates="traces")
