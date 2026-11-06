"""SQLAlchemy entities for AEGIS AI LAB."""
from datetime import datetime, timezone

from sqlalchemy import String, Text, Integer, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


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


class ModelConfig(Base):
    __tablename__ = "model_configs"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    provider: Mapped[str] = mapped_column(String(50), nullable=False)  # mock | openai_compat | ollama
    model_id: Mapped[str] = mapped_column(String(200), nullable=False)
    base_url: Mapped[str] = mapped_column(String(500), default="")
    api_key_env: Mapped[str] = mapped_column(String(120), default="")  # env var NAME only, never the value
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
    expected_keywords: Mapped[str] = mapped_column(Text, default="")   # JSON list
    source_docs: Mapped[str] = mapped_column(Text, default="")         # JSON list
    expected_schema: Mapped[str] = mapped_column(Text, default="")     # JSON schema
    expected_behavior: Mapped[str] = mapped_column(Text, default="")
    severity: Mapped[str] = mapped_column(String(20), default="medium")
    evaluation_criteria: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    suite: Mapped[TestSuite] = relationship(back_populates="cases")


class EvaluationRun(Base):
    __tablename__ = "evaluation_runs"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id"), nullable=False)
    suite_id: Mapped[str] = mapped_column(String(36), ForeignKey("test_suites.id"), nullable=False)
    model_id: Mapped[str] = mapped_column(String(36), ForeignKey("model_configs.id"), nullable=False)
    kind: Mapped[str] = mapped_column(String(30), default="reliability")  # reliability | security | comparison
    status: Mapped[str] = mapped_column(String(20), default="pending")
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
    tokens_in: Mapped[int] = mapped_column(Integer, default=0)
    tokens_out: Mapped[int] = mapped_column(Integer, default=0)
    est_cost_usd: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    run: Mapped[EvaluationRun] = relationship(back_populates="results")


class SecurityFinding(Base):
    __tablename__ = "security_findings"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    run_id: Mapped[str] = mapped_column(String(36), ForeignKey("evaluation_runs.id"), nullable=False)
    test_name: Mapped[str] = mapped_column(String(300), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    severity: Mapped[str] = mapped_column(String(20), nullable=False)  # critical|high|medium|low|info
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
    format: Mapped[str] = mapped_column(String(10), nullable=False)  # json | csv | pdf
    title: Mapped[str] = mapped_column(String(300), default="Evaluation report")
    file_path: Mapped[str] = mapped_column(String(500), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class AuditEvent(Base):
    __tablename__ = "audit_events"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    entity: Mapped[str] = mapped_column(String(100), default="")
    detail: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
