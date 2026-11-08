"""Database engine/session setup and idempotent schema migration."""
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import settings

connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


# Idempotent column migrations when opening a v1.0 SQLite/Postgres database.
_COLUMN_MIGRATIONS: list[tuple[str, str, str]] = [
    ("model_configs", "system_prompt", "TEXT DEFAULT ''"),
    ("model_configs", "temperature", "FLOAT DEFAULT 0.0"),
    ("model_configs", "max_tokens", "INTEGER DEFAULT 1024"),
    ("model_configs", "input_cost_per_1m", "FLOAT"),
    ("model_configs", "output_cost_per_1m", "FLOAT"),
    ("test_suites", "domain_pack", "VARCHAR(80) DEFAULT ''"),
    ("test_cases", "tools_config", "TEXT DEFAULT ''"),
    ("evaluation_runs", "dataset_hash", "VARCHAR(64) DEFAULT ''"),
    ("evaluation_runs", "evaluator_version", "VARCHAR(32) DEFAULT '2.0.0'"),
    ("evaluation_runs", "concurrency", "INTEGER DEFAULT 1"),
    ("evaluation_results", "ttft_ms", "FLOAT DEFAULT 0.0"),
    ("evaluation_results", "cached", "BOOLEAN DEFAULT 0"),
    ("security_findings", "owasp_id", "VARCHAR(64) DEFAULT ''"),
    ("security_findings", "mitre_atlas_id", "VARCHAR(64) DEFAULT ''"),
    ("security_findings", "cwe_id", "VARCHAR(64) DEFAULT ''"),
    ("reports", "sha256_hash", "VARCHAR(64) DEFAULT ''"),
    ("audit_events", "seq", "INTEGER DEFAULT 0"),
    ("audit_events", "prev_hash", "VARCHAR(64) DEFAULT 'GENESIS'"),
    ("audit_events", "entry_hash", "VARCHAR(64) DEFAULT ''"),
]


def init_db() -> None:
    from app import models  # noqa: F401  (register entities)
    Base.metadata.create_all(bind=engine)
    insp = inspect(engine)
    existing_tables = set(insp.get_table_names())
    with engine.begin() as conn:
        for table, col, ddl in _COLUMN_MIGRATIONS:
            if table in existing_tables:
                cols = {c["name"] for c in insp.get_columns(table)}
                if col not in cols:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {ddl}"))


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
