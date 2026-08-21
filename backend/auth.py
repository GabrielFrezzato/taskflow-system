"""
TaskFlow — Autenticação (JWT + bcrypt)
"""

import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from .database import get_db
from . import models, schemas

# ─── Configurações de segurança ─────────────────────────
SECRET_KEY  = os.getenv("SECRET_KEY", "taskflow-dev-secret-troque-em-producao-123!")
ALGORITHM   = "HS256"
TOKEN_EXPIRY_MINUTES = int(os.getenv("TOKEN_EXPIRY_MINUTES", "60"))

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
http_bearer = HTTPBearer(auto_error=False)


# ─── Funções de senha ────────────────────────────────────
def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica senha contra o hash armazenado."""
    return pwd_context.verify(plain_password, hashed_password)


def hash_password(password: str) -> str:
    """Gera o hash bcrypt da senha."""
    return pwd_context.hash(password)


# ─── Funções de token ────────────────────────────────────
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Cria um JWT assinado com o payload fornecido."""
    payload = data.copy()
    delta   = expires_delta or timedelta(minutes=TOKEN_EXPIRY_MINUTES)
    expire  = datetime.now(timezone.utc) + delta
    payload.update({"exp": expire})
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> Optional[schemas.TokenData]:
    """Decodifica e valida um JWT. Retorna None se inválido."""
    try:
        payload  = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if username is None:
            return None
        return schemas.TokenData(username=username)
    except JWTError:
        return None


# ─── Dependência de autenticação ─────────────────────────
def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(http_bearer),
    db: Session = Depends(get_db),
) -> models.User:
    """
    Dependency que valida o Bearer token e retorna o usuário autenticado.
    Levanta 401 caso o token seja inválido ou ausente.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token de acesso inválido ou expirado",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not credentials:
        raise credentials_exception

    token_data = decode_token(credentials.credentials)
    if not token_data:
        raise credentials_exception

    user = db.query(models.User).filter(
        models.User.username == token_data.username,
        models.User.is_active == True,
    ).first()

    if not user:
        raise credentials_exception

    return user
