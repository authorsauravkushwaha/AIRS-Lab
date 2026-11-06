"""AEGIS AI LAB — FastAPI application entrypoint."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db import SessionLocal, get_db, init_db
from app.routers import analytics, cases, evaluations, models, projects, reports, security, suites


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


app = FastAPI(title="AEGIS AI LAB", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(projects.router)
app.include_router(models.router)
app.include_router(suites.router)
app.include_router(cases.router)
app.include_router(evaluations.router)
app.include_router(security.router)
app.include_router(analytics.router)
app.include_router(reports.router)


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "service": "aegis-ai-lab", "version": "0.1.0"}
