from datetime import datetime, timedelta
from typing import Optional
import logging
import random
import uuid
import os
from urllib.parse import urlencode, quote_plus

logger = logging.getLogger(__name__)

import httpx
import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, Security, status
from fastapi.responses import RedirectResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from passlib.hash import pbkdf2_sha256
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.core.config import settings
from app.api.deps.auth import get_current_user
from app.core.rate_limiting import limiter, RateLimits
from app.core.redis import get_redis
from app.db.deps import get_db
from app.db.models.user import User

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


# ─── Pydantic models ────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    visitor_id: Optional[str] = None
    session_id: Optional[str] = None


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: Optional[str] = None
    workspace: Optional[str] = None
    terms_accepted: bool = False


class GoogleAuthRequest(BaseModel):
    credential: str          # Google id_token (JWT) from GIS
    terms_accepted: bool = False
    visitor_id: Optional[str] = None
    session_id: Optional[str] = None


class OtpSendRequest(BaseModel):
    email: EmailStr


class OtpVerifyRequest(BaseModel):
    email: EmailStr
    otp: str


class ByokSetupRequest(BaseModel):
    """Request to set up BYOK (Bring Your Own Key)."""
    anthropic_api_key: str
    use_byok: bool = True


class ByokStatusResponse(BaseModel):
    """Response with BYOK status."""
    use_byok: bool
    has_key: bool


class OnboardingUpdateRequest(BaseModel):
    """Partial update for user onboarding state.  All fields optional — only
    the ones present in the request body get persisted."""
    step: Optional[int] = None
    completed: Optional[bool] = None
    website_url: Optional[str] = None
    user_role: Optional[str] = None
    onboarding_data: Optional[dict] = None
    icp_config: Optional[dict] = None


class ICPConfigRequest(BaseModel):
    """Full ICP configuration payload — replaces the stored config on save."""
    industries: Optional[list] = None
    company_sizes: Optional[list] = None
    geographies: Optional[list] = None
    job_titles: Optional[list] = None
    funding_stages: Optional[list] = None


class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None


class UpdateWorkspaceRequest(BaseModel):
    name: Optional[str] = None
    plan: Optional[str] = None
    billing_email: Optional[str] = None


class UpdateNotificationsRequest(BaseModel):
    email_notifications: Optional[bool] = None
    slack_notifications: Optional[bool] = None
    new_leads: Optional[bool] = None
    campaign_updates: Optional[bool] = None
    signal_alerts: Optional[bool] = None
    weekly_report: Optional[bool] = None


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


# ---------------------------------------------------------------------------
# Cross-stack SSO bridge → agentic backend (:7860)
# ---------------------------------------------------------------------------
#
# The agentic stack runs as a separate FastAPI process with its own user
# table. To avoid asking the user to log in twice, we mint a short-lived
# (60 s) JWT signed with the shared `OUTMATE_BRIDGE_SECRET` and redirect to
# the agentic side's `/api/v1/auth/bridge` endpoint, which validates the
# token, mints its own `access_token_lf` cookie for the same UUID, and
# redirects to the requested flow URL.
#
# The bridge JWT is intentionally a different token type (`outmate_bridge`)
# from the main backend's normal access JWT — that way a leaked main JWT
# can't be used to authenticate against the agentic stack and vice versa.

_BRIDGE_TOKEN_TYPE = "outmate_bridge"


def _create_bridge_token(user: User) -> str:
    """Mint a 60-second JWT consumed by the agentic stack's `/auth/bridge`."""
    if not settings.OUTMATE_BRIDGE_SECRET:
        raise HTTPException(
            status_code=503,
            detail=(
                "OUTMATE_BRIDGE_SECRET is not configured on the main backend. "
                "Set it in the environment to enable the agentic SSO bridge."
            ),
        )
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "name": user.full_name,
        "type": _BRIDGE_TOKEN_TYPE,
        "exp": datetime.utcnow() + timedelta(seconds=60),
        "iat": datetime.utcnow(),
        "jti": str(uuid.uuid4()),
    }
    return jwt.encode(payload, settings.OUTMATE_BRIDGE_SECRET, algorithm="HS256")


@router.get("/agentic-bridge")
def agentic_bridge(
    request: Request,
    next: str = "/all",
    auth: Optional[str] = None,
    db: Session = Depends(get_db),
    redis=Depends(get_redis),
):
    """Hand the logged-in user off to the agentic stack.

    Browser navigations (top-level <a href> / window.location.href) cannot
    attach an `Authorization: Bearer` header, so we accept the main-stack
    JWT via TWO paths and pick whichever is present:

      1. Standard `Authorization: Bearer <jwt>` header (used by fetch()
         callers that want a JSON response).
      2. `?auth=<jwt>` query param (used by the frontend helper for
         top-level navigations — the token sits in the URL only for the
         ~1 redirect hop and never gets persisted server-side).

    Frontend usage (`Frontend/lib/agentic-bridge.ts`):
        window.location.href = agenticBridgeUrl(`/flow/${flowId}`);

    Behavior on success:
        1. Validate the main-stack JWT (header or query).
        2. Mint a short-lived bridge JWT { sub, email, name,
           type: 'outmate_bridge', exp: now+60s }.
        3. 302 to `${OUTMATE_AGENTIC_BASE_URL}/api/v1/auth/bridge?token=…&next=…`.
        4. Agentic side auto-provisions an agentic User keyed by the
           SAME UUID on first hit, sets `access_token_lf` cookie, redirects
           to `next`.
    """
    # Sanitize `next` so a logged-in user can't be redirected to an
    # attacker-controlled host. Only relative paths permitted.
    if not next.startswith("/"):
        next = "/all"

    # Try the Authorization header first; fall back to the query param.
    raw_token: Optional[str] = None
    auth_header = request.headers.get("authorization", "")
    if auth_header.lower().startswith("bearer "):
        raw_token = auth_header.split(" ", 1)[1].strip()
    if not raw_token and auth:
        raw_token = auth

    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Bridge requires either `Authorization: Bearer <jwt>` or `?auth=<jwt>`.",
        )

    # Validate the same way `get_current_user` does (HS256 + JWT_SECRET).
    try:
        payload = jwt.decode(raw_token, settings.JWT_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(status_code=401, detail="Token expired") from exc
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid authentication token") from exc

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token payload invalid")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    bridge_token = _create_bridge_token(user)

    base = settings.OUTMATE_AGENTIC_BASE_URL.rstrip("/")
    target = (
        f"{base}/api/v1/auth/bridge"
        f"?token={quote_plus(bridge_token)}&next={quote_plus(next)}"
    )
    return RedirectResponse(url=target, status_code=302)


def user_response(user: User) -> dict:
    return {
        "id": str(user.id),
        "email": user.email,
        "name": user.full_name,
        "workspace": user.company_name,
        "credits": user.credits_balance,
        "plan": user.subscription_tier,
        "is_email_verified": bool(user.is_email_verified),
        # The frontend's AuthProvider checks onboarding_completed to decide
        # between dashboard and onboarding-wizard redirects after login.
        # Omitting these here causes the UI to always think the user hasn't
        # finished onboarding.  getattr() in case a row pre-dates the columns.
        "onboarding_completed": bool(getattr(user, "onboarding_completed", False)),
        "onboarding_step": int(getattr(user, "onboarding_step", None) or 1),
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

@router.get("/me")
async def get_me(user: User = Depends(get_current_user)):
    """Verify the current user's token and return their profile.

    Called by the frontend's AuthProvider on every app mount to rehydrate
    the session.  Must stay in sync with user_response().  A 404 here
    makes the frontend interpret it as 'session expired' and wipes
    localStorage, which looks like a login → logout loop to the user.
    """
    return {"user": user_response(user)}


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
    try:
        user = db.query(User).filter(User.email == body.email).first()
    except Exception as e:
        logger.error(f"Database error during login for {body.email}: {e}")
        # Development fallback: allow login with a dummy user if the database is not reachable.
        # This is intended only for local testing to unblock the UI when infra is misconfigured.
        if settings.ENVIRONMENT.lower() == "development":
            dummy = User(
                id=uuid.uuid4(),
                email=body.email,
                full_name="Local Dev User",
                company_name="Local Workspace",
                credits_balance=1000,
                subscription_tier="basic",
            )
            token = create_access_token(dummy)
            return {"token": token, "user": user_response(dummy)}
        raise HTTPException(status_code=503, detail="Database temporarily unavailable")

    if not user or not user.hashed_password or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    user.last_login_at = datetime.utcnow()
    try:
        db.commit()
    except Exception as e:
        logger.error(f"Database error updating last_login_at for {body.email}: {e}")
        # Don't fail the login if we can't update the timestamp

    token = create_access_token(user)

    if body.visitor_id or body.session_id:
        try:
            from app.tasks.visitors import apply_identity_event
            await apply_identity_event(str(user.id), {
                "visitor_id": body.visitor_id,
                "session_id": body.session_id,
                "identity_traits": {
                    "email": user.email,
                    "full_name": user.full_name,
                    "company_name": user.company_name,
                    "event_source": "app_login",
                },
            })
        except Exception as exc:
            logger.warning("Login identity stitching failed for %s: %s", user.email, exc)

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
    if body.visitor_id or body.session_id:
        try:
            from app.tasks.visitors import apply_identity_event
            await apply_identity_event(str(user.id), {
                "visitor_id": body.visitor_id,
                "session_id": body.session_id,
                "identity_traits": {
                    "email": user.email,
                    "full_name": user.full_name,
                    "company_name": user.company_name,
                    "event_source": "google_login",
                },
            })
        except Exception as exc:
            logger.warning("Google login identity stitching failed for %s: %s", user.email, exc)
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


# ─── Google OAuth2 (authorization-code flow with Gmail scope) ────────────────

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_SCOPES = "openid email profile https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/calendar.readonly"


@router.get("/google/auth-url")
async def google_oauth_url(terms_accepted: bool = False):
    """Return a Google OAuth2 authorization URL that includes Gmail send scope."""
    client_id = settings.GOOGLE_CLIENT_ID
    if not client_id:
        raise HTTPException(status_code=503, detail="Google OAuth is not configured")

    redirect_uri = os.getenv(
        "GOOGLE_REDIRECT_URI",
        "http://localhost:8000/api/v1/auth/google/callback",
    )
    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": GOOGLE_SCOPES,
        "access_type": "offline",
        "prompt": "consent",
        "state": f"terms={terms_accepted}",
    }
    return {"auth_url": f"{GOOGLE_AUTH_URL}?{urlencode(params)}"}


@router.get("/google/callback")
async def google_oauth_callback(
    code: str,
    state: str = "",
    db: Session = Depends(get_db),
):
    """Exchange Google authorization code for tokens, create/update user, redirect to frontend."""
    client_id = settings.GOOGLE_CLIENT_ID
    client_secret = settings.GOOGLE_CLIENT_SECRET
    if not client_id or not client_secret:
        logger.error("Google OAuth not configured - missing client_id or client_secret")
        frontend_base = os.getenv("APP_WEBHOOK_URL", "http://localhost:3000").rstrip("/")
        return RedirectResponse(url=f"{frontend_base}/auth/login?error=google_not_configured")

    redirect_uri = os.getenv(
        "GOOGLE_REDIRECT_URI",
        "http://localhost:8000/api/v1/auth/google/callback",
    )

    try:
        # Exchange code for tokens
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(GOOGLE_TOKEN_URL, data={
                "code": code,
                "client_id": client_id,
                "client_secret": client_secret,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            })

        if resp.status_code != 200:
            logger.error("Google token exchange failed: %s", resp.text[:300])
            frontend_base = os.getenv("APP_WEBHOOK_URL", "http://localhost:3000").rstrip("/")
            return RedirectResponse(url=f"{frontend_base}/auth/login?error=google_token_exchange_failed")

        tokens = resp.json()
        access_token = tokens["access_token"]
        refresh_token = tokens.get("refresh_token")
        id_token_raw = tokens.get("id_token")

        # Decode id_token to get user info (unverified decode is fine here —
        # we just exchanged the code directly with Google over HTTPS).
        try:
            claims = jwt.decode(id_token_raw, options={"verify_signature": False})
        except Exception as e:
            logger.error(f"Failed to decode Google ID token: {e}")
            claims = {}

        google_id = claims.get("sub")
        email = claims.get("email", "").lower()
        name = claims.get("name") or claims.get("given_name", "")
        email_verified_by_google = claims.get("email_verified", False)

        if not email or not google_id:
            logger.error(f"Incomplete Google profile: email={email}, google_id={google_id}")
            frontend_base = os.getenv("APP_WEBHOOK_URL", "http://localhost:3000").rstrip("/")
            return RedirectResponse(url=f"{frontend_base}/auth/login?error=incomplete_google_profile")

        # Parse terms_accepted from state
        terms_accepted = "terms=True" in state or "terms=true" in state

        # Find or create user
        try:
            user = db.query(User).filter(User.google_id == google_id).first()
            if not user:
                user = db.query(User).filter(User.email == email).first()

            if user:
                if not user.google_id:
                    user.google_id = google_id
                if email_verified_by_google and not user.is_email_verified:
                    user.is_email_verified = True
                if not user.terms_accepted_at and terms_accepted:
                    user.terms_accepted_at = datetime.utcnow()
                user.gmail_access_token = access_token
                if refresh_token:
                    user.gmail_refresh_token = refresh_token
                user.last_login_at = datetime.utcnow()
                db.commit()
            else:
                if not terms_accepted:
                    frontend_base = os.getenv("APP_WEBHOOK_URL", "http://localhost:3000").rstrip("/")
                    return RedirectResponse(url=f"{frontend_base}/auth/signup?error=terms_required")
                user = User(
                    email=email,
                    full_name=name,
                    google_id=google_id,
                    hashed_password=None,
                    is_email_verified=bool(email_verified_by_google),
                    terms_accepted_at=datetime.utcnow(),
                    last_login_at=datetime.utcnow(),
                    gmail_access_token=access_token,
                    gmail_refresh_token=refresh_token,
                )
                db.add(user)
                db.commit()
                db.refresh(user)
        except Exception as e:
            logger.error(f"Database error during Google OAuth user creation/update: {e}")
            frontend_base = os.getenv("APP_WEBHOOK_URL", "http://localhost:3000").rstrip("/")
            return RedirectResponse(url=f"{frontend_base}/auth/login?error=database_error")

        jwt_token = create_access_token(user)
        frontend_base = os.getenv("APP_WEBHOOK_URL", "http://localhost:3000").rstrip("/")

        import base64
        user_json = base64.b64encode(
            __import__("json").dumps(user_response(user)).encode()
        ).decode()

        return RedirectResponse(
            url=f"{frontend_base}/auth/callback?token={jwt_token}&user={quote_plus(user_json)}"
        )
    except Exception as e:
        logger.error(f"Unexpected error in Google OAuth callback: {e}")
        frontend_base = os.getenv("APP_WEBHOOK_URL", "http://localhost:3000").rstrip("/")
        return RedirectResponse(url=f"{frontend_base}/auth/login?error=unexpected_error")


# ─── BYOK (Bring Your Own Key) Routes ────────────────────────────────────────

@router.post("/byok/setup")
async def setup_byok(
    request: ByokSetupRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Set up BYOK (Bring Your Own Key) for the user's Anthropic API key."""
    try:
        # In production, the API key should be encrypted before storage
        # For now, using plaintext is acceptable for MVP but should be encrypted
        user.anthropic_api_key = request.anthropic_api_key
        user.use_byok = request.use_byok
        db.commit()
        db.refresh(user)

        logger.info(f"BYOK setup for user {user.email}: enabled={request.use_byok}")

        return {
            "success": True,
            "message": "BYOK configured successfully",
            "use_byok": user.use_byok,
        }
    except Exception as e:
        logger.error(f"BYOK setup error: {e}")
        raise HTTPException(status_code=500, detail="Failed to set up BYOK")


@router.get("/byok/status")
async def get_byok_status(
    user: User = Depends(get_current_user),
) -> ByokStatusResponse:
    """Get BYOK status for the current user."""
    return ByokStatusResponse(
        use_byok=user.use_byok or False,
        has_key=bool(user.anthropic_api_key),
    )


@router.post("/byok/disable")
async def disable_byok(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Disable BYOK and clear the stored API key."""
    try:
        user.use_byok = False
        user.anthropic_api_key = None
        db.commit()

        logger.info(f"BYOK disabled for user {user.email}")

        return {
            "success": True,
            "message": "BYOK disabled successfully",
        }
    except Exception as e:
        logger.error(f"BYOK disable error: {e}")
        raise HTTPException(status_code=500, detail="Failed to disable BYOK")


# ─── Onboarding / ICP / Settings ────────────────────────────────────────────
# These were accidentally dropped from the local codebase by a merge but the
# frontend at prod SHA 066fd6d5 still calls them.  Losing them caused 404s on
# every settings save and a logout loop on /me checks.  Restoring keeps the
# frontend contract intact.  Underlying DB columns live on `users` — see
# app/db/models/user.py for the migration-backed schema.

@router.post("/onboarding/update")
async def update_onboarding(
    body: OnboardingUpdateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Patch the authenticated user's onboarding progress.

    Every field is optional; only the ones present in the request body get
    written.  `icp_config` is versioned — we bump the `version` counter and
    stamp `created_at` / `updated_at` so the frontend can detect staleness
    without another round-trip.
    """
    try:
        if body.step is not None:
            user.onboarding_step = body.step
        if body.completed is not None:
            user.onboarding_completed = body.completed
        if body.website_url is not None:
            user.website_url = body.website_url
        if body.user_role is not None:
            user.user_role = body.user_role
        if body.onboarding_data is not None:
            user.onboarding_data = body.onboarding_data
        if body.icp_config is not None:
            now = datetime.utcnow().isoformat()
            existing = user.icp_config or {}
            version = int(existing.get("version") or 0) + 1
            user.icp_config = {
                **body.icp_config,
                "version": version,
                "created_at": existing.get("created_at", now),
                "updated_at": now,
            }
        db.commit()
        db.refresh(user)
        return {"success": True, "user": user_response(user)}
    except Exception as e:
        logger.error("Onboarding update error: %s", e)
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update onboarding progress")


@router.get("/icp")
async def get_icp_config(user: User = Depends(get_current_user)):
    """Return the authenticated user's current ICP configuration."""
    return {"success": True, "icp_config": user.icp_config or {}}


@router.post("/icp/update")
async def update_icp_config(
    body: ICPConfigRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Replace the user's ICP configuration.  Unlike /onboarding/update this
    overwrites the five core ICP lists atomically rather than merging."""
    try:
        now = datetime.utcnow().isoformat()
        existing = user.icp_config or {}
        version = int(existing.get("version") or 0) + 1
        user.icp_config = {
            "industries": body.industries or [],
            "company_sizes": body.company_sizes or [],
            "geographies": body.geographies or [],
            "job_titles": body.job_titles or [],
            "funding_stages": body.funding_stages or [],
            "version": version,
            "created_at": existing.get("created_at", now),
            "updated_at": now,
        }
        db.commit()
        db.refresh(user)
        return {"success": True, "version": version, "icp_config": user.icp_config}
    except Exception as e:
        logger.error("ICP config update error: %s", e)
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update ICP configuration")


@router.post("/update-profile")
async def update_profile(
    body: UpdateProfileRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update basic profile fields on the user row.

    Note: the User ORM column is `full_name`, not `name` — the prod version
    of this endpoint assigned `current_user.name = request.name` which
    silently created an attribute on the instance but never persisted to
    Postgres.  Fixed here to write the right column.
    """
    try:
        if body.name is not None:
            user.full_name = body.name
        db.commit()
        return {"success": True, "message": "Profile updated"}
    except Exception as e:
        logger.error("Profile update error: %s", e)
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update profile")


@router.post("/update-workspace")
async def update_workspace(
    body: UpdateWorkspaceRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update workspace settings — name, plan, billing email."""
    try:
        onboarding = user.onboarding_data or {}
        if body.name is not None:
            onboarding["org_name"] = body.name
        if body.plan is not None:
            onboarding["plan"] = body.plan
        if body.billing_email is not None:
            onboarding["billing_email"] = body.billing_email
        user.onboarding_data = onboarding
        db.commit()
        return {"success": True, "message": "Workspace updated"}
    except Exception as e:
        logger.error("Workspace update error: %s", e)
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update workspace")


@router.post("/update-notifications")
async def update_notifications(
    body: UpdateNotificationsRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update notification preferences inside user.integrations.notifications."""
    try:
        integrations = user.integrations or {}
        prefs = dict(integrations.get("notifications") or {})
        field_map = {
            "email_notifications": "email",
            "slack_notifications": "slack",
            "new_leads": "newLeads",
            "campaign_updates": "campaigns",
            "signal_alerts": "signals",
            "weekly_report": "weeklyReport",
        }
        for request_field, pref_key in field_map.items():
            value = getattr(body, request_field, None)
            if value is not None:
                prefs[pref_key] = value
        integrations["notifications"] = prefs
        user.integrations = integrations
        db.commit()
        return {"success": True, "message": "Notification preferences updated"}
    except Exception as e:
        logger.error("Notifications update error: %s", e)
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update notifications")
