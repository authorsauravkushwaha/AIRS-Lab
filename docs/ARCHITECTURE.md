# AEGIS AI LAB v2.0 — Architecture

## Overview
Three tiers served from a single origin:
1. **React 18 + TypeScript + Vite + Tailwind SPA** (`frontend/`)
2. **FastAPI + Pydantic v2 + SQLAlchemy 2.0 + JSON Schema Draft 2020-12 Engine** (`backend/app/`)
3. **SQLite (local/CI) or PostgreSQL (scale-out)** with idempotent schema auto-migration (`backend/app/db.py`) + **CLI Release Gate** (`airs_cli.py`).

## Key Subsystems (`backend/app/`)
- **`providers/`** — Vendor-neutral adapters:
  - `mock.py` — Deterministic behavioral & pricing profiles (`frontier`, `guarded`, `baseline`, `small`)
  - `openai_compat.py` — OpenAI, vLLM, SGLang, Azure, Together, Groq (with exponential backoff & tool-call parsing)
  - `anthropic.py` — Native Anthropic `/v1/messages` adapter
  - `ollama.py` — Self-hosted / air-gapped Ollama adapter
  - `webhook.py` — End-to-end HTTP RAG / Agent microservice evaluator
- **`services/evaluation_engine.py`** — Explainable deterministic & statistical graders:
  - Contradiction-aware factual verification (`contradiction-detected`)
  - Atomic sentence & numeric claim groundedness (`groundedness-claim-verification`)
  - Calibrated abstention vs invented-statistic hallucination detection
  - Full `jsonschema` Draft 2020-12 validation (`json-schema-2020-12`)
  - Live `tool_use` allowlist, forbidden-tool, and argument-schema verification
  - `pass@k` and `pass^k` (`(p)^k`) multi-trial consistency metrics
  - Wilson 95% confidence intervals & exact paired McNemar significance testing
- **`services/security_lab.py`** — Adversarial & defensive probes mapped to **OWASP LLM Top 10 (2025)**, **MITRE ATLAS**, and **CWE**:
  - Direct, indirect, and Base64 / Hex / ROT13 / character-spaced secret exfiltration detection
  - Cloud IAM (`AKIA`), JWT, Private Key, SSN, and Luhn Credit Card DLP scanning
  - Verbatim sentinel system-prompt extraction probes
  - Live agent wire-transfer tool-hijacking probes + policy gate verification
  - XSS, Cloud Metadata SSRF (`169.254.169.254`), destructive shell/SQL, and Unicode Tag (`U+E0000`) smuggling scans
- **`services/pricing.py`** — Versioned token pricing ledger + Annualized Inference Arbitrage & Cost-per-Verified-Pass (CPPT) calculator.
- **`services/redaction.py`** — Server-side DLP scrubber applied automatically before production traces hit disk.
- **`services/audit.py`** — Tamper-evident sequential SHA-256 hash-chained ledger (`GENESIS -> entry_hash`) with live `/api/system/audit/verify` verification.
- **`services/domain_packs.py`** — Canonical SHA-256 suite fingerprinting + 1-click industry packs (`quant_finance_10k`, `family_office_exec`, `clinical_safety`, `fintech_support_gate`).
- **`routers/gates.py` & `airs_cli.py`** — Automated pre-deployment Release Gates issuing SHA-256 deployment certificates (`APPROVED` / `BLOCKED`) and offline-verifiable `.airsbundle.zip` archives.
