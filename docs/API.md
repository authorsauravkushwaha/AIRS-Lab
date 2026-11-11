# AEGIS AI LAB — API Documentation

Base URL: `http://localhost:8000`. Interactive OpenAPI docs at `/docs`.
All endpoints are served single-origin alongside the compiled React SPA (`frontend/dist`) or proxied via Vite in development.

## Projects
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/projects` | Create workspace project (`{name, description?}`) |
| GET | `/api/projects` | List projects with aggregate counts (`model_count`, `suite_count`, `case_count`, `run_count`) |
| GET | `/api/projects/{id}` | Project detail |
| PATCH | `/api/projects/{id}` | Rename / update description |
| DELETE | `/api/projects/{id}` | Cascading delete of project and owned entities |

## Models & Live Playground
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/models` | Register model (`mock`, `openai_compat`, `anthropic`, `ollama`, `custom_webhook`) with `system_prompt`, `temperature`, `max_tokens`, optional rate overrides. Keys referenced strictly by server env-var NAME |
| GET | `/api/models` | List models including resolved $/1M input/output pricing (`?project_id=`) |
| PATCH | `/api/models/{id}` | Update configuration or toggle `enabled` |
| POST | `/api/models/{id}/test-connection` | Live connectivity health check |
| POST | `/api/models/{id}/playground` | Interactive prompt & system-guardrail execution returning response, TTFT, latency, tokens, tool calls, and USD cost |
| DELETE | `/api/models/{id}` | Delete model and associated runs |

## Test Suites & High-Stakes Domain Packs
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/test-suites/templates` | List built-in domain packs (`quant_finance_10k`, `family_office_exec`, `clinical_safety`, `fintech_support_gate`) |
| POST | `/api/test-suites/install-template` | 1-click install a verified domain pack into a project |
| POST | `/api/test-suites` | Create custom suite |
| GET | `/api/test-suites` | List suites with `case_count` and canonical SHA-256 `dataset_hash` |
| PATCH | `/api/test-suites/{id}` | Update suite metadata |
| DELETE | `/api/test-suites/{id}` | Delete suite and its cases |

## Test Cases
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/test-cases` | Create case (`factual_accuracy`, `groundedness`, `hallucination`, `structured_output`, `tool_use`, `consistency`, `refusal`, `security_injection`) |
| GET | `/api/test-cases` | List cases (`?suite_id=`, `?category=`, `?q=`) |
| GET | `/api/test-cases/export` | Export cases as JSON |
| POST | `/api/test-cases/import` | Bulk import `.json`, `.jsonl`, `.yaml`, or `.yml` |
| PATCH | `/api/test-cases/{id}` | Update case fields (`expected_schema` Draft 2020-12, `tools_config`, etc.) |
| POST | `/api/test-cases/{id}/duplicate` | Clone case |
| DELETE | `/api/test-cases/{id}` | Delete case |

## Concurrent Evaluations
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/evaluations/run` | Execute suite with `repeats` (1–10 for `pass^k`), `concurrency` (1–16 worker threads), and optional deterministic `use_cache` |
| GET | `/api/evaluations` | List runs with `dataset_hash`, `wilson_95_ci`, P50/P95 latency, cost, and cache hits |
| GET | `/api/evaluations/{id}` | Single run summary |
| GET | `/api/evaluations/{id}/results` | Per-case evidence (`PASS | FAIL | UNCERTAIN | ERROR | NOT RUN`) |
| DELETE | `/api/evaluations/{id}` | Delete run |

## Security Lab (OWASP LLM Top 10 & MITRE ATLAS)
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/security/run` | Execute injection (raw + Base64/Hex/ROT13), DLP leakage, system-prompt extraction, live tool-hijack, and XSS/SSRF/Unicode checks |
| GET | `/api/security/findings` | List findings tagged with `owasp_id`, `mitre_atlas_id`, and `cwe_id` |

## Analytics, Paired Statistics & Inference Arbitrage
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/dashboard/overview` | Workspace KPIs, Wilson 95% CI, P95 latency, spend, gate counts, and SHA-256 audit-chain status |
| POST | `/api/comparisons/run` | Multi-model comparison with paired case-by-case McNemar $p$-values, regressions/improvements, and annualized EBITDA inference-arbitrage ROI |

## Governance Release Gates & Production Trace DLP Flywheel
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/gates` | Create release gate policy (`min_pass_rate`, `max_critical_findings`, `max_high_findings`, `require_audit_integrity`) |
| GET | `/api/gates` | List gates and latest signed SHA-256 deployment certificates |
| POST | `/api/gates/{id}/evaluate` | Evaluate candidate model and issue `approved` / `blocked` cryptographic certificate |
| DELETE | `/api/gates/{id}` | Delete gate |
| POST | `/api/traces` | Ingest production trace with automatic server-side PII/secret DLP scrubbing (SSN, Email, Card PAN, AWS IAM, JWT) |
| GET | `/api/traces` | List sanitized production traces |
| POST | `/api/traces/{id}/promote` | 1-click promote a sanitized production failure into a permanent regression `TestCase` |
| DELETE | `/api/traces/{id}` | Delete a stored production trace |

## Reports & Signed Evidence Bundles
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/reports` | Generate `bundle` (`.airsbundle.zip`), `pdf`, `json`, or `csv` from stored rows with SHA-256 file checksum |
| GET | `/api/reports` | List generated artifacts |
| GET | `/api/reports/{id}/download` | Download artifact |
| DELETE | `/api/reports/{id}` | Delete artifact |

## System & Cryptographic Audit Chain
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Liveness probe: service name and version (used by Docker healthchecks) |
| GET | `/api/system/config` | Non-secret runtime introspection, provider key presence, counts, and audit-chain status |
| GET | `/api/system/audit` | Sequential hash-chained `AuditEvent` ledger (`seq`, `prev_hash`, `entry_hash`) |
| GET | `/api/system/audit/verify` | Recompute and verify every SHA-256 link from `GENESIS` to head |
| DELETE | `/api/system/cache` | Purge content-addressed deterministic response cache |
| DELETE | `/api/system/runs` | Clear stored evaluation runs |
