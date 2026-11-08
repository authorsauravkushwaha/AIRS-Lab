"""Cross-platform temporary paths shared by the backend test modules."""
from pathlib import Path
import tempfile


TEMP_DIR = Path(tempfile.gettempdir()) / "airs-lab-tests"
TEMP_DIR.mkdir(parents=True, exist_ok=True)


def database_url(name: str) -> str:
    """Build a SQLAlchemy SQLite URL that works for POSIX and Windows paths."""
    return f"sqlite:///{(TEMP_DIR / name).as_posix()}"


def reset_database(name: str) -> None:
    path = TEMP_DIR / name
    if path.exists():
        path.unlink()
