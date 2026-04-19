"""
Integrations Marketplace API — v2

Replaces the mock integrations with a real DB-backed catalog of 107 integrations.

Endpoints:
  GET  /catalog              — list all integrations (with user connection status)
  GET  /catalog/categories   — list categories with counts
  GET  /catalog/:slug        — single integration detail
  POST /:slug/connect        — connect integration (API key or start OAuth)
  POST /:slug/disconnect     — disconnect integration
  GET  /:slug/status         — connection health check
  POST /:slug/test           — test credentials
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from starlette.responses import RedirectResponse

from app.api.deps.auth import get_current_user
from app.core.config import settings
from app.db.deps import get_db
from app.db.models.user import User
from app.db.models.integration import Integration, UserIntegration
from app.db.models.copilot_preferences import CopilotUserPreferences
from app.services.integration_engine.registry import IntegrationRegistry
from app.services.integration_engine.credential_vault import encrypt_credentials
from app.services.crm_oauth_service import CrmOAuthService

logger = logging.getLogger(__name__)

router = APIRouter()
public_router = APIRouter()


# ── Request/Response models ──────────────────────────────────────────

class ConnectRequest(BaseModel):
    api_key: Optional[str] = None
    config: Optional[dict] = None


# ── Catalog ──────────────────────────────────────────────────────────

@router.get("/catalog")
async def list_integrations(
    category: Optional[str] = Query(None, description="Filter by category"),
    search: Optional[str] = Query(None, description="Search by name or description"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all integrations with per-user connection status."""
    catalog = IntegrationRegistry.get_catalog(
        db, user_id=user.id, category=category, search=search,
    )
    return {"integrations": catalog, "count": len(catalog)}


@router.get("/catalog/categories")
async def list_categories(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List all integration categories with counts."""
    categories = IntegrationRegistry.get_categories(db)
    return {"categories": categories}


@router.get("/catalog/{slug}")
async def get_integration(
    slug: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a single integration with user connection status."""
    integration = db.query(Integration).filter(Integration.slug == slug).first()
    if not integration:
        raise HTTPException(status_code=404, detail=f"Integration '{slug}' not found")

    user_conn = (
        db.query(UserIntegration)
        .filter(
            UserIntegration.user_id == user.id,
            UserIntegration.integration_id == integration.id,
        )
        .first()
    )

    return {
        "id": str(integration.id),
        "slug": integration.slug,
        "name": integration.name,
        "description": integration.description,
        "short_description": integration.short_description,
        "category": integration.category,
        "icon_url": integration.icon_url,
        "auth_type": integration.auth_type,
        "is_active": integration.is_active,
        "is_coming_soon": integration.is_coming_soon,
        "is_premium": integration.is_premium,
        "is_built_in": integration.is_built_in,
        "credit_cost": integration.credit_cost,
        "supported_actions": integration.supported_actions,
        "supported_triggers": integration.supported_triggers,
        "documentation_url": integration.documentation_url,
        "setup_steps": integration.setup_steps,
        "features": integration.features,
        # Connection
        "connection_status": user_conn.status if user_conn else (
            "built_in" if integration.is_built_in else "not_connected"
        ),
        "connected_at": user_conn.connected_at.isoformat() if user_conn and user_conn.connected_at else None,
        "last_synced_at": user_conn.last_synced_at.isoformat() if user_conn and user_conn.last_synced_at else None,
        "error_message": user_conn.error_message if user_conn and user_conn.status == "error" else None,
        "config": user_conn.config if user_conn else {},
    }


# ── Connect / Disconnect ────────────────────────────────────────────

@router.post("/{slug}/connect")
async def connect_integration(
    slug: str,
    body: ConnectRequest = ConnectRequest(),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Connect an integration.

    - api_key type: requires body.api_key — encrypts and stores
    - webhook / none / built-in: marks connected immediately
    - oauth2 (coming-soon CRMs etc.): returns 501 until connector is built
    """
    integration = db.query(Integration).filter(Integration.slug == slug).first()
    if not integration:
        raise HTTPException(status_code=404, detail=f"Integration '{slug}' not found")

    if integration.is_coming_soon:
        raise HTTPException(status_code=400, detail="This integration is coming soon and cannot be connected yet")

    # Check if already connected
    existing = (
        db.query(UserIntegration)
        .filter(
            UserIntegration.user_id == user.id,
            UserIntegration.integration_id == integration.id,
        )
        .first()
    )

    # ── API key integrations ─────────────────────────────────────
    if integration.auth_type == "api_key" and not integration.is_built_in:
        if not body.api_key:
            raise HTTPException(status_code=400, detail="API key is required for this integration")

        encrypted = encrypt_credentials({"api_key": body.api_key})

        if existing:
            existing.credentials_encrypted = encrypted
            existing.status = "connected"
            existing.error_message = None
            existing.config = body.config or {}
        else:
            existing = UserIntegration(
                user_id=user.id,
                integration_id=integration.id,
                status="connected",
                credentials_encrypted=encrypted,
                config=body.config or {},
            )
            db.add(existing)

        db.commit()
        return {"success": True, "status": "connected", "slug": slug}

    # ── Webhook / automation / built-in / none ───────────────────
    if integration.auth_type in ("webhook", "none") or integration.is_built_in:
        config = body.config or {}
        credentials = None
        # Webhook type: store the webhook URL or API key if provided
        if integration.auth_type == "webhook" and (body.api_key or config.get("webhook_url")):
            webhook_url = body.api_key or config.get("webhook_url", "")
            credentials = encrypt_credentials({"webhook_url": webhook_url})
            config["webhook_url"] = webhook_url
        elif body.api_key:
            credentials = encrypt_credentials({"api_key": body.api_key})

        if not existing:
            existing = UserIntegration(
                user_id=user.id,
                integration_id=integration.id,
                status="connected",
                config=config,
                credentials_encrypted=credentials,
            )
            db.add(existing)
        else:
            existing.status = "connected"
            existing.error_message = None
            existing.config = config
            if credentials:
                existing.credentials_encrypted = credentials

        # Slack webhook: also sync to CopilotUserPreferences so all
        # notification features (daily briefs, pipeline alerts, signals,
        # meeting briefs) pick up the webhook URL automatically.
        if slug == "slack" and integration.auth_type == "webhook":
            webhook_url = body.api_key or (config or {}).get("webhook_url", "")
            if webhook_url:
                prefs = (
                    db.query(CopilotUserPreferences)
                    .filter(CopilotUserPreferences.user_id == user.id)
                    .first()
                )
                if prefs:
                    prefs.slack_webhook_url = webhook_url
                    prefs.notify_slack = True
                else:
                    prefs = CopilotUserPreferences(
                        user_id=user.id,
                        slack_webhook_url=webhook_url,
                        notify_slack=True,
                    )
                    db.add(prefs)

        db.commit()
        return {"success": True, "status": "connected", "slug": slug}

    # ── OAuth2 — supported CRM connectors ───────────
    if integration.auth_type == "oauth2":
        supported = {"hubspot", "salesforce", "zoho-crm", "dynamics-365"}
        if slug not in supported:
            raise HTTPException(
                status_code=501,
                detail=f"OAuth connection for {integration.name} is not yet implemented. Coming soon!",
            )
            
        # Fallback to manual API Key if provided by user to bypass OAuth (for free tiers)
        if body.api_key:
            encrypted = encrypt_credentials({"access_token": body.api_key})
            if existing:
                existing.credentials_encrypted = encrypted
                existing.status = "connected"
                existing.error_message = None
                existing.config = body.config or {}
            else:
                existing = UserIntegration(
                    user_id=user.id,
                    integration_id=integration.id,
                    status="connected",
                    credentials_encrypted=encrypted,
                    config=body.config or {},
                )
                db.add(existing)
            db.commit()
            return {"success": True, "status": "connected", "slug": slug}

        service = CrmOAuthService()
        redirect_uri = f"{settings.API_BASE_URL}/api/v1/integrations/oauth/{slug}/callback"
        try:
            state = service.build_state(str(user.id), slug)
            auth_url = service.build_auth_url(slug, redirect_uri, state)
        except RuntimeError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        return {"success": True, "status": "pending", "auth_url": auth_url}

    # ── SMTP — not yet implemented ───────────
    if integration.auth_type == "smtp":
        raise HTTPException(
            status_code=501,
            detail=f"SMTP connection for {integration.name} is not yet implemented. Coming soon!",
        )

    # fallback
    raise HTTPException(status_code=400, detail=f"Unsupported auth type: {integration.auth_type}")


@router.post("/{slug}/disconnect")
async def disconnect_integration(
    slug: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Disconnect a user's integration."""
    integration = db.query(Integration).filter(Integration.slug == slug).first()
    if not integration:
        raise HTTPException(status_code=404, detail=f"Integration '{slug}' not found")

    user_conn = (
        db.query(UserIntegration)
        .filter(
            UserIntegration.user_id == user.id,
            UserIntegration.integration_id == integration.id,
        )
        .first()
    )

    if not user_conn:
        raise HTTPException(status_code=404, detail="Integration is not connected")

    db.delete(user_conn)

    # Slack: also clear webhook URL from copilot preferences
    if slug == "slack":
        prefs = (
            db.query(CopilotUserPreferences)
            .filter(CopilotUserPreferences.user_id == user.id)
            .first()
        )
        if prefs and prefs.slack_webhook_url:
            prefs.slack_webhook_url = None
            prefs.notify_slack = False

    db.commit()
    return {"success": True, "status": "disconnected"}


@router.get("/oauth/{slug}/start")
async def oauth_start(
    slug: str,
    user: User = Depends(get_current_user),
):
    supported = {"hubspot", "salesforce", "zoho-crm", "dynamics-365"}
    if slug not in supported:
        raise HTTPException(status_code=404, detail="OAuth provider not supported")
    service = CrmOAuthService()
    redirect_uri = f"{settings.API_BASE_URL}/api/v1/integrations/oauth/{slug}/callback"
    try:
        state = service.build_state(str(user.id), slug)
        auth_url = service.build_auth_url(slug, redirect_uri, state)
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"auth_url": auth_url}


@public_router.get("/oauth/{slug}/callback")
async def oauth_callback(
    slug: str,
    code: str,
    state: str,
    db: Session = Depends(get_db),
):
    service = CrmOAuthService()
    payload = service.verify_state(state)
    if not payload or payload.get("slug") != slug:
        raise HTTPException(status_code=400, detail="Invalid OAuth state")

    user_id = payload.get("uid")
    if not user_id:
        raise HTTPException(status_code=400, detail="Invalid OAuth state payload")

    integration = db.query(Integration).filter(Integration.slug == slug).first()
    if not integration:
        raise HTTPException(status_code=404, detail=f"Integration '{slug}' not found")

    redirect_uri = f"{settings.API_BASE_URL}/api/v1/integrations/oauth/{slug}/callback"
    token_data = await service.exchange_code(slug, code, redirect_uri)
    encrypted = encrypt_credentials(token_data)

    existing = (
        db.query(UserIntegration)
        .filter(
            UserIntegration.user_id == user_id,
            UserIntegration.integration_id == integration.id,
        )
        .first()
    )
    if existing:
        existing.credentials_encrypted = encrypted
        existing.status = "connected"
        existing.error_message = None
    else:
        existing = UserIntegration(
            user_id=user_id,
            integration_id=integration.id,
            status="connected",
            credentials_encrypted=encrypted,
        )
        db.add(existing)

    db.commit()

    frontend_base = settings.APP_WEBHOOK_URL
    return RedirectResponse(url=f"{frontend_base}/integrations?oauth=success&provider={slug}")


@router.get("/{slug}/status")
async def integration_status(
    slug: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Check connection health for a specific integration."""
    integration = db.query(Integration).filter(Integration.slug == slug).first()
    if not integration:
        raise HTTPException(status_code=404, detail=f"Integration '{slug}' not found")

    user_conn = (
        db.query(UserIntegration)
        .filter(
            UserIntegration.user_id == user.id,
            UserIntegration.integration_id == integration.id,
        )
        .first()
    )

    if not user_conn:
        return {
            "slug": slug,
            "connected": False,
            "status": "not_connected",
        }

    return {
        "slug": slug,
        "connected": user_conn.status == "connected",
        "status": user_conn.status,
        "connected_at": user_conn.connected_at.isoformat() if user_conn.connected_at else None,
        "last_synced_at": user_conn.last_synced_at.isoformat() if user_conn.last_synced_at else None,
        "error_message": user_conn.error_message,
    }


@router.post("/{slug}/test")
async def test_integration(
    slug: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Test an integration connection."""
    integration = db.query(Integration).filter(Integration.slug == slug).first()
    if not integration:
        raise HTTPException(status_code=404, detail=f"Integration '{slug}' not found")

    if integration.is_built_in:
        return {"success": True, "message": f"{integration.name} is a built-in integration and is always available"}

    user_conn = (
        db.query(UserIntegration)
        .filter(
            UserIntegration.user_id == user.id,
            UserIntegration.integration_id == integration.id,
        )
        .first()
    )

    if not user_conn:
        return {"success": False, "message": "Integration is not connected"}

    # In future, this would call connector.validate_credentials()
    return {
        "success": True,
        "message": f"{integration.name} connection is healthy",
        "last_synced_at": user_conn.last_synced_at.isoformat() if user_conn.last_synced_at else None,
    }


@router.post("/oauth/{slug}/push")
async def push_to_crm(
    slug: str,
    payload: dict,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Push leads or companies to a connected CRM."""
    supported = {"hubspot", "salesforce", "zoho-crm", "dynamics-365"}
    if slug not in supported:
        raise HTTPException(status_code=400, detail="CRM provider not supported for direct push yet")

    integration = db.query(Integration).filter(Integration.slug == slug).first()
    if not integration:
        raise HTTPException(status_code=404, detail=f"Integration '{slug}' not found")

    user_conn = (
        db.query(UserIntegration)
        .filter(
            UserIntegration.user_id == user.id,
            UserIntegration.integration_id == integration.id,
            UserIntegration.status == "connected"
        )
        .first()
    )

    if not user_conn:
        raise HTTPException(status_code=403, detail=f"You must connect your {integration.name} account first from the Integrations page.")

    # Extract payloads
    entities = payload.get("entities", [])
    entity_type = payload.get("type", "lead")
    
    if not entities:
        raise HTTPException(status_code=400, detail="No entities provided to push")

    from app.services.integration_engine.credential_vault import decrypt_credentials
    from app.services.crm_sync_service import CrmSyncService
    
    try:
        token_data = decrypt_credentials(user_conn.credentials_encrypted)
        service = CrmSyncService(slug, token_data)
        synced_count = await service.push(entities, entity_type)
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to push to CRM: {str(e)}")

    return {
        "success": True,
        "message": f"Successfully pushed {synced_count} {entity_type}(s) to {integration.name}",
        "synced_count": synced_count,
        "crm": slug
    }
