"""Surface pytest failures as GitHub Actions annotations from a JUnit XML report."""

from __future__ import annotations

import sys
import xml.etree.ElementTree as ET
from pathlib import Path


def escape_command(value: str) -> str:
    return value.replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A")


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: python scripts/annotate_junit.py REPORT.xml", file=sys.stderr)
        return 2
    report = Path(sys.argv[1])
    if not report.is_file():
        print(f"::warning::Pytest JUnit report not found: {report}")
        return 0

    root = ET.parse(report).getroot()
    failures = root.findall(".//failure") + root.findall(".//error")
    for failure in failures:
        # ElementTree has no parent pointers; identify the containing testcase.
        label = "pytest failure"
        for case in root.findall(".//testcase"):
            if failure in list(case):
                label = f"{case.get('classname', '')}::{case.get('name', 'test')}"
                break
        detail = (failure.get("message", "") + " " + (failure.text or "")).strip()
        print(f"::error title=Pytest failure::{escape_command(label + ': ' + detail[:1800])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
