"""
TaskFlow — Rotas de Tarefas (/api/tasks)
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List, Optional

from ..database import get_db
from .. import models, schemas, auth

router = APIRouter()


@router.get(
    "/",
    response_model=List[schemas.TaskResponse],
    summary="Listar tarefas do usuário",
)
def list_tasks(
    skip:      int                          = Query(0, ge=0),
    limit:     int                          = Query(100, ge=1, le=500),
    completed: Optional[bool]               = Query(None),
    priority:  Optional[schemas.Priority]   = Query(None),
    db: Session                             = Depends(get_db),
    current_user: models.User               = Depends(auth.get_current_user),
):
    """
    Retorna a lista de tarefas do usuário autenticado.
    Suporta filtros por status e prioridade.
    """
    query = (
        db.query(models.Task)
        .filter(models.Task.owner_id == current_user.id)
        .order_by(models.Task.created_at.desc())
    )

    if completed is not None:
        query = query.filter(models.Task.completed == completed)

    if priority is not None:
        query = query.filter(models.Task.priority == models.Priority(priority.value))

    return query.offset(skip).limit(limit).all()


@router.post(
    "/",
    response_model=schemas.TaskResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Criar nova tarefa",
)
def create_task(
    task_data: schemas.TaskCreate,
    db: Session          = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Cria uma nova tarefa vinculada ao usuário autenticado."""
    task = models.Task(
        **task_data.model_dump(),
        owner_id=current_user.id,
        priority=models.Priority(task_data.priority.value),
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@router.get(
    "/{task_id}",
    response_model=schemas.TaskResponse,
    summary="Buscar tarefa por ID",
)
def get_task(
    task_id: int,
    db: Session          = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Retorna uma tarefa específica do usuário autenticado."""
    task = _get_task_or_404(db, task_id, current_user.id)
    return task


@router.put(
    "/{task_id}",
    response_model=schemas.TaskResponse,
    summary="Atualizar tarefa",
)
def update_task(
    task_id: int,
    task_data: schemas.TaskUpdate,
    db: Session          = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Atualiza campos da tarefa. Apenas campos enviados são alterados."""
    task = _get_task_or_404(db, task_id, current_user.id)

    updates = task_data.model_dump(exclude_unset=True)
    for field, value in updates.items():
        if field == "priority" and value is not None:
            value = models.Priority(value)
        setattr(task, field, value)

    db.commit()
    db.refresh(task)
    return task


@router.delete(
    "/{task_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Excluir tarefa",
)
def delete_task(
    task_id: int,
    db: Session          = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Remove permanentemente uma tarefa do usuário autenticado."""
    task = _get_task_or_404(db, task_id, current_user.id)
    db.delete(task)
    db.commit()


@router.patch(
    "/{task_id}/toggle",
    response_model=schemas.TaskResponse,
    summary="Alternar status da tarefa",
)
def toggle_task(
    task_id: int,
    db: Session          = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Alterna entre concluída/pendente sem precisar enviar o corpo completo."""
    task = _get_task_or_404(db, task_id, current_user.id)
    task.completed = not task.completed
    db.commit()
    db.refresh(task)
    return task


# ─── Helper interno ──────────────────────────────────────
def _get_task_or_404(db: Session, task_id: int, user_id: int) -> models.Task:
    task = db.query(models.Task).filter(
        models.Task.id == task_id,
        models.Task.owner_id == user_id,
    ).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tarefa {task_id} não encontrada",
        )
    return task
