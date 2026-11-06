# AEGIS AI LAB — Architecture

## Overview
Three tiers: React + TypeScript + Vite + Tailwind frontend → FastAPI + Pydantic + SQLAlchemy backend → SQLite (dev/local-first) or PostgreSQL (scale-out).
LLM access goes through a provider adapter (mock / OpenAI-compatible / Ollama) so evaluation logic is provider-independent.
All evaluation results are stored as database rows; reports and comparisons are reproducible from stored evidence — exports never re-execute anything.
The backend also serves the built SPA at `/` (single-origin) when `frontend/dist` exists or `AEGIS_STATIC_DIR` is set; otherwise the API runs API-only and Vite proxies `/api` in dev.

## Folder structure
- `backend/app/` — `main.py` (app + SPA fallback), `config.py`, `db.py`, `models.py`, `schemas.py`, `seed.py` (first-run seed executes the real pipeline)
  - `routers/` — projects, models, suites, cases, evaluations, security, analytics, reports, `system` (runtime config, audit, clear history)
  - `services/` — `evaluation_engine.py` (rule-based graders), `security_lab.py` (defensive fixtures), `runner.py` (shared execution path), `audit.py`
  - `providers/` — `base.py`, `mock.py` (deterministic profiles: guarded / baseline / small), `openai_compat.py`, `ollama.py`
- `frontend/src/`
  - `layout/AppShell.tsx` — sidebar (grouped nav), top bar, ⌘K command palette, system status
  - `pages/` — Overview, Projects, Model Management, Test Suites, Test Cases, Run Evaluations, Reliability Lab, Security Lab, Model Comparison, Reports, Settings, 404
  - `components/` — `ui.tsx` design system (buttons, cards, badges, fields, modal, ring), `Toast.tsx`, `CommandPalette.tsx`
- Tests: `backend/tests/` (pytest, incl. HTTP journey + system endpoints), `frontend/tests/` (vitest), `e2e/` (Playwright)

## Database entities
Project (cascades everything it owns), ModelConfig (stores env-var *name* for API keys, never values),
TestSuite (cascades cases), TestCase, EvaluationRun (cascades results/findings),
EvaluationResult (PASS/FAIL/UNCERTAIN/ERROR/NOT RUN), SecurityFinding, Report, AuditEvent (append-only activity log).

## First-run seed
On a fresh database the seeder creates a demo workspace (3 mock models with distinct behavioral profiles, 1 suite, 8 synthetic cases),
then **executes the real evaluation engine and security suite** — estimates you see on the Overview dashboard are genuine engine outputs over the mock provider, not hand-written fixtures. Seeding is idempotent: it runs only when the database is empty.

## Milestones — all complete
1. ✅ Foundation  2. ✅ Core management  3. ✅ Evaluation engine  4. ✅ Security lab  5. ✅ Dashboard & analytics  6. ✅ Reports  7. ✅ QA & docs

## Known boundaries (honest by design)
- Single-user local tool: no auth/roles, no rate limits, no job queue; live runs are sequential.
- UNCERTAIN results are evidence, never laundered into pass/fail.
- Rule-based graders are explainable but shallow — semantic grading and adversarial suites are future work.
- Mock fixtures demonstrate plumbing, not model quality; connect a live provider for real evidence.
