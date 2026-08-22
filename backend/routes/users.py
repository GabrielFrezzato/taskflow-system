"""
TaskFlow — Rotas de Usuário (/api/users)
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, schemas, auth

router = APIRouter()


@router.post(
    "/register",
    response_model=schemas.UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar novo usuário",
)
def register(user_data: schemas.UserCreate, db: Session = Depends(get_db)):
    """Cria uma nova conta de usuário."""

    if db.query(models.User).filter(models.User.email == user_data.email).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="E-mail já cadastrado",
        )

    if db.query(models.User).filter(models.User.username == user_data.username).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username já em uso",
        )

    user = models.User(
        username=user_data.username,
        email=user_data.email,
        hashed_password=auth.hash_password(user_data.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post(
    "/login",
    response_model=schemas.Token,
    summary="Fazer login",
)
def login(username: str, password: str, db: Session = Depends(get_db)):
    """
    Autentica o usuário e retorna um JWT Bearer token.
    Passe username e password como query params.
    """
    user = db.query(models.User).filter(
        models.User.username == username,
        models.User.is_active.is_(True),
    ).first()

    if not user or not auth.verify_password(password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Username ou senha incorretos",
        )

    token = auth.create_access_token(data={"sub": user.username})
    return schemas.Token(access_token=token)


@router.get(
    "/me",
    response_model=schemas.UserResponse,
    summary="Perfil do usuário logado",
)
def get_me(current_user: models.User = Depends(auth.get_current_user)):
    """Retorna os dados do usuário autenticado."""
    return current_user


@router.delete(
    "/me",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Excluir conta",
)
def delete_account(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    """Remove a conta do usuário logado e todas as suas tarefas."""
    db.delete(current_user)
    db.commit()
