"""PII, PHI, Financial & Cloud-Credential DLP scanner and redactor.

Used both on production trace ingestion (so sensitive user data never lands in
SQLite/Postgres unredacted) and inside the Security Lab DLP suite.
"""
import re

from app.providers.mock import SYNTHETIC_SECRETS

# Ordered from most specific to broadest to avoid partial-match collisions.
_PATTERNS: list[tuple[str, re.Pattern[str], str]] = [
    ("PRIVATE_KEY", re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"), "[REDACTED_PRIVATE_KEY]"),
    ("AWS_ACCESS_KEY", re.compile(r"\b(?:AKIA|ASIA)[0-9A-Z]{16}\b"), "[REDACTED_AWS_KEY]"),
    ("API_BEARER_KEY", re.compile(r"\b(?:sk-(?:proj-)?[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{30,}|xox[baprs]-[A-Za-z0-9-]{20,})\b"), "[REDACTED_API_KEY]"),
    ("JWT_TOKEN", re.compile(r"\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b"), "[REDACTED_JWT]"),
    ("US_SSN", re.compile(r"\b(?!000|666|9\d\d)\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b"), "[REDACTED_SSN]"),
    ("IBAN_WIRE", re.compile(r"\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b"), "[REDACTED_IBAN]"),
    ("EMAIL", re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b"), "[REDACTED_EMAIL]"),
    ("PHONE", re.compile(r"(?<!\w)(?:\+\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b"), "[REDACTED_PHONE]"),
]

_CC_CANDIDATE = re.compile(r"\b(?:\d[ -]*?){13,19}\b")


def _luhn_valid(digits: str) -> bool:
    if len(digits) < 13 or len(digits) > 19 or len(set(digits)) == 1:
        return False
    total = 0
    reverse = digits[::-1]
    for i, ch in enumerate(reverse):
        n = int(ch)
        if i % 2 == 1:
            n *= 2
            if n > 9:
                n -= 9
        total += n
    return total % 10 == 0


def scan_sensitive_entities(text: str) -> list[dict]:
    """Return all detected sensitive or credential entities without mutating text."""
    detections: list[dict] = []
    for s in SYNTHETIC_SECRETS:
        if s in text:
            detections.append({"type": "SYNTHETIC_SECRET", "sample": s})
    for label, pat, _ in _PATTERNS:
        for m in pat.finditer(text):
            val = m.group(0)
            detections.append({"type": label, "sample": val[:6] + "…" if len(val) > 10 else "[match]"})
    for m in _CC_CANDIDATE.finditer(text):
        raw = m.group(0)
        digits = re.sub(r"\D", "", raw)
        if _luhn_valid(digits):
            detections.append({"type": "CREDIT_CARD_PAN", "sample": f"****-****-****-{digits[-4:]}"})
    return detections


def redact_text(text: str) -> tuple[str, list[str]]:
    """Scrub PII, credentials, credit cards, and synthetic markers; return (redacted, types_found)."""
    if not text:
        return text, []
    found: list[str] = []
    out = text
    for s in SYNTHETIC_SECRETS:
        if s in out:
            out = out.replace(s, "[REDACTED_SYNTHETIC_SECRET]")
            if "SYNTHETIC_SECRET" not in found:
                found.append("SYNTHETIC_SECRET")
    for label, pat, replacement in _PATTERNS:
        if pat.search(out):
            out = pat.sub(replacement, out)
            if label not in found:
                found.append(label)

    def _sub_cc(match: re.Match[str]) -> str:
        raw = match.group(0)
        digits = re.sub(r"\D", "", raw)
        if _luhn_valid(digits):
            if "CREDIT_CARD_PAN" not in found:
                found.append("CREDIT_CARD_PAN")
            return f"[REDACTED_CARD_{digits[-4:]}]"
        return raw

    out = _CC_CANDIDATE.sub(_sub_cc, out)
    return out, found
