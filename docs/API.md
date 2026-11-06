# AEGIS AI LAB — API documentation

Base URL: `http://localhost:8000`. Interactive docs at `/docs` (Swagger).

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Service health |
| POST/GET/DELETE | `/api/projects[/{id}]` | Project CRUD |
| POST/GET/DELETE | `/api/models[/{id}]` | Model config CRUD (keys stay server-side) |
| POST | `/api/models/{id}/test-connection` | Provider connectivity check |
| POST/GET/DELETE | `/api/test-suites[/{id}]` | Suite CRUD |
| POST/GET | `/api/test-cases` | Case create/list (filters: suite_id, category, q) |
| POST | `/api/test-cases/import` | JSON/JSONL import (multipart file) |
| POST | `/api/test-cases/{id}/duplicate` | Duplicate a case |
| POST | `/api/evaluations/run` | Execute a suite against a model |
| GET | `/api/evaluations[/{id}/results]` | Run history / per-test results |
| POST | `/api/security/run` | Defensive security suite (synthetic fixtures) |
| GET | `/api/security/findings` | Findings (filter: run_id, severity) |
| GET | `/api/dashboard/overview` | Aggregate metrics from stored rows |
| POST | `/api/comparisons/run` | Compare ≥2 models |
| POST/GET | `/api/reports` + `/{id}/download` | JSON/CSV/PDF export |

Result statuses: `PASS | FAIL | UNCERTAIN | ERROR | NOT RUN`. Finding severities:
`critical | high | medium | low | info` (rule-based).
