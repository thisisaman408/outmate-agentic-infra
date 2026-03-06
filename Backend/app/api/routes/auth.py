from datetime import datetime, timedelta
from typing import Optional

import jwt
from fastapi import APIRouter, Depends, HTTPException
from passlib.hash import pbkdf2_sha256
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.deps import get_db
from app.db.models.user import User

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: Optional[str] = None
    workspace: Optional[str] = None


def hash_password(password: str) -> str:
    try:
        return pbkdf2_sha256.hash(password)
    except ValueError as exc:
        raise HTTPException(status_code=500, detail="Failed to hash password") from exc


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return pbkdf2_sha256.verify(plain, hashed)
    except ValueError:
        return False


def _parse_expires_in(value: str) -> timedelta:
    """Parse JWT_EXPIRES_IN string like '24h', '30m', '7d' into timedelta."""
    value = value.strip().lower()
    if value.endswith("h"):
        return timedelta(hours=int(value[:-1]))
    if value.endswith("m"):
        return timedelta(minutes=int(value[:-1]))
    if value.endswith("d"):
        return timedelta(days=int(value[:-1]))
    return timedelta(hours=24)


def create_access_token(user: User) -> str:
    expire = datetime.utcnow() + _parse_expires_in(settings.JWT_EXPIRES_IN)
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "exp": expire,
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")


def user_response(user: User) -> dict:
    return {
        "id": str(user.id),
        "email": user.email,
        "name": user.full_name,
        "workspace": user.company_name,
        "credits": user.credits_balance,
        "plan": user.subscription_tier,
    }


@router.post("/register")
async def register(request: RegisterRequest, db: Session = Depends(get_db)):
    if len(request.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    existing = db.query(User).filter(User.email == request.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already in use")

    user = User(
        email=request.email,
        full_name=request.name,
        company_name=request.workspace,
        hashed_password=hash_password(request.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return {"user": user_response(user)}


@router.post("/login")
async def login(request: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == request.email).first()
    if not user or not user.hashed_password or not verify_password(request.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    user.last_login_at = datetime.utcnow()
    db.commit()
    token = create_access_token(user)

    return {"token": token, "user": user_response(user)}
