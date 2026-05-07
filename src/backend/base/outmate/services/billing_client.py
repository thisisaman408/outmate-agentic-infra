"""Billing client: posts agentic-run records to the main Outmate backend.

Runs as a fire-and-forget side effect of every flow build. We deliberately
swallow errors locally — losing a billing record for a single run shouldn't
fail the user's run. Persistent reconciliation lives in the main backend
(operators can replay missing rows from `vertex_build` history).
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
import jwt
from lfx.log.logger import logger

from outmate.services.deps import get_settings_service


_SYSTEM_TOKEN_TYPE = "outmate_system"
_DEFAULT_TIMEOUT_SECONDS = 5.0


def _bridge_secret() -> str | None:
    """Read the shared bridge secret. Same secret as the user-facing bridge.

    `BRIDGE_SECRET` doubles as the system-call secret because both signers
    are processes we trust (main backend, agentic backend). The token type
    discriminator (`type: "outmate_system"` vs `"outmate_bridge"`) keeps the
    two clearly separated semantically.
    """
    settings = get_settings_service().auth_settings
    secret = getattr(settings, "BRIDGE_SECRET", None)
    if secret is None:
        return None
    return secret.get_secret_value() if hasattr(secret, "get_secret_value") else str(secret)


def _main_backend_url() -> str:
    """Where to POST billing events. Override via OUTMATE_MAIN_BACKEND_URL."""
    return os.environ.get("OUTMATE_MAIN_BACKEND_URL", "http://localhost:8000")


def _mint_system_token(secret: str) -> str:
    payload = {
        "type": _SYSTEM_TOKEN_TYPE,
        "iss": "agentic",
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(seconds=60),
    }
    return jwt.encode(payload, secret, algorithm="HS256")


async def record_agentic_run(
    *,
    user_id: str,
    flow_id: str | None,
    run_id: str | None,
    success: bool,
    duration_ms: int | None = None,
    agent_type: str | None = None,
    tokens_input: int | None = None,
    tokens_output: int | None = None,
    model: str | None = None,
    error_message: str | None = None,
) -> None:
    """Fire-and-forget: tell the main backend a run completed so it can charge.

    Returns silently on any error (network, 5xx, timeout, missing secret).
    The caller should NEVER let a billing failure abort the user's flow.
    """
    secret = _bridge_secret()
    if not secret:
        # Bridge not configured → billing is unwired; this is fine in dev.
        return

    if not user_id:
        # No user attribution possible (would happen for legacy AUTO_LOGIN
        # superuser builds, which we don't bill anyway).
        return

    body: dict[str, Any] = {
        "user_id": user_id,
        "flow_id": flow_id,
        "run_id": run_id,
        "success": success,
        "duration_ms": duration_ms,
        "agent_type": agent_type,
        "tokens_input": tokens_input,
        "tokens_output": tokens_output,
        "model": model,
        "error_message": error_message,
    }
    headers = {"X-Outmate-System": _mint_system_token(secret)}
    url = f"{_main_backend_url().rstrip('/')}/api/v1/billing/agentic-run"

    try:
        async with httpx.AsyncClient(timeout=_DEFAULT_TIMEOUT_SECONDS) as client:
            resp = await client.post(url, json=body, headers=headers)
        if resp.status_code >= 400:
            logger.warning(
                "Billing post returned %s for run %s: %s",
                resp.status_code,
                run_id,
                resp.text[:300],
            )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Billing post failed for run %s: %s", run_id, exc)
