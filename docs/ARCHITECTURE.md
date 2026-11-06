# AEGIS AI LAB — Architecture & Plan (Phase 1)

## Architecture
Three-tier: React+TS+Vite+Tailwind frontend → FastAPI+Pydantic+SQLAlchemy backend → SQLite (dev) / PostgreSQL-compatible (prod).
LLM access goes through a provider adapter (mock / OpenAI-compatible / Ollama) so evaluation logic is provider-independent.
All evaluation results are stored as database rows; reports and regressions are reproducible from stored evidence.

## Folder structure
- `backend/app/` — main.py, config.py, db.py, models.py, schemas.py, routers/, services/, providers/, seed.py
- `frontend/src/` — pages/ (11 nav pages), components/, api.ts, App.tsx
- `backend/tests/` pytest, `frontend/tests/` vitest, `e2e/` Playwright
- `docs/` ARCHITECTURE.md, API.md, SCHEMA.md

## Database entities
Project, ModelConfig (stores env-var *name* for API key, never the value), TestSuite, TestCase,
EvaluationRun, EvaluationResult (PASS/FAIL/UNCERTAIN/ERROR/NOT RUN), SecurityFinding, Report, AuditEvent.

## Milestones
1. Foundation  2. Core management (projects/models/suites/cases + mock provider)
3. Evaluation engine  4. Security lab  5. Dashboard & analytics  6. Reports  7. QA & docs
