from datetime import datetime, timedelta
from typing import Optional
import logging
import random
import uuid

logger = logging.getLogger(__name__)

import httpx
import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from passlib.hash import pbkdf2_sha256
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.rate_limiting import limiter, RateLimits
from app.core.redis import get_redis
from app.db.deps import get_db
from app.db.models.user import User

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


# ─── Pydantic models ────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: Optional[str] = None
    workspace: Optional[str] = None
    terms_accepted: bool = False


class GoogleAuthRequest(BaseModel):
    credential: str          # Google id_token (JWT) from GIS
    terms_accepted: bool = False


class OtpSendRequest(BaseModel):
    email: EmailStr


class OtpVerifyRequest(BaseModel):
    email: EmailStr
    otp: str


# ─── Helpers ────────────────────────────────────────────────────────────────

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
        "jti": str(uuid.uuid4()),
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
        "is_email_verified": bool(user.is_email_verified),
    }


def _generate_otp() -> str:
    """Generate a cryptographically random 6-digit OTP."""
    return f"{random.SystemRandom().randint(0, 999999):06d}"


async def _verify_google_token(credential: str) -> dict:
    """
    Verify a Google ID token via Google's tokeninfo endpoint.
    Returns decoded claims on success, raises HTTPException on failure.
    """
    client_id = settings.GOOGLE_CLIENT_ID
    if not client_id:
        raise HTTPException(status_code=503, detail="Google OAuth is not configured on this server")

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            "https://oauth2.googleapis.com/tokeninfo",
            params={"id_token": credential},
        )

    if resp.status_code != 200:
        logger.warning("Google tokeninfo returned %s: %s", resp.status_code, resp.text[:200])
        raise HTTPException(status_code=401, detail="Invalid Google credential")

    claims = resp.json()

    if "error" in claims:
        logger.warning("Google tokeninfo error: %s", claims.get("error"))
        raise HTTPException(status_code=401, detail="Google credential verification failed")

    # Google can put the client_id in either `aud` or `azp` depending on token type.
    # Accept if either field matches — both are set by Google and trustworthy here.
    # Strip whitespace to guard against env-var copy-paste artifacts.
    expected = client_id.strip()
    aud = claims.get("aud", "").strip()
    azp = claims.get("azp", "").strip()
    if aud != expected and azp != expected:
        logger.warning(
            "Google audience mismatch — expected=%s  aud=%s  azp=%s",
            expected, aud, azp,
        )
        raise HTTPException(status_code=401, detail="Google credential audience mismatch")

    return claims


# ─── Routes ─────────────────────────────────────────────────────────────────

@router.post("/register")
@limiter.limit(RateLimits.AUTH)
async def register(request: Request, body: RegisterRequest, db: Session = Depends(get_db)):
    logger.info("Register attempt — email=%s", body.email)

    if len(body.password) < 8:
        logger.warning("Register rejected — password too short — email=%s", body.email)
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    if not body.terms_accepted:
        logger.warning("Register rejected — terms not accepted — email=%s", body.email)
        raise HTTPException(status_code=400, detail="You must accept the Terms of Service to create an account")

    existing = db.query(User).filter(User.email == body.email).first()
    if existing:
        logger.warning("Register rejected — email already in use — email=%s", body.email)
        raise HTTPException(status_code=400, detail="Email already in use")

    user = User(
        email=body.email,
        full_name=body.name,
        company_name=body.workspace,
        hashed_password=hash_password(body.password),
        terms_accepted_at=datetime.utcnow() if body.terms_accepted else None,
        is_email_verified=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    logger.info("Register success — email=%s user_id=%s", user.email, user.id)
    return {"user": user_response(user)}


@router.post("/login")
@limiter.limit(RateLimits.AUTH)
async def login(request: Request, body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not user.hashed_password or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    user.last_login_at = datetime.utcnow()
    db.commit()
    token = create_access_token(user)

    return {"token": token, "user": user_response(user)}


@router.post("/google")
@limiter.limit(RateLimits.AUTH)
async def google_auth(request: Request, body: GoogleAuthRequest, db: Session = Depends(get_db)):
    """
    Verify a Google ID token from Google Identity Services (GIS).
    Creates the user on first sign-in, logs them in, returns our JWT.
    """
    claims = await _verify_google_token(body.credential)

    google_id = claims.get("sub")
    email = claims.get("email", "").lower()
    name = claims.get("name") or claims.get("given_name", "")
    email_verified_by_google = claims.get("email_verified") == "true"

    if not email or not google_id:
        raise HTTPException(status_code=400, detail="Incomplete profile received from Google")

    # Look up by google_id first, fall back to email match
    user = db.query(User).filter(User.google_id == google_id).first()
    if not user:
        user = db.query(User).filter(User.email == email).first()

    if user:
        # Existing user — link Google ID + sync verified status
        if not user.google_id:
            user.google_id = google_id
        if email_verified_by_google and not user.is_email_verified:
            user.is_email_verified = True
        if not user.terms_accepted_at and body.terms_accepted:
            user.terms_accepted_at = datetime.utcnow()
        user.last_login_at = datetime.utcnow()
        db.commit()
    else:
        # Brand new user via Google OAuth
        if not body.terms_accepted:
            raise HTTPException(
                status_code=400,
                detail="You must accept the Terms of Service to create an account",
            )
        user = User(
            email=email,
            full_name=name,
            google_id=google_id,
            hashed_password=None,
            is_email_verified=email_verified_by_google,
            terms_accepted_at=datetime.utcnow(),
            last_login_at=datetime.utcnow(),
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    token = create_access_token(user)
    return {"token": token, "user": user_response(user)}


@router.post("/otp/send")
@limiter.limit(RateLimits.AUTH)
async def send_otp(
    request: Request,
    body: OtpSendRequest,
    db: Session = Depends(get_db),
    redis=Depends(get_redis),
):
    """
    Send a 6-digit OTP to the given email for verification.
    Rate-limited: max 3 sends per 15 minutes per email.
    """
    from app.services.email import send_otp_email

    email = body.email.lower()
    logger.info("OTP send request — email=%s", email)

    if redis is None:
        logger.error("OTP send failed — Redis unavailable — email=%s", email)
        raise HTTPException(status_code=503, detail="OTP service temporarily unavailable")

    # Check send rate (max 3 per 15 min)
    rate_key = f"otp_send_rate:{email}"
    send_count = await redis.get(rate_key)
    if send_count and int(send_count) >= 3:
        logger.warning("OTP send rate-limited — email=%s count=%s", email, send_count)
        raise HTTPException(status_code=429, detail="Too many OTP requests. Please wait 15 minutes.")

    otp = _generate_otp()
    await redis.setex(f"otp:{email}", 600, otp)           # 10 min TTL
    await redis.setex(f"otp_attempts:{email}", 600, "0")  # reset attempt counter

    pipe = redis.pipeline()
    pipe.incr(rate_key)
    pipe.expire(rate_key, 900)  # 15 min window
    await pipe.execute()

    # Get user name for personalised email (best-effort)
    user = db.query(User).filter(User.email == email).first()
    user_name = (user.full_name or "") if user else ""

    sent = await send_otp_email(to_email=email, otp=otp, user_name=user_name)

    if sent:
        logger.info("OTP email dispatched — email=%s (delivery subject to SPF/DKIM DNS config)", email)
    else:
        logger.error("OTP email dispatch failed — email=%s — check SMTP credentials or DNS SPF/DKIM", email)

    # Always return 200 to avoid email enumeration
    return {"detail": "If this email has an account, a verification code has been sent.", "email_sent": sent}


@router.post("/otp/verify")
@limiter.limit(RateLimits.AUTH)
async def verify_otp(
    request: Request,
    body: OtpVerifyRequest,
    db: Session = Depends(get_db),
    redis=Depends(get_redis),
):
    """
    Verify the OTP code. On success marks the user as email-verified and returns a JWT.
    """
    email = body.email.lower()

    if redis is None:
        raise HTTPException(status_code=503, detail="OTP service temporarily unavailable")

    # Block after 5 wrong attempts
    attempt_key = f"otp_attempts:{email}"
    attempts = await redis.get(attempt_key)
    if attempts and int(attempts) >= 5:
        raise HTTPException(status_code=429, detail="Too many incorrect attempts. Request a new code.")

    stored_otp = await redis.get(f"otp:{email}")
    if not stored_otp:
        raise HTTPException(status_code=400, detail="Verification code expired or not found. Request a new one.")

    stored = stored_otp.decode() if isinstance(stored_otp, bytes) else stored_otp

    if stored != body.otp.strip():
        await redis.incr(attempt_key)
        raise HTTPException(status_code=400, detail="Invalid verification code")

    # Correct — clean up Redis keys
    await redis.delete(f"otp:{email}")
    await redis.delete(attempt_key)

    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_email_verified = True
    user.last_login_at = datetime.utcnow()
    db.commit()

    token = create_access_token(user)
    return {"token": token, "user": user_response(user)}


_bearer = HTTPBearer()


@router.post("/logout")
@limiter.limit(RateLimits.AUTH)
async def logout(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Security(_bearer),
    redis=Depends(get_redis),
):
    """
    Revoke the current JWT by storing its jti in Redis until it naturally expires.
    """
    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        return {"detail": "Logged out"}

    jti = payload.get("jti")
    exp = payload.get("exp")
    if jti and exp and redis is not None:
        ttl = max(int(exp - datetime.utcnow().timestamp()), 1)
        await redis.setex(f"revoked_jti:{jti}", ttl, "1")

    return {"detail": "Logged out"}
