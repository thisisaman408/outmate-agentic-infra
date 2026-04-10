"""Resolve agentic infra flow IDs by name instead of hardcoding UUIDs.

The outmate-agentic engine regenerates flow UUIDs on every cold start from
starter project JSONs.  This module queries the engine's ``GET /flows/``
endpoint, finds the target flow by name, and caches the result for the
lifetime of the Backend process.

Usage::

    from app.core.agentic_flow_resolver import get_social_listening_flow

    flow_id, node_id = get_social_listening_flow()
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# Flow names to search for, in priority order.  The agentic engine may have
# the dedicated Social Listening Agent (from agentic/flows/) or the generic
# Social Media Agent (from starter_projects/).  We prefer the dedicated one.
FLOW_NAME_CANDIDATES = [
    "Social Listening Agent",
    "Social Media Agent",
]

# Node types that can serve as the main processing node.
TARGET_NODE_TYPES = {"LeadDiscoveryOutreachAgent", "Agent"}


@dataclass
class _ResolvedFlow:
    flow_id: str
    node_id: str
    node_type: str  # "LeadDiscoveryOutreachAgent" or "Agent"


_cache: Optional[_ResolvedFlow] = None
_token_cache: Optional[str] = None


def get_social_listening_flow() -> Tuple[str, str, str]:
    """Return ``(flow_id, node_id, node_type)`` for the social listening flow.

    ``node_type`` is ``"LeadDiscoveryOutreachAgent"`` or ``"Agent"`` —
    callers use this to decide how to build the tweaks payload.

    Uses a process-level cache so the HTTP lookup only happens once.
    Falls back to static settings if the agentic engine is unreachable.
    """
    global _cache
    if _cache is not None:
        return _cache.flow_id, _cache.node_id, _cache.node_type

    fallback = (
        settings.AGENTIC_INFRA_SOCIAL_LISTENING_FLOW_ID,
        settings.AGENTIC_INFRA_SOCIAL_LISTENING_NODE_ID,
        "LeadDiscoveryOutreachAgent",
    )

    if not settings.AGENTIC_INFRA_URL:
        logger.warning("AGENTIC_INFRA_URL not set — using static flow IDs")
        return fallback

    try:
        result = _resolve_from_api()
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "Could not resolve Social Listening flow from agentic infra: %s — "
            "falling back to static IDs (flow=%s, node=%s)",
            exc,
            fallback[0],
            fallback[1],
        )
        return fallback

    if result is None:
        logger.warning(
            "Flow not found on agentic infra (tried %s) — falling back to static IDs",
            FLOW_NAME_CANDIDATES,
        )
        return fallback

    _cache = result
    logger.info(
        "Resolved Social Listening flow: flow_id=%s node_id=%s node_type=%s",
        result.flow_id,
        result.node_id,
        result.node_type,
    )
    return result.flow_id, result.node_id, result.node_type


def refresh() -> Tuple[str, str, str]:
    """Force a fresh lookup (e.g. after the agentic engine restarts)."""
    global _cache, _token_cache
    _cache = None
    _token_cache = None
    return get_social_listening_flow()


def get_agentic_auth_headers() -> Dict[str, str]:
    """Return auth headers for calling the agentic infra.

    In production: ``x-api-key`` header.
    In dev: Bearer token obtained via the auto-login endpoint.
    """
    global _token_cache
    headers: Dict[str, str] = {"Content-Type": "application/json"}

    if settings.AGENTIC_INFRA_API_KEY:
        headers["x-api-key"] = settings.AGENTIC_INFRA_API_KEY
        return headers

    # Dev mode: get a bearer token from auto-login.
    if _token_cache:
        headers["Authorization"] = f"Bearer {_token_cache}"
        return headers

    if not settings.AGENTIC_INFRA_URL:
        return headers

    try:
        with httpx.Client(timeout=10) as client:
            token = _get_auth_token(client)
            if token:
                _token_cache = token
                headers["Authorization"] = f"Bearer {token}"
    except Exception:  # noqa: BLE001
        pass

    return headers


# ---------------------------------------------------------------------------
# Internal
# ---------------------------------------------------------------------------


def _get_auth_token(client: httpx.Client) -> Optional[str]:
    """Obtain a bearer token via the auto-login endpoint (dev mode)."""
    if settings.AGENTIC_INFRA_API_KEY:
        return None  # production uses x-api-key, not bearer
    try:
        resp = client.get(
            f"{settings.AGENTIC_INFRA_URL.rstrip('/')}/api/v1/auto_login",
        )
        if resp.status_code == 200:
            return resp.json().get("access_token")
    except Exception:  # noqa: BLE001
        pass
    return None


def _resolve_from_api() -> Optional[_ResolvedFlow]:
    """Query the agentic infra and find the flow + node by name."""
    base = settings.AGENTIC_INFRA_URL.rstrip("/")

    with httpx.Client(timeout=15) as client:
        headers: Dict[str, str] = {}
        if settings.AGENTIC_INFRA_API_KEY:
            headers["x-api-key"] = settings.AGENTIC_INFRA_API_KEY
        else:
            token = _get_auth_token(client)
            if token:
                headers["Authorization"] = f"Bearer {token}"

        resp = client.get(f"{base}/api/v1/flows/", headers=headers)
        resp.raise_for_status()
        flows: List[Dict[str, Any]] = resp.json()

    # Find the flow by name (case-insensitive), trying candidates in priority order.
    flow_by_name: Dict[str, Dict[str, Any]] = {}
    for flow in flows:
        flow_by_name[(flow.get("name") or "").strip().lower()] = flow

    target_flow: Optional[Dict[str, Any]] = None
    for candidate in FLOW_NAME_CANDIDATES:
        target_flow = flow_by_name.get(candidate.lower())
        if target_flow is not None:
            break

    if target_flow is None:
        return None

    flow_id = target_flow["id"]

    # Find the agent node inside the flow, preferring LeadDiscoveryOutreachAgent.
    node_id = settings.AGENTIC_INFRA_SOCIAL_LISTENING_NODE_ID  # fallback
    node_type = "Agent"  # fallback
    for node in target_flow.get("data", {}).get("nodes", []):
        nd = node.get("data", {})
        ntype = nd.get("type", "")
        if ntype in TARGET_NODE_TYPES:
            node_id = nd.get("id", node_id)
            node_type = ntype
            break

    return _ResolvedFlow(flow_id=flow_id, node_id=node_id, node_type=node_type)
