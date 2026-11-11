# Contributing to AIRS Lab / AEGIS AI LAB

Thanks for your interest in improving AIRS Lab. This document explains how to
set up a development environment, the quality gates every change must pass,
and how to submit changes.

## Development setup

Requirements: **Python 3.11+**, **Node.js 20+** (npm included).

```bash
# Linux / macOS
python3 scripts/setup_local.py   # creates .venv, installs deps, builds the UI
python3 run.py                   # http://localhost:8000

# Windows (PowerShell)
py -3.11 scripts/setup_local.py
py run.py
```

For day-to-day development with hot reload, run the API and the Vite dev
server separately:

```bash
# Terminal 1 — API (from repo root, using the venv interpreter)
cd backend && ../.venv/bin/python -m uvicorn app.main:app --reload --port 8000

# Terminal 2 — frontend with proxy to :8000
cd frontend && npm run dev        # http://localhost:5173
```

## Quality gates

Every pull request must pass all of these (CI runs the same commands):

```bash
# 1. Lint + format (Python)
.venv/bin/ruff check .
.venv/bin/ruff format --check .

# 2. Type check (Python)
.venv/bin/mypy backend/app airs_cli.py

# 3. Tests + coverage gate (Python)
.venv/bin/python -m pytest tests/ -q
(cd backend && ../.venv/bin/python -m pytest tests/ -q --cov=app --cov-fail-under=80)

# 4. Frontend: types, lint, unit tests, build
cd frontend
npm ci
npm run lint
npm test
npm run build
```

Fix findings locally before pushing; CI fails on any of the gates above.

## Pull request guidelines

- **One concern per PR.** Bug fixes, features, and refactors go in separate PRs.
- **Tests accompany behavior changes.** Bug fixes need a regression test.
- **Keep the honesty bar.** Do not fabricate metrics, testimonials, benchmark
  numbers, or safety claims. `UNCERTAIN` verdicts stay `UNCERTAIN`.
- **Never commit secrets.** API keys are referenced by environment-variable
  *name* only; `.env` is git-ignored (see `.env.example`).
- **Update docs** when you change API routes, CLI flags, or architecture.

## Reporting bugs & proposing features

- Open a bug report with the issue template: minimal reproduction, expected vs
  actual behavior, OS/Python/Node versions.
- Feature ideas are welcome as issues; discuss scope before large PRs.
- Security vulnerabilities: see [SECURITY.md](SECURITY.md) — do **not** open a
  public issue.

## Project layout

| Path | Purpose |
|---|---|
| `backend/app/` | FastAPI app: routers, services, providers, models |
| `backend/tests/` | Backend & enterprise test suite |
| `frontend/` | React 18 + TypeScript + Vite SPA |
| `airs_cli.py` | CI/CD release-gate CLI (`python -m airs_cli …`) |
| `app/` | Legacy single-file demo app used by the GitHub Pages site |
| `tests/` | Legacy/site test suite |
| `docs/` | Architecture, API, schema, and honesty documentation |
| `frontend/e2e/` | Playwright browser journey (optional, see below) |

## Optional end-to-end browser test

The HTTP journey is covered by `backend/tests/test_e2e_journey.py` in CI.
The browser-level Playwright spec is opt-in:

```bash
cd frontend && npm run test:e2e     # starts the API server, runs frontend/e2e/main-journey.spec.ts
```

## License

By contributing, you agree that your contributions are licensed under the
[MIT License](LICENSE).
