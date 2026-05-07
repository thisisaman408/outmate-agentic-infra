"""Integration status endpoint.

Returns the catalog of GTM integrations the agentic backend knows about,
with `connected` flags computed from env-var presence. Used by the new
workflow editor's Settings tab + Build sidebar to render real status badges.

This is intentionally lightweight: integrations are external services
configured via env (or via the user's Variable table). When the user wires
real provider clients later, swap each entry's check for a richer status.
"""

from __future__ import annotations

import os

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import select

from outmate.api.utils import CurrentActiveUser, DbSession
from outmate.services.database.models.variable.model import Variable

router = APIRouter(prefix="/integrations", tags=["Integrations"])


class IntegrationStatus(BaseModel):
    id: str
    name: str
    category: str
    sub_label: str | None = None
    connected: bool


# id  →  (display name, category, sub_label, env var name(s) to check, variable name(s))
_CATALOG: list[tuple[str, str, str, str | None, list[str], list[str]]] = [
    ("predict", "Predict Data Room", "integrations", "Buyer Intent",
     ["PREDICT_DATA_ROOM_API_KEY", "PREDICT_API_KEY"], ["predict_api_key"]),
    ("people-data-labs", "People Data Labs", "integrations", "Enrichment",
     ["PEOPLE_DATA_LABS_API_KEY", "PDL_API_KEY"], ["pdl_api_key"]),
    ("zoominfo", "ZoomInfo", "integrations", "Enrichment",
     ["ZOOMINFO_API_KEY"], ["zoominfo_api_key"]),
    ("clearbit", "Clearbit", "integrations", "Enrichment",
     ["CLEARBIT_API_KEY"], ["clearbit_api_key"]),
    ("hunter", "Hunter.io", "integrations", "Enrichment",
     ["HUNTER_API_KEY", "HUNTER_IO_API_KEY"], ["hunter_api_key"]),
    ("apollo", "Apollo", "integrations", "Enrichment",
     ["APOLLO_API_KEY"], ["apollo_api_key"]),
    ("hubspot", "HubSpot", "integrations", "CRM",
     ["HUBSPOT_API_KEY"], ["hubspot_api_key"]),
    ("salesforce", "Salesforce", "integrations", "CRM",
     ["SALESFORCE_API_KEY", "SALESFORCE_CLIENT_ID"], ["salesforce_api_key"]),
    ("smartlead", "Smartlead", "integrations", "Email",
     ["SMARTLEAD_API_KEY"], ["smartlead_api_key"]),
    ("slack", "Slack", "integrations", "Communication",
     ["SLACK_API_KEY", "SLACK_BOT_TOKEN", "SLACK_WEBHOOK_URL"], ["slack_token"]),
    ("twilio", "Twilio", "integrations", "Communication",
     ["TWILIO_API_KEY", "TWILIO_AUTH_TOKEN"], ["twilio_api_key"]),
    ("zoom", "Zoom", "integrations", "Meeting",
     ["ZOOM_API_KEY", "ZOOM_CLIENT_ID"], ["zoom_api_key"]),
    ("webhook", "Webhook", "integrations", "Developer",
     [], []),  # always "available" (no key needed)
    ("rest-api", "REST API", "integrations", "Developer",
     [], []),
]


def _has_env(keys: list[str]) -> bool:
    return any(bool(os.environ.get(k)) for k in keys)


@router.get(
    "/status",
    response_model=list[IntegrationStatus],
    summary="List integrations and their connection status",
)
async def list_integration_status(
    user: CurrentActiveUser,
    db: DbSession,
) -> list[IntegrationStatus]:
    # Pull the user's Variable table once.
    rows = (
        await db.exec(
            select(Variable).where(Variable.user_id == user.id)
        )
    ).all()
    user_var_names = {v.name.lower() for v in rows if v.name}

    out: list[IntegrationStatus] = []
    for entry in _CATALOG:
        ident, name, category, sub_label, env_keys, var_names = entry
        if ident in {"webhook", "rest-api"}:
            connected = True
        else:
            connected = _has_env(env_keys) or any(
                v.lower() in user_var_names for v in var_names
            )
        out.append(
            IntegrationStatus(
                id=ident,
                name=name,
                category=category,
                sub_label=sub_label,
                connected=connected,
            )
        )
    return out
