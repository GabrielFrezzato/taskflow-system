"""
TaskFlow — Schemas Pydantic (validação e serialização)
"""

from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
from datetime import datetime
from enum import Enum


class Priority(str, Enum):
    LOW    = "low"
    MEDIUM = "medium"
    HIGH   = "high"


# ─── Schemas de Usuário ─────────────────────────────────
class UserBase(BaseModel):
    username: str
    email: EmailStr


class UserCreate(UserBase):
    password: str

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("A senha deve ter pelo menos 8 caracteres")
        return v

    @field_validator("username")
    @classmethod
    def username_alphanumeric(cls, v: str) -> str:
        if not v.replace("_", "").replace("-", "").isalnum():
            raise ValueError("Username deve conter apenas letras, números, _ ou -")
        if len(v) < 3:
            raise ValueError("Username deve ter pelo menos 3 caracteres")
        return v


class UserResponse(UserBase):
    id: int
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Schemas de Tarefa ──────────────────────────────────
class TaskBase(BaseModel):
    title: str
    description: Optional[str] = ""
    priority: Priority = Priority.MEDIUM
    due_date: Optional[datetime] = None

    @field_validator("title")
    @classmethod
    def title_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("O título não pode ser vazio")
        if len(v) > 200:
            raise ValueError("O título não pode ter mais de 200 caracteres")
        return v


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    title:       Optional[str]      = None
    description: Optional[str]      = None
    completed:   Optional[bool]     = None
    priority:    Optional[Priority] = None
    due_date:    Optional[datetime] = None


class TaskResponse(TaskBase):
    id: int
    completed: bool
    created_at: datetime
    updated_at: Optional[datetime]
    owner_id: int

    model_config = {"from_attributes": True}


# ─── Schemas de Autenticação ────────────────────────────
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    username: Optional[str] = None


# ─── Schema de Erro Genérico ────────────────────────────
class ErrorResponse(BaseModel):
    detail: str
