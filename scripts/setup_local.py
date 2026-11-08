"""Create a local Python environment and build the frontend on Windows or Linux.

Run from the repository root with: python scripts/setup_local.py
"""
from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
VENV = ROOT / ".venv"


def run(command: list[str], *, cwd: Path = ROOT) -> None:
    print("+", " ".join(str(part) for part in command), flush=True)
    subprocess.run(command, cwd=cwd, check=True)


def run_npm(npm: str, *args: str) -> None:
    print("+", npm, *args, flush=True)
    if os.name == "nt":
        # npm is a .cmd shim on Windows and must be launched through cmd.exe.
        subprocess.run(f'"{npm}" {" ".join(args)}', cwd=ROOT / "frontend", check=True, shell=True)
    else:
        subprocess.run([npm, *args], cwd=ROOT / "frontend", check=True)


def main() -> int:
    if sys.version_info < (3, 11):
        print("AIRS Lab requires Python 3.11 or newer.", file=sys.stderr)
        return 1

    npm = shutil.which("npm")
    if not npm:
        print("Node.js 20+ (including npm) is required to build the web interface.", file=sys.stderr)
        print("Install Node.js, then rerun: python scripts/setup_local.py", file=sys.stderr)
        return 1

    venv_python = VENV / ("Scripts/python.exe" if sys.platform == "win32" else "bin/python")
    if not venv_python.exists():
        run([sys.executable, "-m", "venv", str(VENV)])

    run([str(venv_python), "-m", "pip", "install", "--upgrade", "pip"])
    run([
        str(venv_python), "-m", "pip", "install",
        "-r", str(ROOT / "requirements.txt"),
        "-r", str(ROOT / "backend" / "requirements.txt"),
    ])
    run_npm(npm, "ci")
    run_npm(npm, "run", "build")

    print("\nSetup complete. Start AIRS Lab with: python run.py")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
