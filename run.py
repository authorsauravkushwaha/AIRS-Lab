"""Run the built AIRS Lab web application on Windows or Linux.

First run ``python scripts/setup_local.py`` to install dependencies and build
the frontend, then run ``python run.py``.
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
VENV_PYTHON = ROOT / ".venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")


def main() -> int:
    parser = argparse.ArgumentParser(description="Start the AIRS Lab local web application")
    parser.add_argument("--host", default="127.0.0.1", help="Bind address (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=8000, help="Port to listen on (default: 8000)")
    args = parser.parse_args()

    if not VENV_PYTHON.is_file():
        print("Local environment not found. First run: python scripts/setup_local.py", file=sys.stderr)
        return 1
    if not (ROOT / "frontend" / "dist" / "index.html").is_file():
        print("Built frontend not found. First run: python scripts/setup_local.py", file=sys.stderr)
        return 1

    command = [
        str(VENV_PYTHON),
        "-m",
        "uvicorn",
        "app.main:app",
        "--host",
        args.host,
        "--port",
        str(args.port),
    ]
    print(f"AIRS Lab is starting at http://{args.host}:{args.port} (press Ctrl+C to stop)", flush=True)
    try:
        return subprocess.run(command, cwd=ROOT / "backend", check=False).returncode
    except KeyboardInterrupt:
        return 130


if __name__ == "__main__":
    raise SystemExit(main())
