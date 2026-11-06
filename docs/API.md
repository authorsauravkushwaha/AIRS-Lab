# AEGIS AI LAB — API documentation

Base URL: `http://localhost:8000`. Interactive docs at `/docs` (Swagger).
All endpoints are same-origin when the SPA is served by the API (default), or proxied via Vite in dev.

## Projects
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/projects` | Create project (`{name, description?}`) — 201 |
| GET | `/api/projects` | List projects with aggregate counts (`model_count`, `suite_count`, `case_count`, `run_count`) |
| GET | `/api/projects/{id}` | Project detail |
| PATCH | `/api/projects/{id}` | Rename / update description |
| DELETE | `/api/projects/{id}` | Delete project — cascades models, suites, cases, runs, results, findings, reports |

## Models
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/models` | Add model config (mock / openai_compat / ollama). API keys are referenced by env-var NAME only |
| GET | `/api/models` | List model configs (`?project_id=`) |
| PATCH | `/api/models/{id}` | Update name/model_id/base_url/api_key_env/enabled |
| DELETE | `/api/models/{id}` | Delete model — also deletes its evaluation runs |
| POST | `/api/models/{id}/test-connection` | Provider connectivity check (updates `last_status`) |

## Test suites
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/test-suites` | Create suite |
| GET | `/api/test-suites` | List suites with `case_count` (`?project_id=`) |
| PATCH | `/api/test-suites/{id}` | Rename / update description |
| DELETE | `/api/test-suites/{id}` | Delete suite — cascades its test cases |

## Test cases
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/test-cases` | Create case (explicit oracle: reference / keywords / schema / behavior) |
| GET | `/api/test-cases` | List cases (filters: `suite_id`, `category`, `q`) |
| GET | `/api/test-cases/export` | JSON export of cases |
| POST | `/api/test-cases/import` | JSON/JSONL import (multipart file) |
| PATCH | `/api/test-cases/{id}` | Update case fields |
| POST | `/api/test-cases/{id}/duplicate` | Duplicate a case |
| DELETE | `/api/test-cases/{id}` | Delete case |

## Evaluations
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/evaluations/run` | Execute a suite against a model — stores case-level evidence (`repeats` 1–10 for consistency) |
| GET | `/api/evaluations` | Run history (`?project_id=`, `?kind=`, `?status=`) |
| GET | `/api/evaluations/{id}` | Single run with summary |
| GET | `/api/evaluations/{id}/results` | Per-case results incl. case name/category/prompt, `PASS/FAIL/…`, method, score, latency, tokens (`?status=`) |
| DELETE | `/api/evaluations/{id}` | Delete run — cascades results |

## Security lab (defensive, synthetic fixtures only)
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/security/run` | Run injection / leakage / tool-policy / output checks |
| GET | `/api/security/findings` | Findings (filters: `run_id`, `severity`, `outcome`) |

## Analytics
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/dashboard/overview` | Aggregate metrics (`?project_id=`): totals, pass rate, failed/uncertain/errors, security by severity, avg latency, tokens, `total_reports`, `pass_rate_trend` (last 12 completed runs), `category_breakdown`, `recent_runs` |
| POST | `/api/comparisons/run` | Compare ≥2 models over their last 5 completed reliability runs (`{project_id, model_ids[], suite_id?}`) |

## Reports
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/reports` | Generate JSON/CSV/PDF report for a stored run (`{project_id, run_id, format, title?}`) |
| GET | `/api/reports` | List reports (`?project_id=`) |
| GET | `/api/reports/{id}/download` | Download a report file |
| DELETE | `/api/reports/{id}` | Delete report row and file |

## System
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/system/config` | Non-secret runtime config: version, database backend, redaction flag, provider-key presence (never values), Ollama URL, stored-evidence counts |
| GET | `/api/system/audit` | Recent audit events (`?limit=`, max 100) — who did what, when |
| DELETE | `/api/system/runs` | Clear all runs/results/findings (projects, models, cases kept; reports kept) |

Result statuses: `PASS | FAIL | UNCERTAIN | ERROR | NOT RUN`. Finding severities:
`critical | high | medium | low | info` (rule-based). UNCERTAIN is never coerced into pass/fail.
