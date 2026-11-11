# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.0] - 2026-11-11

### Added

- MIT `LICENSE` file (pyproject already declared MIT; GitHub now detects it).
- `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, and this changelog.
- GitHub issue templates (bug report, feature request) and a pull request template.
- Dependabot configuration for pip, npm, and GitHub Actions.
- `.editorconfig` for cross-editor whitespace/indent consistency.
- Code-quality gates: Ruff (lint + format) and mypy (strict-ish) configured in
  `pyproject.toml`, enforced in CI and pre-commit.
- Frontend ESLint flat config with TypeScript + React Hooks rules.
- Unit tests for all live provider adapters (`openai_compat`, `anthropic`,
  `ollama`, `custom_webhook`) using `httpx.MockTransport` — previously 0%
  covered.
- Coverage gate (`--cov-fail-under=80`) for the backend suite.
- README badges, architecture diagram, and project-status section.

### Changed

- CI workflow split into lint / typecheck / backend+CLI / frontend jobs with
  pip & npm caching, concurrency cancellation, and current action versions
  (`actions/checkout@v7`, `actions/setup-python@v7`, `actions/setup-node@v7`).
- Minimum Node.js requirement relaxed from 22.22.2 to 20 (Vite 5 + React 18
  toolchain works on Node 20; the old pin was unnecessarily specific).
- Backend Docker image now runs as a non-root user with a healthcheck.
- All Python sources formatted with Ruff; imports sorted; deprecated
  `datetime.utcnow` usage replaced.

### Fixed

- mypy errors across `security_lab.py`, `analytics.py`, and `seed.py`.
- Committed build artifacts removed from the repository
  (`backend/reports_out/*`, `frontend/tsconfig.tsbuildinfo`) and git-ignored.
- Playwright e2e spec is now actually runnable: `@playwright/test` added as a
  dev dependency with an npm script (`npm run test:e2e`).

## [2.0.0] - 2026-11-01

### Added

- AEGIS AI LAB v2.0 platform: FastAPI + SQLAlchemy 2.0 backend, React 18 +
  TypeScript SPA, provider adapters (mock, OpenAI-compatible, Anthropic,
  Ollama, custom webhook).
- Explainable evaluation engine with Wilson CIs, McNemar tests, `pass@k` /
  `pass^k`, JSON Schema Draft 2020-12 validation.
- OWASP LLM Top 10 (2025) & MITRE ATLAS security lab with DLP scanning.
- Tamper-evident SHA-256 hash-chained audit ledger and signed `.airsbundle.zip`
  evidence bundles.
- CI/CD release-gate CLI (`airs_cli`) with domain packs.
- Inference-arbitrage / CPPT cost analytics and production-trace DLP ingestion.

[2.1.0]: https://github.com/authorsauravkushwaha/AIRS-Lab/compare/v2.0.0...HEAD
[2.0.0]: https://github.com/authorsauravkushwaha/AIRS-Lab/releases/tag/v2.0.0
