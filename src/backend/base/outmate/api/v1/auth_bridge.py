"""Cross-stack SSO bridge.

Lets the main Outmate backend (`Backend/app`, :8000) hand a logged-in user off
to the agentic stack (this process, :7860) without that user ever needing to
authenticate twice.

Flow
----
1. User logs in at :3000 / :8000.
2. Frontend wants to send the user to a flow at :7860/flow/<id>.
3. Frontend hits `:8000/api/auth/agentic-bridge?next=/flow/<id>`.
4. Main backend mints a short-lived bridge JWT signed with the shared
   `OUTMATE_AUTH_SECRET` (HS256). Payload:
       { sub:  <main_user_id>,
         email, name,
         type: "outmate_bridge",
         exp:  <now + 60s>,
         iat:  <now>,
         jti:  <random uuid> }
5. Main backend redirects the browser to
       `:7860/api/v1/auth/bridge?token=<jwt>&next=/flow/<id>`.
6. THIS endpoint validates the JWT, looks up (or auto-provisions) the agentic
   User keyed by the SAME UUID as the main user, mints the agentic stack's
   normal `access_token_lf` cookie via `auth_service.create_user_tokens`, and
   redirects to `next`.

The agentic User table's `id` IS the main user's UUID — both stacks share the
same UUID so anything keyed off `current_user.id` (flows, vertex builds,
agent runs, credits) lines up automatically across processes.

If `BRIDGE_SECRET` is unset, this endpoint returns 503; the agentic stack
falls back to AUTO_LOGIN (current dev behavior).
"""

from __future__ import annotations

import secrets as _secrets
from datetime import datetime, timezone
from typing import Annotated
from urllib.parse import quote, urlparse, urlunparse
from uuid import UUID

import jwt
from fastapi import APIRouter, HTTPException, Query, Request, Response, status
from fastapi.responses import RedirectResponse

from outmate.api.utils import DbSession
from outmate.services.database.models.user.crud import get_user_by_id
from outmate.services.database.models.user.model import User
from outmate.services.deps import get_auth_service, get_settings_service

router = APIRouter(prefix="/auth", tags=["AuthBridge"])


_BRIDGE_TOKEN_TYPE = "outmate_bridge"


def _bridge_secret() -> str | None:
    """Resolve the shared bridge secret. Returns None if not configured."""
    auth_settings = get_settings_service().auth_settings
    secret = getattr(auth_settings, "BRIDGE_SECRET", None)
    if secret is None:
        return None
    # Pydantic SecretStr → str
    return secret.get_secret_value() if hasattr(secret, "get_secret_value") else str(secret)


def _safe_redirect_target(next_url: str | None) -> str:
    """Restrict the redirect to relative paths on this host.

    Open-redirect is the classic abuse here — a bridge that accepts arbitrary
    `next` becomes a phishing tool. We accept only paths starting with `/`,
    falling back to the canvas root if anything else is supplied.
    """
    if not next_url:
        return "/all"
    parsed = urlparse(next_url)
    # Reject anything with a scheme/host (`https://attacker.com/`).
    if parsed.scheme or parsed.netloc:
        return "/all"
    if not next_url.startswith("/"):
        return "/all"
    return next_url


@router.get("/bridge", include_in_schema=False)
async def bridge(
    response: Response,
    request: Request,
    db: DbSession,
    token: Annotated[str, Query(...)],
    next: Annotated[str | None, Query()] = None,
) -> RedirectResponse:
    """Validate a main-stack bridge JWT, set the agentic access cookie, redirect.

    The redirect target is sanitized to a relative path on this host so the
    bridge cannot be used as an open-redirect.
    """
    secret = _bridge_secret()
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "SSO bridge is disabled — set OUTMATE_BRIDGE_SECRET on this "
                "process and on the main Outmate backend to enable it."
            ),
        )

    auth_settings = get_settings_service().auth_settings
    algorithm = auth_settings.ALGORITHM or "HS256"

    # Decode + validate the bridge JWT.
    try:
        payload = jwt.decode(token, secret, algorithms=[algorithm])
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(status_code=401, detail="Bridge token expired") from exc
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=401, detail=f"Invalid bridge token: {exc!s}") from exc

    if payload.get("type") != _BRIDGE_TOKEN_TYPE:
        raise HTTPException(status_code=401, detail="Wrong token type")

    sub = payload.get("sub")
    if not sub:
        raise HTTPException(status_code=400, detail="Bridge token missing 'sub'")
    try:
        user_id = UUID(str(sub))
    except (ValueError, TypeError) as exc:
        raise HTTPException(status_code=400, detail="Bridge token sub must be a UUID") from exc

    # Look up or auto-provision the agentic user. We deliberately reuse the
    # main user's UUID so anything keyed by user_id (flows, builds, runs)
    # is automatically scoped to that user without an extra mapping table.
    user = await get_user_by_id(db, user_id)
    if user is None:
        email = payload.get("email") or f"user-{user_id}@bridge.local"
        username = email if isinstance(email, str) and email else str(user_id)
        # Random password — the agentic stack will never need it again because
        # all auth flows now go through the bridge.
        random_password = _secrets.token_urlsafe(32)
        # Hash via the auth service's existing pwd_context.
        hashed = auth_settings.pwd_context.hash(random_password)
        user = User(
            id=user_id,
            username=username,
            password=hashed,
            is_active=True,
            is_superuser=False,
            create_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    if not user.is_active:
        raise HTTPException(status_code=403, detail="User is inactive")

    # Mint the agentic access + refresh cookies via the auth service. This
    # is the SAME path /api/v1/login uses, so the resulting cookies look
    # identical to a normal Langflow login.
    auth = get_auth_service()
    tokens = await auth.create_user_tokens(user_id=user.id, db=db, update_last_login=True)

    target = _safe_redirect_target(next)
    redirect = RedirectResponse(url=target, status_code=302)
    redirect.set_cookie(
        "access_token_lf",
        tokens["access_token"],
        httponly=auth_settings.ACCESS_HTTPONLY,
        samesite=auth_settings.ACCESS_SAME_SITE,
        secure=auth_settings.ACCESS_SECURE,
        expires=auth_settings.ACCESS_TOKEN_EXPIRE_SECONDS,
        domain=auth_settings.COOKIE_DOMAIN,
    )
    redirect.set_cookie(
        "refresh_token_lf",
        tokens["refresh_token"],
        httponly=auth_settings.REFRESH_HTTPONLY,
        samesite=auth_settings.REFRESH_SAME_SITE,
        secure=auth_settings.REFRESH_SECURE,
        expires=auth_settings.REFRESH_TOKEN_EXPIRE_SECONDS,
        domain=auth_settings.COOKIE_DOMAIN,
    )
    if user.store_api_key is not None:
        redirect.set_cookie(
            "apikey_tkn_lflw",
            str(user.store_api_key),
            httponly=auth_settings.ACCESS_HTTPONLY,
            samesite=auth_settings.ACCESS_SAME_SITE,
            secure=auth_settings.ACCESS_SECURE,
            expires=None,
            domain=auth_settings.COOKIE_DOMAIN,
        )
    return redirect
