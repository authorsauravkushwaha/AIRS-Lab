"""Unit tests for the server-side DLP redactor.

`redaction.py` is the control that keeps PII/credentials out of the database
when production traces are ingested, so every pattern branch and the Luhn
credit-card check are exercised directly here.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.providers.mock import SYNTHETIC_SECRETS
from app.services.redaction import _luhn_valid, redact_text, scan_sensitive_entities


def test_empty_input_passthrough():
    assert redact_text("") == ("", [])
    assert redact_text(None) == (None, [])  # type: ignore[arg-type]


def test_no_sensitive_content_unchanged():
    text = "The quarterly revenue grew by 12% year over year."
    out, found = redact_text(text)
    assert out == text
    assert found == []


def test_synthetic_secret_marker_redacted():
    secret = SYNTHETIC_SECRETS[0]
    out, found = redact_text(f"leaking {secret} now")
    assert secret not in out
    assert "SYNTHETIC_SECRET" in found
    assert "[REDACTED_SYNTHETIC_SECRET]" in out


def test_email_and_phone_redacted():
    out, found = redact_text("Contact jane.doe@example.org or +1-415-555-0199 today.")
    assert "jane.doe@example.org" not in out
    assert "415-555-0199" not in out
    assert "EMAIL" in found and "PHONE" in found


def test_ssn_redacted():
    out, found = redact_text("SSN 123-45-6789 on file.")
    assert "123-45-6789" not in out
    assert "US_SSN" in found


def test_invalid_ssn_shapes_not_flagged():
    # The pattern intentionally skips clearly-invalid SSNs (000/666/9xx prefixes).
    out, found = redact_text("case numbers 000-12-3456 and 666-12-3456")
    assert "000-12-3456" in out and "666-12-3456" in out
    assert "US_SSN" not in found


def test_aws_access_key_redacted():
    out, found = redact_text("key AKIAIOSFODNN7EXAMPLE leaked")
    assert "AKIAIOSFODNN7EXAMPLE" not in out
    assert "AWS_ACCESS_KEY" in found


def test_bearer_api_keys_redacted():
    for sample in (
        "sk-proj-abcdefghij1234567890ABCD",
        "ghp_abcdefghijklmnopqrstuvwxyz012345",
        "xoxb-abcdefghij1234567890abcdef",
    ):
        out, found = redact_text(f"token={sample}")
        assert sample not in out
        assert "API_BEARER_KEY" in found


def test_jwt_redacted():
    jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U"
    out, found = redact_text(f"auth {jwt}")
    assert jwt not in out
    assert "JWT_TOKEN" in found


def test_private_key_block_redacted():
    key = "-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQ...\n-----END RSA PRIVATE KEY-----"
    out, found = redact_text(f"pasted:\n{key}\n")
    assert "MIIEpAIBAAKCAQ" not in out
    assert "PRIVATE_KEY" in found


def test_luhn_valid_visa_number_redacted():
    # 4111 1111 1111 1111 is the canonical Luhn-valid test PAN.
    out, found = redact_text("card 4111 1111 1111 1111 charged")
    assert "4111111111111111" not in out.replace("-", "").replace(" ", "")
    assert "CREDIT_CARD_PAN" in found
    assert "1111" in out  # last four preserved for auditability


def test_luhn_invalid_digits_untouched():
    out, found = redact_text("order 4111 1111 1111 1112")
    assert "4111 1111 1111 1112" in out
    assert "CREDIT_CARD_PAN" not in found


def test_luhn_helper_edge_cases():
    assert not _luhn_valid("")  # too short
    assert not _luhn_valid("1111111111111")  # all same digit
    assert _luhn_valid("4111111111111111")
    assert not _luhn_valid("4111111111111112")


def test_scan_sensitive_entities_reports_without_mutating():
    text = "reach me at dev@example.com with card 4111111111111111"
    detections = scan_sensitive_entities(text)
    types = {d["type"] for d in detections}
    assert {"EMAIL", "CREDIT_CARD_PAN"} <= types
    # scan must not alter the input
    assert text == "reach me at dev@example.com with card 4111111111111111"


def test_scan_finds_synthetic_secret():
    secret = SYNTHETIC_SECRETS[0]
    detections = scan_sensitive_entities(f"buffer={secret}")
    assert any(d["type"] == "SYNTHETIC_SECRET" for d in detections)


def test_redaction_idempotent():
    raw = "user jane.doe@example.org ssn 123-45-6789"
    once, _ = redact_text(raw)
    twice, found_again = redact_text(once)
    assert once == twice  # re-redacting already-clean text is a no-op
    assert found_again == []


def test_multiple_entities_all_redacted_in_one_pass():
    out, found = redact_text(
        "From admin@example.org, SSN 123-45-6789, card 4111 1111 1111 1111, key AKIAIOSFODNN7EXAMPLE"
    )
    assert "admin@example.org" not in out
    assert "123-45-6789" not in out
    assert "4111111111111111" not in out.replace(" ", "")
    assert "AKIAIOSFODNN7EXAMPLE" not in out
    assert {"EMAIL", "US_SSN", "CREDIT_CARD_PAN", "AWS_ACCESS_KEY"} <= set(found)
