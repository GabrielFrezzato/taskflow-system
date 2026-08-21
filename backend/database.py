"""
TaskFlow — Configuração do Banco de Dados (SQLAlchemy + SQLite)
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from typing import Generator

# ─── Configuração ───────────────────────────────────────
DATABASE_URL = "sqlite:///./taskflow.db"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},  # necessário para SQLite
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    """Base declarativa para todos os modelos SQLAlchemy."""
    pass


# ─── Dependency Injection ───────────────────────────────
def get_db() -> Generator:
    """
    Provê uma sessão de banco de dados por request.
    Garante fechamento da sessão ao finalizar.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables() -> None:
    """Cria todas as tabelas definidas nos modelos."""
    from . import models  # import local para evitar circular
    Base.metadata.create_all(bind=engine)
