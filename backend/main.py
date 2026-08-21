"""
TaskFlow — Ponto de entrada da API (FastAPI)
Rodar com: uvicorn backend.main:app --reload --port 8000
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

from .database import create_tables
from .routes import tasks, users


# ─── Lifecycle ───────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Executa setup na inicialização e cleanup no encerramento."""
    print("🚀 TaskFlow iniciando...")
    create_tables()
    print("✅ Banco de dados pronto!")
    yield
    print("👋 TaskFlow encerrando.")


# ─── Instância da aplicação ──────────────────────────────
app = FastAPI(
    title="TaskFlow API",
    description="API REST para gerenciamento de tarefas com autenticação JWT.",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)


# ─── Middlewares ─────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],        # Em produção: especificar domínios
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Rotas da API ────────────────────────────────────────
app.include_router(users.router, prefix="/api/users", tags=["👤 Usuários"])
app.include_router(tasks.router, prefix="/api/tasks", tags=["✅ Tarefas"])


# ─── Servir frontend estático ────────────────────────────
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend")

if os.path.exists(FRONTEND_DIR):
    app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")

    @app.get("/")
    def serve_frontend():
        return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))


# ─── Rotas utilitárias ───────────────────────────────────
@app.get("/health", tags=["Sistema"])
def health_check():
    """Verifica se a API está funcionando."""
    return {
        "status": "healthy",
        "service": "TaskFlow API",
        "version": "1.0.0",
    }


@app.get("/api", tags=["Sistema"])
def api_info():
    """Informações sobre a API."""
    return {
        "name": "TaskFlow API",
        "version": "1.0.0",
        "docs": "/docs",
        "endpoints": {
            "users": "/api/users",
            "tasks": "/api/tasks",
        },
    }
