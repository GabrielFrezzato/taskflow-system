"""
TaskFlow — Modelos de Banco de Dados (ORM SQLAlchemy)
"""

import enum
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base


class Priority(enum.Enum):
    LOW    = "low"
    MEDIUM = "medium"
    HIGH   = "high"


class User(Base):
    """Modelo de usuário do sistema."""

    __tablename__ = "users"

    id              = Column(Integer, primary_key=True, index=True)
    username        = Column(String(50), unique=True, index=True, nullable=False)
    email           = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_active       = Column(Boolean, default=True, nullable=False)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())

    # Relacionamento: um usuário tem muitas tarefas
    tasks = relationship("Task", back_populates="owner", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<User id={self.id} username={self.username!r}>"


class Task(Base):
    """Modelo de tarefa vinculada a um usuário."""

    __tablename__ = "tasks"

    id          = Column(Integer, primary_key=True, index=True)
    title       = Column(String(200), nullable=False)
    description = Column(String(1000), default="")
    completed   = Column(Boolean, default=False, nullable=False)
    priority    = Column(Enum(Priority), default=Priority.MEDIUM, nullable=False)
    due_date    = Column(DateTime(timezone=True), nullable=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    updated_at  = Column(DateTime(timezone=True), onupdate=func.now())
    owner_id    = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    # Relacionamento: tarefa pertence a um usuário
    owner = relationship("User", back_populates="tasks")

    def __repr__(self) -> str:
        status = "✓" if self.completed else "○"
        return f"<Task [{status}] id={self.id} title={self.title!r} priority={self.priority.value}>"
