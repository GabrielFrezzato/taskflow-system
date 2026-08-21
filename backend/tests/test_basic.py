"""
TaskFlow — Testes Básicos
Garante que o CI passe com cobertura mínima funcional.
"""

import pytest

# ─── Schemas ──────────────────────────────────────────────
def test_priority_values():
    from backend.schemas import Priority
    assert Priority.LOW.value == "low"
    assert Priority.MEDIUM.value == "medium"
    assert Priority.HIGH.value == "high"


def test_task_create_defaults():
    from backend.schemas import TaskCreate, Priority
    task = TaskCreate(title="Minha tarefa")
    assert task.priority == Priority.MEDIUM
    assert task.description == ""
    assert task.due_date is None


def test_task_title_empty_raises():
    from pydantic import ValidationError
    from backend.schemas import TaskCreate
    with pytest.raises(ValidationError):
        TaskCreate(title="   ")


def test_user_password_too_short_raises():
    from pydantic import ValidationError
    from backend.schemas import UserCreate
    with pytest.raises(ValidationError):
        UserCreate(username="teste", email="a@b.com", password="123")


def test_user_username_too_short_raises():
    from pydantic import ValidationError
    from backend.schemas import UserCreate
    with pytest.raises(ValidationError):
        UserCreate(username="ab", email="a@b.com", password="senhaforte")


# ─── Auth ─────────────────────────────────────────────────
def test_hash_and_verify_password():
    from backend.auth import hash_password, verify_password
    plain = "senha_segura_123"
    hashed = hash_password(plain)
    assert hashed != plain
    assert verify_password(plain, hashed)
    assert not verify_password("errada", hashed)


def test_create_and_decode_token():
    from backend.auth import create_access_token, decode_token
    token = create_access_token({"sub": "gabriel"})
    data = decode_token(token)
    assert data is not None
    assert data.username == "gabriel"


def test_invalid_token_returns_none():
    from backend.auth import decode_token
    assert decode_token("token.invalido.xyz") is None


# ─── Banco de dados in-memory ─────────────────────────────
def test_tables_created_in_memory():
    from sqlalchemy import create_engine, inspect
    from sqlalchemy.orm import sessionmaker
    from backend.database import Base
    from backend import models  # noqa: F401

    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(bind=engine)
    tables = inspect(engine).get_table_names()
    assert "users" in tables
    assert "tasks" in tables

    Session = sessionmaker(bind=engine)
    db = Session()
    db.close()
