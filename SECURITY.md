# Security Policy

## Reporting a vulnerability

Please report security vulnerabilities **privually** via GitHub Security Advisories
on this repository (Security → Report a vulnerability) rather than a public issue.

Include:

- A description of the issue and its impact
- Steps to reproduce (proof-of-concept, screenshots, or logs)
- Affected version / commit SHA if known

You should receive an acknowledgement within 72 hours. Confirmed issues are
fixed before the next minor release and credited in the advisory unless you
prefer to remain anonymous.

## Supported versions

| Version | Supported |
|---|---|
| 2.x (main branch) | ✅ |
| < 2.0 | ❌ |

## Scope & design notes

AIRS Lab is a **local-first** evaluation tool. Keep these properties when
contributing:

- **Provider API keys are never stored in the database or returned by the API.**
  They are read server-side from environment variables referenced by *name*
  (`AEGIS_OPENAI_API_KEY`, `AEGIS_ANTHROPIC_API_KEY`, or a custom env var).
- **Production traces are redacted server-side before persistence** (SSNs,
  emails, Luhn-valid card numbers, JWTs, AWS keys, private keys). Do not weaken
  `backend/app/services/redaction.py`.
- **Model output and tool calls are treated as inert data.** The Security Lab
  and tool-use graders validate against JSON Schema and policy allowlists —
  they never execute model-generated instructions.
- **The audit ledger is hash-chained.** Changes to
  `backend/app/services/audit.py` must keep `/api/system/audit/verify`
  detecting any mutation of historical rows.
- The default CORS configuration allows any origin because the app binds to
  `127.0.0.1` by default. When exposing the service on a non-loopback
  interface, set `AEGIS_CORS_ORIGINS` to an explicit allowlist.
