# AIRS Lab / AEGIS AI LAB v2.0
### Independent AI Flight Recorder, Adversarial Crash-Test Lab & Governance Engine

An enterprise-grade, local-first AI reliability, security, inference-arbitrage, and release-governance platform. Built with **FastAPI, SQLAlchemy 2.0, JSON Schema Draft 2020-12, React 18, TypeScript, Tailwind CSS**, and a zero-config **CI/CD Release Gate CLI (`airs_cli`)**.

---

## Why High-Stakes Operators Use AEGIS AI LAB

1. **Inference Arbitrage & Margin Expansion:** Quantify mathematically when a $0.80/1M-token guarded or self-hosted model matches a $15/1M-token frontier model on your exact proprietary suite—computing **Cost per Verified Pass (CPPT)**, **paired McNemar $p$-values**, and **annualized EBITDA savings**.
2. **Zero-Tolerance Domain Verification Packs:** 1-click installation of **Quant Finance & SEC 10-K**, **Executive & Family-Office Agent Security**, **Healthcare & Clinical Triage**, and **Autonomous FinTech Refund Gate** suites fingerprinted by canonical **SHA-256 dataset hashes**.
3. **OWASP LLM Top 10 (2025) & MITRE ATLAS Security Lab:** Detects direct & indirect prompt injection, **Base64 / Hex / ROT13 / spaced secret exfiltration**, **Unicode Tag (`U+E0000`) smuggling**, **verbatim system-prompt extraction**, **live wire-transfer tool hijacking**, **cloud metadata SSRF (`169.254.169.254`)**, and **AWS IAM / SSN / Credit Card DLP leaks**.
4. **Tamper-Evident Governance & Signed Evidence Bundles:** Every workspace mutation is committed to a sequential **SHA-256 hash-chained audit ledger** (`/api/system/audit/verify`). Export `.airsbundle.zip` packages for offline due-diligence or regulatory verification (`EU AI Act Art. 15`, `NIST AI RMF`).
5. **Closed-Loop Production DLP Trace Flywheel:** Ingest production failures via `POST /api/traces`—server-side DLP automatically scrubs emails, SSNs, Luhn credit cards, JWTs, and AWS keys before persistence, with **1-click promotion** into permanent regression test cases.

---

## Quickstart (Full-Stack Single-Origin Platform)

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt -r backend/requirements.txt
cd frontend && npm ci && npm run build && cd ..
cd backend && ../.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Open `http://localhost:8000` (API Swagger docs at `http://localhost:8000/docs`).
First launch seeds a labeled demonstration workspace by executing the real evaluation engine, OWASP security suite, release gate, and DLP trace redactor over deterministic mock profiles (`Mock Frontier — Pro`, `Mock Atlas — Guarded`, `Mock Atlas — Baseline`, `Mock Orion — Small`).

### Connect Live Providers
Register models in **Model Management** (`/models`) using any supported adapter—API keys are referenced strictly by **server environment-variable NAME**, never stored in SQLite/Postgres or returned to the browser:
- **`openai_compat`** — OpenAI, vLLM, SGLang, Azure OpenAI, Together, Groq (`AEGIS_OPENAI_API_KEY` or custom env var)
- **`anthropic`** — Native Anthropic `/v1/messages` for Claude models (`AEGIS_ANTHROPIC_API_KEY` or custom env var)
- **`ollama`** — Local air-gapped Ollama server (`http://localhost:11434`)
- **`custom_webhook`** — Evaluate your entire production RAG / Agent / Guardrail HTTP endpoint end-to-end

---

## CI/CD Release Gate CLI (`airs_cli`)

Block pull requests automatically when reliability regresses or any Critical/High security probe fails:

```bash
# 1. List built-in high-stakes domain vertical suites
python -m airs_cli packs

# 2. Run Quant Finance 10-K release gate + OWASP security gate & emit signed bundle
python -m airs_cli gate \
  --pack quant_finance_10k \
  --provider mock \
  --model mock-atlas-guarded \
  --fail-under 85 \
  --security-gate \
  --bundle-out ./quant_gate.airsbundle.zip

# 3. Verify an exported Evidence Bundle offline (tamper detection)
python -m airs_cli verify-bundle ./quant_gate.airsbundle.zip
```

---

## Run All Automated Tests

```bash
# Backend API, engine, security lab, DLP, audit hash-chain & CLI gate tests (27 tests)
cd backend && ../.venv/bin/python -m pytest tests/ -q && cd ..

# Frontend React + Vitest suite (5 tests)
cd frontend && npm test && cd ..

# Legacy lightweight prototype & GitHub Pages static site tests (21 tests)
.venv/bin/python -m pytest tests/ -q
```

---

## Honesty & Safety Boundaries

- `UNCERTAIN` verdicts are preserved as first-class evidence and never laundered into `PASS` or `FAIL`.
- Tool calls in `tool_use` and Security Lab are validated against JSON Schema Draft 2020-12 and policy allowlists as inert data—**never executed**.
- Mock profiles demonstrate deterministic system mechanics and cost-arbitrage modeling; connect live endpoints for real model evidence. Passing any test suite is structured evidence of tested scenarios, not a blanket safety certification.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/API.md](docs/API.md) for complete technical documentation.
