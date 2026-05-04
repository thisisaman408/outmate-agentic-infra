from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Body
from app.api.deps.auth import get_current_user
from app.db.models.user import User
from app.db.deps import get_db
from sqlalchemy.orm import Session
import httpx
import logging
from datetime import datetime, timezone
from app.services.hubspot_service import HubSpotService
from app.services.salesforce_service import SalesforceService
from app.services.zoho_crm_service import ZohoCRMService
from app.services.outlook_service import OutlookService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/integrations", tags=["integrations"])

@router.get("/status")
async def get_status(user: User = Depends(get_current_user)):
    """Get the connection status of all key integrations."""
    ints = user.integrations or {}
    
    # Gmail status
    gmail_connected = bool(user.gmail_access_token)
    
    # All integrations status
    status = {
        # Email & Outreach
        "gmail": {
            "name": "Gmail",
            "connected": gmail_connected,
            "skipped": ints.get("gmail", {}).get("skipped", False),
            "priority": "must-have"
        },
        "outlook": {
            "name": "Outlook",
            "connected": bool(ints.get("outlook", {}).get("connected")),
            "skipped": ints.get("outlook", {}).get("skipped", False),
            "priority": "must-have"
        },
        "sendgrid": {
            "name": "SendGrid",
            "connected": bool(ints.get("sendgrid", {}).get("connected")),
            "skipped": ints.get("sendgrid", {}).get("skipped", False),
            "priority": "recommended"
        },
        "reply_io": {
            "name": "Reply.io",
            "connected": bool(ints.get("reply_io", {}).get("connected")),
            "skipped": ints.get("reply_io", {}).get("skipped", False),
            "priority": "recommended"
        },
        "woodpecker": {
            "name": "Woodpecker",
            "connected": bool(ints.get("woodpecker", {}).get("connected")),
            "skipped": ints.get("woodpecker", {}).get("skipped", False),
            "priority": "recommended"
        },
        "lemlist": {
            "name": "Lemlist",
            "connected": bool(ints.get("lemlist", {}).get("connected")),
            "skipped": ints.get("lemlist", {}).get("skipped", False),
            "priority": "recommended"
        },
        "salesloft": {
            "name": "Salesloft",
            "connected": bool(ints.get("salesloft", {}).get("connected")),
            "skipped": ints.get("salesloft", {}).get("skipped", False),
            "priority": "recommended"
        },
        "outreach_io": {
            "name": "Outreach.io",
            "connected": bool(ints.get("outreach_io", {}).get("connected")),
            "skipped": ints.get("outreach_io", {}).get("skipped", False),
            "priority": "recommended"
        },
        
        # CRM
        "hubspot": {
            "name": "HubSpot",
            "connected": bool(ints.get("hubspot", {}).get("connected")),
            "skipped": ints.get("hubspot", {}).get("skipped", False),
            "priority": "recommended"
        },
        "salesforce": {
            "name": "Salesforce",
            "connected": bool(ints.get("salesforce", {}).get("connected")),
            "skipped": ints.get("salesforce", {}).get("skipped", False),
            "priority": "recommended"
        },
        "pipedrive": {
            "name": "Pipedrive",
            "connected": bool(ints.get("pipedrive", {}).get("connected")),
            "skipped": ints.get("pipedrive", {}).get("skipped", False),
            "priority": "recommended"
        },
        "zoho_crm": {
            "name": "Zoho CRM",
            "connected": bool(ints.get("zoho_crm", {}).get("connected")),
            "skipped": ints.get("zoho_crm", {}).get("skipped", False),
            "priority": "recommended"
        },
        "close": {
            "name": "Close",
            "connected": bool(ints.get("close", {}).get("connected")),
            "skipped": ints.get("close", {}).get("skipped", False),
            "priority": "recommended"
        },
        "freshsales": {
            "name": "Freshsales",
            "connected": bool(ints.get("freshsales", {}).get("connected")),
            "skipped": ints.get("freshsales", {}).get("skipped", False),
            "priority": "recommended"
        },
        "monday": {
            "name": "Monday",
            "connected": bool(ints.get("monday", {}).get("connected")),
            "skipped": ints.get("monday", {}).get("skipped", False),
            "priority": "recommended"
        },
        "streak": {
            "name": "Streak",
            "connected": bool(ints.get("streak", {}).get("connected")),
            "skipped": ints.get("streak", {}).get("skipped", False),
            "priority": "recommended"
        },
        
        # Messaging
        "slack": {
            "name": "Slack",
            "connected": bool(ints.get("slack", {}).get("connected")),
            "skipped": ints.get("slack", {}).get("skipped", False),
            "priority": "must-have"
        },
        "teams": {
            "name": "Microsoft Teams",
            "connected": bool(ints.get("teams", {}).get("connected")),
            "skipped": ints.get("teams", {}).get("skipped", False),
            "priority": "recommended"
        },
        "discord": {
            "name": "Discord",
            "connected": bool(ints.get("discord", {}).get("connected")),
            "skipped": ints.get("discord", {}).get("skipped", False),
            "priority": "recommended"
        },
        "whatsapp": {
            "name": "WhatsApp",
            "connected": bool(ints.get("whatsapp", {}).get("connected")),
            "skipped": ints.get("whatsapp", {}).get("skipped", False),
            "priority": "recommended"
        },
        "twilio": {
            "name": "Twilio",
            "connected": bool(ints.get("twilio", {}).get("connected")),
            "skipped": ints.get("twilio", {}).get("skipped", False),
            "priority": "recommended"
        },
        "ringcentral": {
            "name": "RingCentral",
            "connected": bool(ints.get("ringcentral", {}).get("connected")),
            "skipped": ints.get("ringcentral", {}).get("skipped", False),
            "priority": "recommended"
        },
        
        # Social Media
        "linkedin": {
            "name": "LinkedIn",
            "connected": bool(ints.get("linkedin", {}).get("connected")),
            "skipped": ints.get("linkedin", {}).get("skipped", False),
            "priority": "recommended"
        },
        "twitter": {
            "name": "Twitter",
            "connected": bool(ints.get("twitter", {}).get("connected")),
            "skipped": ints.get("twitter", {}).get("skipped", False),
            "priority": "recommended"
        },
        "twitter_ads": {
            "name": "Twitter Ads",
            "connected": bool(ints.get("twitter_ads", {}).get("connected")),
            "skipped": ints.get("twitter_ads", {}).get("skipped", False),
            "priority": "recommended"
        },
        "facebook": {
            "name": "Facebook",
            "connected": bool(ints.get("facebook", {}).get("connected")),
            "skipped": ints.get("facebook", {}).get("skipped", False),
            "priority": "recommended"
        },
        "instagram": {
            "name": "Instagram",
            "connected": bool(ints.get("instagram", {}).get("connected")),
            "skipped": ints.get("instagram", {}).get("skipped", False),
            "priority": "recommended"
        },
        
        # Enrichment & Data
        "clearbit": {
            "name": "Clearbit",
            "connected": bool(ints.get("clearbit", {}).get("connected")),
            "skipped": ints.get("clearbit", {}).get("skipped", False),
            "priority": "recommended"
        },
        "apollo": {
            "name": "Apollo",
            "connected": bool(ints.get("apollo", {}).get("connected")),
            "skipped": ints.get("apollo", {}).get("skipped", False),
            "priority": "recommended"
        },
        "zoominfo": {
            "name": "ZoomInfo",
            "connected": bool(ints.get("zoominfo", {}).get("connected")),
            "skipped": ints.get("zoominfo", {}).get("skipped", False),
            "priority": "recommended"
        },
        "hunter": {
            "name": "Hunter",
            "connected": bool(ints.get("hunter", {}).get("connected")),
            "skipped": ints.get("hunter", {}).get("skipped", False),
            "priority": "recommended"
        },
        "rocketreach": {
            "name": "RocketReach",
            "connected": bool(ints.get("rocketreach", {}).get("connected")),
            "skipped": ints.get("rocketreach", {}).get("skipped", False),
            "priority": "recommended"
        },
        "lusha": {
            "name": "Lusha",
            "connected": bool(ints.get("lusha", {}).get("connected")),
            "skipped": ints.get("lusha", {}).get("skipped", False),
            "priority": "recommended"
        },
        "snov_io": {
            "name": "Snov.io",
            "connected": bool(ints.get("snov_io", {}).get("connected")),
            "skipped": ints.get("snov_io", {}).get("skipped", False),
            "priority": "recommended"
        },
        "kaspr": {
            "name": "Kaspr",
            "connected": bool(ints.get("kaspr", {}).get("connected")),
            "skipped": ints.get("kaspr", {}).get("skipped", False),
            "priority": "recommended"
        },
        
        # Calendar
        "google_calendar": {
            "name": "Google Calendar",
            "connected": bool(ints.get("google_calendar", {}).get("connected")),
            "skipped": ints.get("google_calendar", {}).get("skipped", False),
            "priority": "recommended"
        },
        "outlook_calendar": {
            "name": "Outlook Calendar",
            "connected": bool(ints.get("outlook_calendar", {}).get("connected")),
            "skipped": ints.get("outlook_calendar", {}).get("skipped", False),
            "priority": "recommended"
        },
        "calendly": {
            "name": "Calendly",
            "connected": bool(ints.get("calendly", {}).get("connected")),
            "skipped": ints.get("calendly", {}).get("skipped", False),
            "priority": "recommended"
        },
        
        # Analytics
        "google_analytics": {
            "name": "Google Analytics",
            "connected": bool(ints.get("google_analytics", {}).get("connected")),
            "skipped": ints.get("google_analytics", {}).get("skipped", False),
            "priority": "recommended"
        },
        "segment": {
            "name": "Segment",
            "connected": bool(ints.get("segment", {}).get("connected")),
            "skipped": ints.get("segment", {}).get("skipped", False),
            "priority": "recommended"
        },
        "mixpanel": {
            "name": "Mixpanel",
            "connected": bool(ints.get("mixpanel", {}).get("connected")),
            "skipped": ints.get("mixpanel", {}).get("skipped", False),
            "priority": "recommended"
        },
        "amplitude": {
            "name": "Amplitude",
            "connected": bool(ints.get("amplitude", {}).get("connected")),
            "skipped": ints.get("amplitude", {}).get("skipped", False),
            "priority": "recommended"
        },
        
        # Communication
        "intercom": {
            "name": "Intercom",
            "connected": bool(ints.get("intercom", {}).get("connected")),
            "skipped": ints.get("intercom", {}).get("skipped", False),
            "priority": "recommended"
        },
        "zendesk": {
            "name": "Zendesk",
            "connected": bool(ints.get("zendesk", {}).get("connected")),
            "skipped": ints.get("zendesk", {}).get("skipped", False),
            "priority": "recommended"
        },
        "helpscout": {
            "name": "Helpscout",
            "connected": bool(ints.get("helpscout", {}).get("connected")),
            "skipped": ints.get("helpscout", {}).get("skipped", False),
            "priority": "recommended"
        },
        
        # Productivity
        "notion": {
            "name": "Notion",
            "connected": bool(ints.get("notion", {}).get("connected")),
            "skipped": ints.get("notion", {}).get("skipped", False),
            "priority": "recommended"
        },
        "airtable": {
            "name": "Airtable",
            "connected": bool(ints.get("airtable", {}).get("connected")),
            "skipped": ints.get("airtable", {}).get("skipped", False),
            "priority": "recommended"
        },
        "trello": {
            "name": "Trello",
            "connected": bool(ints.get("trello", {}).get("connected")),
            "skipped": ints.get("trello", {}).get("skipped", False),
            "priority": "recommended"
        },
        "asana": {
            "name": "Asana",
            "connected": bool(ints.get("asana", {}).get("connected")),
            "skipped": ints.get("asana", {}).get("skipped", False),
            "priority": "recommended"
        },
        
        # Automation
        "zapier": {
            "name": "Zapier",
            "connected": bool(ints.get("zapier", {}).get("connected")),
            "skipped": ints.get("zapier", {}).get("skipped", False),
            "priority": "recommended"
        },
        "make": {
            "name": "Make",
            "connected": bool(ints.get("make", {}).get("connected")),
            "skipped": ints.get("make", {}).get("skipped", False),
            "priority": "recommended"
        },
        "n8n": {
            "name": "n8n",
            "connected": bool(ints.get("n8n", {}).get("connected")),
            "skipped": ints.get("n8n", {}).get("skipped", False),
            "priority": "recommended"
        },
        "webhooks": {
            "name": "Webhooks",
            "connected": bool(ints.get("webhooks", {}).get("connected")),
            "skipped": ints.get("webhooks", {}).get("skipped", False),
            "priority": "recommended"
        },
        
        # Legacy support
        "outreach": {
            "name": "Outreach (Instantly/Smartlead)",
            "connected": bool(ints.get("outreach", {}).get("connected")),
            "service": ints.get("outreach", {}).get("service"),
            "skipped": ints.get("outreach", {}).get("skipped", False),
            "priority": "recommended"
        },
        "instantly": {
            "name": "Instantly",
            "connected": (
                bool(ints.get("instantly", {}).get("connected"))
                or (
                    ints.get("outreach", {}).get("service") == "instantly"
                    and bool(ints.get("outreach", {}).get("connected"))
                )
            ),
            "skipped": ints.get("instantly", {}).get("skipped", False),
            "priority": "recommended"
        },
        "smartlead": {
            "name": "Smartlead",
            "connected": (
                bool(ints.get("smartlead", {}).get("connected"))
                or (
                    ints.get("outreach", {}).get("service") == "smartlead"
                    and bool(ints.get("outreach", {}).get("connected"))
                )
            ),
            "skipped": ints.get("smartlead", {}).get("skipped", False),
            "priority": "recommended"
        }
    }
    
    connected_count = sum(1 for s in status.values() if s["connected"])
    return {
        "integrations": status,
        "connected_count": connected_count,
        "total_count": len(status)
    }

@router.post("/test/outreach")
async def test_outreach(
    service: str = Body(..., embed=True), # 'instantly' or 'smartlead'
    api_key: str = Body(..., embed=True),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Real API test for Instantly or Smartlead."""
    logger.info(f"Testing {service} connection for user {user.email}")
    
    # Placeholders for real API endpoints if they differ
    if service == "instantly":
        # Instantly V2 verify endpoint — V1 was deprecated in 2024 and now
        # returns 404. V2 uses bearer auth and a /api/v2/accounts list call.
        url = "https://api.instantly.ai/api/v2/accounts"
        params = {"limit": 1}
        headers = {"Authorization": f"Bearer {api_key}"}
    elif service == "smartlead":
        # Smartlead V1 verify endpoint
        url = "https://smartlead.ai/api/v1/email-accounts/stats"
        params = {"api_key": api_key}
        headers = {}
    else:
        raise HTTPException(status_code=400, detail="Invalid service selection")

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # We use a simple list request to verify the key
            resp = await client.get(url, params=params, headers=headers)
            
            if resp.status_code == 200:
                # Success - Save integration metadata
                ints = user.integrations or {}
                ints["outreach"] = {
                    "service": service,
                    "connected": True,
                    "connected_at": datetime.now(timezone.utc).isoformat(),
                    "skipped": False
                }
                # We store the mask of the key for safety or the whole key if needed for functionality
                ints["outreach_api_key"] = api_key
                user.integrations = ints

                # Also upsert the v2 UserIntegration row so the catalog (and
                # downstream visitor-alert delivery) can find this credential.
                try:
                    from app.db.models.integration import Integration, UserIntegration
                    from app.services.integration_engine.credential_vault import encrypt_credentials
                    integration = (
                        db.query(Integration).filter(Integration.slug == service).first()
                    )
                    if integration:
                        ui = (
                            db.query(UserIntegration)
                            .filter(
                                UserIntegration.user_id == user.id,
                                UserIntegration.integration_id == integration.id,
                            )
                            .first()
                        )
                        encrypted = encrypt_credentials({"api_key": api_key})
                        if ui:
                            ui.credentials_encrypted = encrypted
                            ui.status = "connected"
                            ui.connected_at = datetime.now(timezone.utc)
                            ui.error_message = None
                        else:
                            db.add(UserIntegration(
                                user_id=user.id,
                                integration_id=integration.id,
                                credentials_encrypted=encrypted,
                                status="connected",
                                connected_at=datetime.now(timezone.utc),
                            ))
                except Exception as e:
                    logger.warning(f"Failed to upsert UserIntegration for {service}: {e}")

                db.commit()
                return {"success": True, "message": f"Successfully connected to {service.capitalize()}"}
            
            logger.warning(f"{service} test failed: {resp.status_code} - {resp.text}")
            return {"success": False, "message": "Invalid API key. Please check and try again."}
            
    except Exception as e:
        logger.error(f"Error testing {service}: {str(e)}")
        return {"success": False, "message": f"Connection failed: {str(e)}"}

@router.post("/skip")
async def skip_integration(
    service: str = Body(..., embed=True),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark an integration as skipped."""
    ints = user.integrations or {}
    if service not in ints:
        ints[service] = {}
    ints[service]["skipped"] = True
    ints[service]["connected"] = False
    user.integrations = ints
    db.commit()
    return {"success": True}

@router.post("/skip-all")
async def skip_all_integrations(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Skip all integration steps in onboarding."""
    ints = user.integrations or {}
    services = [
        "gmail", "outlook", "sendgrid", "reply_io", "woodpecker",
        "lemlist", "salesloft", "outreach_io", "hubspot", "salesforce", "pipedrive",
        "zoho_crm", "close", "freshsales", "monday", "streak", "slack", "teams", "discord",
        "whatsapp", "twilio", "ringcentral", "linkedin", "twitter", "twitter_ads", "facebook",
        "instagram", "clearbit", "apollo", "zoominfo", "hunter", "rocketreach", "lusha",
        "snov_io", "kaspr", "google_calendar", "outlook_calendar", "calendly", "google_analytics",
        "segment", "mixpanel", "amplitude", "intercom", "zendesk", "helpscout", "notion",
        "airtable", "trello", "asana", "zapier", "make", "n8n", "webhooks", "outreach"
    ]
    for s in services:
        if s not in ints:
            ints[s] = {}
        if not ints[s].get("connected"):
            ints[s]["skipped"] = True
            
    user.integrations = ints
    db.commit()
    return {"success": True}

# ── HubSpot OAuth ─────────────────────────────────────────────

@router.get("/hubspot/auth-url")
async def hubspot_get_auth_url(user: User = Depends(get_current_user)):
    """Get the HubSpot OAuth authorization URL."""
    if not HubSpotService.is_available():
        raise HTTPException(status_code=400, detail="HubSpot integration is not configured")
    return {"auth_url": HubSpotService.get_auth_url(HubSpotService.build_state(user.id))}

@router.get("/outlook/auth-url")
async def outlook_get_auth_url(user: User = Depends(get_current_user)):
    """Get the Outlook OAuth authorization URL."""
    if not OutlookService.is_available():
        raise HTTPException(status_code=400, detail="Outlook integration is not configured")
    return {"auth_url": OutlookService.get_auth_url(OutlookService.build_state(user.id))}

@router.post("/hubspot/callback")
async def hubspot_callback(
    code: str = Body(..., embed=True),
    state: str = Body(..., embed=True),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Handle HubSpot OAuth callback."""
    try:
        service = HubSpotService(db)
        token_data = await service.exchange_code(code, state)
        service.store_tokens(user.id, token_data)
        return {"success": True, "message": "HubSpot connected successfully"}
    except Exception as e:
        logger.error(f"HubSpot callback error: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to connect HubSpot: {str(e)}")

@router.post("/outlook/callback")
async def outlook_callback(
    code: str = Body(..., embed=True),
    state: str = Body(..., embed=True),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Handle Outlook OAuth callback."""
    try:
        service = OutlookService(db)
        token_data = await service.exchange_code(code, state)
        await service.store_tokens(user.id, token_data)
        return {"success": True, "message": "Outlook connected successfully"}
    except Exception as e:
        logger.error(f"Outlook callback error: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to connect Outlook: {str(e)}")

@router.post("/hubspot/disconnect")
async def hubspot_disconnect(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Disconnect HubSpot integration."""
    try:
        service = HubSpotService(db)
        service.disconnect(user.id)

        # Update user integrations status
        ints = user.integrations or {}
        ints["hubspot"] = {"connected": False, "skipped": False}
        user.integrations = ints
        db.commit()

        return {"success": True, "message": "HubSpot disconnected successfully"}
    except Exception as e:
        logger.error(f"HubSpot disconnect error: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to disconnect HubSpot: {str(e)}")

@router.post("/outlook/disconnect")
async def outlook_disconnect(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Disconnect Outlook integration."""
    try:
        service = OutlookService(db)
        service.disconnect(user.id)

        # Update user integrations status
        ints = user.integrations or {}
        ints["outlook"] = {"connected": False, "skipped": False}
        user.integrations = ints
        db.commit()

        return {"success": True, "message": "Outlook disconnected successfully"}
    except Exception as e:
        logger.error(f"Outlook disconnect error: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to disconnect Outlook: {str(e)}")

# ── Salesforce OAuth ───────────────────────────────────────────

@router.get("/salesforce/auth-url")
async def get_salesforce_auth_url(
    user: User = Depends(get_current_user)
):
    """Get Salesforce OAuth authorization URL."""
    if not SalesforceService.is_available():
        raise HTTPException(status_code=400, detail="Salesforce integration not configured")
    
    state = str(user.id)
    auth_url = SalesforceService.get_auth_url(state)
    return {"auth_url": auth_url}

@router.post("/salesforce/callback")
async def salesforce_callback(
    code: str = Body(..., embed=True),
    state: str = Body(..., embed=True),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Handle Salesforce OAuth callback."""
    try:
        service = SalesforceService(db)
        token_data = await service.exchange_code(code, state)
        service.store_tokens(user.id, token_data)
        
        # Update user integrations status
        ints = user.integrations or {}
        ints["salesforce"] = {"connected": True, "skipped": False}
        user.integrations = ints
        db.commit()
        
        return {"success": True, "message": "Salesforce connected successfully"}
    except Exception as e:
        logger.error(f"Salesforce OAuth error: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to connect Salesforce: {str(e)}")

@router.post("/salesforce/disconnect")
async def salesforce_disconnect(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Disconnect Salesforce integration."""
    try:
        service = SalesforceService(db)
        service.disconnect(user.id)
        
        # Update user integrations status
        ints = user.integrations or {}
        ints["salesforce"] = {"connected": False, "skipped": False}
        user.integrations = ints
        db.commit()
        
        return {"success": True, "message": "Salesforce disconnected successfully"}
    except Exception as e:
        logger.error(f"Salesforce disconnect error: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to disconnect Salesforce: {str(e)}")

# ── Zoho CRM OAuth ────────────────────────────────────────────

@router.get("/zoho-crm/auth-url")
async def get_zoho_crm_auth_url(
    user: User = Depends(get_current_user)
):
    """Get Zoho CRM OAuth authorization URL."""
    if not ZohoCRMService.is_available():
        raise HTTPException(status_code=400, detail="Zoho CRM integration not configured")
    
    state = str(user.id)
    auth_url = ZohoCRMService.get_auth_url(state)
    return {"auth_url": auth_url}

@router.post("/zoho-crm/callback")
async def zoho_crm_callback(
    code: str = Body(..., embed=True),
    state: str = Body(..., embed=True),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Handle Zoho CRM OAuth callback."""
    try:
        service = ZohoCRMService(db)
        token_data = await service.exchange_code(code, state)
        service.store_tokens(user.id, token_data)
        
        # Update user integrations status
        ints = user.integrations or {}
        ints["zoho_crm"] = {"connected": True, "skipped": False}
        user.integrations = ints
        db.commit()
        
        return {"success": True, "message": "Zoho CRM connected successfully"}
    except Exception as e:
        logger.error(f"Zoho CRM OAuth error: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to connect Zoho CRM: {str(e)}")

@router.post("/zoho-crm/disconnect")
async def zoho_crm_disconnect(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Disconnect Zoho CRM integration."""
    try:
        service = ZohoCRMService(db)
        service.disconnect(user.id)
        
        # Update user integrations status
        ints = user.integrations or {}
        ints["zoho_crm"] = {"connected": False, "skipped": False}
        user.integrations = ints
        db.commit()
        
        return {"success": True, "message": "Zoho CRM disconnected successfully"}
    except Exception as e:
        logger.error(f"Zoho CRM disconnect error: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to disconnect Zoho CRM: {str(e)}")

# ── API Key Configuration Endpoints ─────────────────────────────

@router.post("/hubspot/api-key")
async def hubspot_store_api_key(
    api_key: str = Body(..., embed=True),
    description: str = Body("", embed=True),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Store HubSpot API key with description."""
    try:
        service = HubSpotService(db)
        service.store_api_key(user.id, api_key, description)
        
        # Update user integrations status
        ints = user.integrations or {}
        ints["hubspot"] = {"connected": True, "skipped": False}
        user.integrations = ints
        db.commit()
        
        return {"success": True, "message": "HubSpot API key connected successfully"}
    except Exception as e:
        logger.error(f"HubSpot API key error: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to connect HubSpot API key: {str(e)}")

@router.post("/hubspot/test-contact")
async def hubspot_test_contact(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Diagnostic: create a real HubSpot contact using the user's stored
    Private App Token (or OAuth token). Returns the HubSpot HTTP status
    and response body verbatim so failures can be diagnosed without
    backend logs in production.
    """
    import time
    import httpx
    from app.services.hubspot_service import HubSpotService, HUBSPOT_API_BASE

    svc = HubSpotService(db)
    row = svc._get_integration_row(user.id)
    if not row:
        return {"ok": False, "stage": "lookup", "error": "HubSpot integration not connected"}

    creds = row.get("credentials") or {}
    token = creds.get("api_key") or creds.get("access_token")
    if not token:
        return {
            "ok": False,
            "stage": "lookup",
            "error": "No api_key or access_token in stored credentials",
            "auth_type": creds.get("auth_type"),
            "creds_keys": list(creds.keys()),
        }

    test_email = f"outmate-test-{int(time.time())}@outmate.test"
    properties = {
        "email": test_email,
        "firstname": "Outmate",
        "lastname": "Test",
        "company": "Outmate Diagnostic",
        "hs_lead_status": "NEW",
    }

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            f"{HUBSPOT_API_BASE}/crm/v3/objects/contacts",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json={"properties": properties},
        )

    body_text = (resp.text or "")[:1000]
    return {
        "ok": resp.status_code in (200, 201),
        "status_code": resp.status_code,
        "body": body_text,
        "test_email": test_email,
        "auth_type": creds.get("auth_type") or ("api_key" if creds.get("api_key") else "oauth"),
        "token_prefix": (token or "")[:6] + "…" if token else None,
    }


@router.post("/salesforce/api-key")
async def salesforce_store_api_key(
    api_key: str = Body(..., embed=True),
    description: str = Body("", embed=True),
    instance_url: str = Body("", embed=True),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Store Salesforce API key with description."""
    try:
        service = SalesforceService(db)
        service.store_api_key(user.id, api_key, description, instance_url)
        
        # Update user integrations status
        ints = user.integrations or {}
        ints["salesforce"] = {"connected": True, "skipped": False}
        user.integrations = ints
        db.commit()
        
        return {"success": True, "message": "Salesforce API key connected successfully"}
    except Exception as e:
        logger.error(f"Salesforce API key error: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to connect Salesforce API key: {str(e)}")

@router.post("/zoho-crm/api-key")
async def zoho_crm_store_api_key(
    api_key: str = Body(..., embed=True),
    description: str = Body("", embed=True),
    api_domain: str = Body("", embed=True),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Store Zoho CRM API key with description."""
    try:
        service = ZohoCRMService(db)
        service.store_api_key(user.id, api_key, description, api_domain)

        # Update user integrations status
        ints = user.integrations or {}
        ints["zoho_crm"] = {"connected": True, "skipped": False}
        user.integrations = ints
        db.commit()

        return {"success": True, "message": "Zoho CRM API key connected successfully"}
    except Exception as e:
        logger.error(f"Zoho CRM API key error: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to connect Zoho CRM API key: {str(e)}")

@router.post("/outlook/api-key")
async def outlook_store_api_key(
    api_key: str = Body(..., embed=True),
    description: str = Body("", embed=True),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Outlook uses Microsoft delegated OAuth, not pasted Graph tokens."""
    raise HTTPException(
        status_code=400,
        detail="Outlook / Office 365 must be connected with Microsoft OAuth so each user authorizes their own mailbox.",
    )

# ── Add to CRM Endpoints ─────────────────────────────────────

@router.post("/hubspot/add-contacts")
async def hubspot_add_contacts(
    contacts: List[Dict[str, Any]] = Body(..., embed=True),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add contacts to HubSpot CRM."""
    try:
        service = HubSpotService(db)
        results = []
        for contact in contacts:
            try:
                result = await service.create_contact(user.id, contact)
                results.append({"success": True, "contact": result})
            except Exception as e:
                logger.error(f"Failed to add contact to HubSpot: {e}")
                results.append({"success": False, "error": str(e)})
        
        success_count = sum(1 for r in results if r["success"])
        return {"success": True, "total": len(contacts), "successful": success_count, "results": results}
    except Exception as e:
        logger.error(f"HubSpot add contacts error: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to add contacts to HubSpot: {str(e)}")

@router.post("/salesforce/add-contacts")
async def salesforce_add_contacts(
    contacts: List[Dict[str, Any]] = Body(..., embed=True),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add contacts to Salesforce CRM."""
    try:
        service = SalesforceService(db)
        results = []
        for contact in contacts:
            try:
                result = await service.create_contact(user.id, contact)
                results.append({"success": True, "contact": result})
            except Exception as e:
                logger.error(f"Failed to add contact to Salesforce: {e}")
                results.append({"success": False, "error": str(e)})
        
        success_count = sum(1 for r in results if r["success"])
        return {"success": True, "total": len(contacts), "successful": success_count, "results": results}
    except Exception as e:
        logger.error(f"Salesforce add contacts error: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to add contacts to Salesforce: {str(e)}")

@router.post("/zoho-crm/add-contacts")
async def zoho_crm_add_contacts(
    contacts: List[Dict[str, Any]] = Body(..., embed=True),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add contacts to Zoho CRM."""
    try:
        service = ZohoCRMService(db)
        results = []
        for contact in contacts:
            try:
                result = await service.create_contact(user.id, contact)
                results.append({"success": True, "contact": result})
            except Exception as e:
                logger.error(f"Failed to add contact to Zoho CRM: {e}")
                results.append({"success": False, "error": str(e)})

        success_count = sum(1 for r in results if r["success"])
        return {"success": True, "total": len(contacts), "successful": success_count, "results": results}
    except Exception as e:
        logger.error(f"Zoho CRM add contacts error: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to add contacts to Zoho CRM: {str(e)}")

# ── Outlook Email Operations ─────────────────────────────────────

@router.post("/outlook/send-email")
async def outlook_send_email(
    to_email: str = Body(..., embed=True),
    subject: str = Body(..., embed=True),
    body: str = Body(..., embed=True),
    html_body: str = Body(None, embed=True),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Send an email using Outlook."""
    try:
        service = OutlookService(db)
        result = await service.send_email(user.id, to_email, subject, body, html_body)
        return result
    except Exception as e:
        logger.error(f"Outlook send email error: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to send email: {str(e)}")

@router.get("/outlook/emails")
async def outlook_get_emails(
    limit: int = 10,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get recent emails from Outlook."""
    try:
        service = OutlookService(db)
        result = await service.get_emails(user.id, limit)
        return result
    except Exception as e:
        logger.error(f"Outlook get emails error: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to get emails: {str(e)}")

@router.get("/outlook/profile")
async def outlook_get_profile(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get the connected Microsoft Graph profile."""
    try:
        service = OutlookService(db)
        return await service.get_profile(user.id)
    except Exception as e:
        logger.error(f"Outlook profile error: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to get Outlook profile: {str(e)}")

@router.get("/outlook/folders")
async def outlook_get_folders(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get the connected mailbox folders."""
    try:
        service = OutlookService(db)
        return await service.get_folders(user.id)
    except Exception as e:
        logger.error(f"Outlook folders error: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to get Outlook folders: {str(e)}")

# ── Slack OAuth ─────────────────────────────────────────────

@router.get("/slack/auth-url")
async def slack_get_auth_url(user: User = Depends(get_current_user)):
    """Get the Slack OAuth authorization URL."""
    from app.services.slack_service import SlackService
    if not SlackService.is_available():
        raise HTTPException(status_code=400, detail="Slack integration is not configured")
    state = str(user.id)
    auth_url = SlackService.get_auth_url(state)
    return {"auth_url": auth_url}

@router.post("/slack/callback")
async def slack_callback(
    code: str = Body(..., embed=True),
    state: str = Body(..., embed=True),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Handle Slack OAuth callback."""
    try:
        from app.services.slack_service import SlackService
        service = SlackService(db)
        token_data = await service.exchange_code(code, state)
        service.store_tokens(user.id, token_data)
        return {"success": True, "message": "Slack connected successfully"}
    except Exception as e:
        logger.error(f"Slack callback error: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to connect Slack: {str(e)}")

@router.post("/slack/disconnect")
async def slack_disconnect(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Disconnect Slack integration."""
    try:
        from app.services.slack_service import SlackService
        service = SlackService(db)
        service.disconnect(user.id)

        # Update user integrations status
        ints = user.integrations or {}
        ints["slack"] = {"connected": False, "skipped": False}
        user.integrations = ints

        # Also disconnect the marketplace Slack webhook integration. The
        # Integrations page connects Slack through the v2 catalog, while this
        # legacy route still owns the exact /slack/disconnect path.
        try:
            from app.db.models.integration import Integration, UserIntegration
            from app.db.models.copilot_preferences import CopilotUserPreferences

            integration = db.query(Integration).filter(Integration.slug == "slack").first()
            if integration:
                user_conn = (
                    db.query(UserIntegration)
                    .filter(
                        UserIntegration.user_id == user.id,
                        UserIntegration.integration_id == integration.id,
                    )
                    .first()
                )
                if user_conn:
                    db.delete(user_conn)

            prefs = (
                db.query(CopilotUserPreferences)
                .filter(CopilotUserPreferences.user_id == user.id)
                .first()
            )
            if prefs:
                prefs.slack_webhook_url = None
                prefs.notify_slack = False
        except Exception as cleanup_error:
            logger.warning("Slack marketplace cleanup failed: %s", cleanup_error)

        db.commit()

        return {"success": True, "message": "Slack disconnected successfully"}
    except Exception as e:
        logger.error(f"Slack disconnect error: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to disconnect Slack: {str(e)}")

# ── Discord OAuth ─────────────────────────────────────────────

@router.get("/discord/auth-url")
async def discord_get_auth_url(user: User = Depends(get_current_user)):
    """Get the Discord OAuth authorization URL."""
    from app.services.discord_service import DiscordService
    if not DiscordService.is_available():
        raise HTTPException(status_code=400, detail="Discord integration is not configured")
    state = str(user.id)
    auth_url = DiscordService.get_auth_url(state)
    return {"auth_url": auth_url}

@router.post("/discord/callback")
async def discord_callback(
    code: str = Body(..., embed=True),
    state: str = Body(..., embed=True),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Handle Discord OAuth callback."""
    try:
        from app.services.discord_service import DiscordService
        service = DiscordService(db)
        token_data = await service.exchange_code(code, state)
        service.store_tokens(user.id, token_data)
        return {"success": True, "message": "Discord connected successfully"}
    except Exception as e:
        logger.error(f"Discord callback error: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to connect Discord: {str(e)}")

@router.post("/discord/disconnect")
async def discord_disconnect(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Disconnect Discord integration."""
    try:
        from app.services.discord_service import DiscordService
        service = DiscordService(db)
        service.disconnect(user.id)

        # Update user integrations status
        ints = user.integrations or {}
        ints["discord"] = {"connected": False, "skipped": False}
        user.integrations = ints
        db.commit()

        return {"success": True, "message": "Discord disconnected successfully"}
    except Exception as e:
        logger.error(f"Discord disconnect error: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to disconnect Discord: {str(e)}")

# ── Microsoft Teams OAuth ─────────────────────────────────────

@router.get("/teams/auth-url")
async def teams_get_auth_url(user: User = Depends(get_current_user)):
    """Get the Microsoft Teams OAuth authorization URL."""
    from app.services.teams_service import TeamsService
    if not TeamsService.is_available():
        raise HTTPException(status_code=400, detail="Teams integration is not configured")
    state = str(user.id)
    auth_url = TeamsService.get_auth_url(state)
    return {"auth_url": auth_url}

@router.post("/teams/callback")
async def teams_callback(
    code: str = Body(..., embed=True),
    state: str = Body(..., embed=True),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Handle Microsoft Teams OAuth callback."""
    try:
        from app.services.teams_service import TeamsService
        service = TeamsService(db)
        token_data = await service.exchange_code(code, state)
        service.store_tokens(user.id, token_data)
        return {"success": True, "message": "Teams connected successfully"}
    except Exception as e:
        logger.error(f"Teams callback error: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to connect Teams: {str(e)}")

@router.post("/teams/disconnect")
async def teams_disconnect(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Disconnect Teams integration."""
    try:
        from app.services.teams_service import TeamsService
        service = TeamsService(db)
        service.disconnect(user.id)

        # Update user integrations status
        ints = user.integrations or {}
        ints["teams"] = {"connected": False, "skipped": False}
        user.integrations = ints
        db.commit()

        return {"success": True, "message": "Teams disconnected successfully"}
    except Exception as e:
        logger.error(f"Teams disconnect error: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to disconnect Teams: {str(e)}")

# ── WhatsApp Business (Unipile) ─────────────────────────────────────────────

@router.post("/whatsapp/connect")
async def whatsapp_connect(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Connect WhatsApp Business via Unipile."""
    try:
        from app.services.whatsapp_service import WhatsAppService
        service = WhatsAppService(db)
        await service._ensure_account_id()
        if not service.account_id:
            raise HTTPException(status_code=400, detail="No WhatsApp account connected in Unipile")

        service.store_api_key(user.id, account_id=service.account_id)

        # Update user integrations status
        ints = user.integrations or {}
        ints["whatsapp"] = {"connected": True, "skipped": False}
        user.integrations = ints
        db.commit()

        return {"success": True, "message": "WhatsApp Business connected successfully via Unipile"}
    except Exception as e:
        logger.error(f"WhatsApp connect error: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to connect WhatsApp Business: {str(e)}")

@router.post("/whatsapp/disconnect")
async def whatsapp_disconnect(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Disconnect WhatsApp Business integration."""
    try:
        from app.services.whatsapp_service import WhatsAppService
        service = WhatsAppService(db)
        service.disconnect(user.id)

        # Update user integrations status
        ints = user.integrations or {}
        ints["whatsapp"] = {"connected": False, "skipped": False}
        user.integrations = ints
        db.commit()

        return {"success": True, "message": "WhatsApp Business disconnected successfully"}
    except Exception as e:
        logger.error(f"WhatsApp disconnect error: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to disconnect WhatsApp Business: {str(e)}")
