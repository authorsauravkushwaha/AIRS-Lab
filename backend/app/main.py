"""AEGIS AI LAB — FastAPI application entrypoint.

Serves the JSON API under /api/* and, when a built frontend is present
(`frontend/dist`, or $AEGIS_STATIC_DIR), the single-page app at / — one
origin, no proxy required. In dev you can still run Vite on :5173 with its
/api proxy to this service on :8000.
"""
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from app.db import SessionLocal, init_db
from app.routers import analytics, cases, evaluations, models, projects, reports, security, suites, system

VERSION = "1.0.0"

REPO_ROOT = Path(__file__).resolve().parents[2]
STATIC_DIR = Path(os.environ.get("AEGIS_STATIC_DIR", REPO_ROOT / "frontend" / "dist"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    from app.seed import seed
    db = SessionLocal()
    try:
        seed(db)
    finally:
        db.close()
    yield


app = FastAPI(title="AEGIS AI LAB", version=VERSION, lifespan=lifespan,
              description="AI reliability, evaluation and security testing platform.")

cors_origins = [o.strip() for o in os.environ.get(
    "AEGIS_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

for router in (projects.router, models.router, suites.router, cases.router,
               evaluations.router, security.router, analytics.router,
               reports.router, system.router):
    app.include_router(router)


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "service": "aegis-ai-lab", "version": VERSION}


# ---- Single-origin static frontend (production) -------------------------
if STATIC_DIR.is_dir():
    index_html = STATIC_DIR / "index.html"

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str):
        if full_path == "api" or full_path.startswith("api/"):
            raise HTTPException(404, "Not found")
        candidate = (STATIC_DIR / full_path).resolve()
        # Path traversal guard: resolved path must stay inside STATIC_DIR.
        if candidate.is_file() and STATIC_DIR.resolve() in candidate.parents:
            return FileResponse(candidate)
        return FileResponse(index_html, media_type="text/html")
