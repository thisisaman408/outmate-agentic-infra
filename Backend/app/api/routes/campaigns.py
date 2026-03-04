"""
Campaign Draft Generation & Send API Routes
"""

import httpx
import os
from urllib.parse import quote_plus
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from typing import Optional, Literal, List, Dict, Any
import logging
import json
import re

from app.services.campaign_service import CampaignService, CampaignDraftRequest, CampaignDraftResponse
from app.services.gmail_service import GmailService
from app.services.unipile_service import UnipileService
from app.services.campaign_dashboard_service import CampaignDashboardService
from app.services.openrouter_service import OpenRouterService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["campaigns"])
public_router = APIRouter(tags=["campaigns"])
dashboard_service = CampaignDashboardService()


def _normalize_return_path(path: Optional[str]) -> str:
    default_path = "/ai-powered-search"
    if not path:
        return default_path
    cleaned = path.strip()
    if not cleaned:
        return default_path
    # Disallow absolute URLs for safety.
    if "://" in cleaned:
        return default_path
    if not cleaned.startswith("/"):
        cleaned = f"/{cleaned}"
    return cleaned


# --- Draft Generation ---

class OpenRouterMessageRequest(BaseModel):
    objective: str
    leads: List[str]
    signals: List[str] = []


@router.post("/generate-draft", response_model=CampaignDraftResponse)
async def generate_campaign_draft(request: CampaignDraftRequest):
    """Generate a personalized campaign draft using LLM."""
    try:
        service = CampaignService()
        draft = await service.generate_draft(request)
        return draft
    except Exception as e:
        logger.error(f"Campaign draft generation error: {e}")
        raise HTTPException(status_code=500, detail=f"Campaign draft generation failed: {str(e)}")


@router.post("/generate-message")
async def generate_campaign_message(request: OpenRouterMessageRequest):
    def _extract_json_payload(text: str) -> Dict[str, Any]:
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            match = re.search(r"\{[\s\S]+\}", text)
            if match:
                try:
                    return json.loads(match.group(0))
                except json.JSONDecodeError:
                    pass
        return {}

    try:
        openrouter = OpenRouterService()
        prompt_lines = [
            "You are an expert B2B outreach copywriter crafting short email and LinkedIn touch.",
            f"Objective: {request.objective}",
            f"Selected lead IDs: {', '.join(request.leads) if request.leads else 'none'}",
            f"Signal references to highlight: {', '.join(request.signals) if request.signals else 'general momentum (funding, hiring, tech adoption)'}",
            "Use {{firstName}} and {{companyName}} placeholders (people+company) in the email body and email subject, and {{companyName}} in the LinkedIn touch.",
            "Start each message referencing the strongest signal, offer value, and end with a clear low-friction CTA.",
            "Output JSON with subject, email_body, linkedin_message. Keep each under 120 words.",
        ]
        prompt = "\n".join(prompt_lines)
        response = await openrouter.chat_completion(prompt)
        extracted = _extract_json_payload(response)
        return {
            "subject": extracted.get("subject", ""),
            "email_body": extracted.get("email_body", extracted.get("body", response)),
            "linkedin_message": extracted.get("linkedin_message", extracted.get("linkedin", "")),
            "raw": response,
        }
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=exc.response.status_code, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# --- Gmail OAuth2 ---

@public_router.get("/gmail/auth-url")
async def gmail_auth_url(return_to: str = Query("/ai-powered-search")):
    """Get the Google OAuth2 authorization URL for Gmail."""
    try:
        service = GmailService()
        safe_path = _normalize_return_path(return_to)
        url = service.get_auth_url(state=safe_path)
        return {"auth_url": url}
    except Exception as e:
        logger.error(f"Gmail auth URL error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@public_router.get("/gmail/callback")
async def gmail_callback(code: str = Query(...), state: str = Query("")):
    """Handle Google OAuth2 callback - exchange code for tokens."""
    safe_path = _normalize_return_path(state)
    frontend_base = os.getenv("APP_WEBHOOK_URL", "http://localhost:3000").rstrip("/")
    redirect_prefix = f"{frontend_base}{safe_path}"
    try:
        service = GmailService()
        result = await service.exchange_code(code)
        # Redirect back to the frontend with success
        redirect_url = f"{redirect_prefix}?gmail_connected=true&gmail_email={quote_plus(result['email'])}"
        return RedirectResponse(url=redirect_url)
    except Exception as e:
        logger.error(f"Gmail callback error: {e}")
        redirect_url = f"{redirect_prefix}?gmail_connected=false&gmail_error={quote_plus(str(e))}"
        return RedirectResponse(url=redirect_url)


@router.get("/gmail/status")
async def gmail_status():
    """Check if Gmail is connected."""
    service = GmailService()
    return service.is_connected()


# --- Send Email ---

class SendEmailRequest(BaseModel):
    to_email: str
    subject: str
    body: str
    from_email: Optional[str] = None


@router.post("/send-email")
async def send_email(request: SendEmailRequest):
    """Send an email via connected Gmail account."""
    try:
        service = GmailService()
        result = await service.send_email(
            to_email=request.to_email,
            subject=request.subject,
            body=request.body,
            from_email=request.from_email,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Send email error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")


# --- LinkedIn via Unipile ---

@router.get("/linkedin/status")
async def linkedin_status():
    """Check if Unipile LinkedIn is configured."""
    service = UnipileService()
    return service.is_connected()


class SendLinkedInRequest(BaseModel):
    linkedin_url: str
    message: str


@router.post("/send-linkedin")
async def send_linkedin(request: SendLinkedInRequest):
    """Send a LinkedIn message via Unipile."""
    try:
        service = UnipileService()
        result = await service.send_message(
            linkedin_url=request.linkedin_url,
            message=request.message,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Send LinkedIn error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to send LinkedIn message: {str(e)}")


class EmailAccountRequest(BaseModel):
    email: str
    provider: Optional[str] = "Gmail"


class BlocklistRequest(BaseModel):
    domain: str
    reason: str
    added_by: Optional[str] = "Admin"


class CampaignStatusRequest(BaseModel):
    status: Literal["draft", "running", "paused", "completed"]


class CampaignCreateRequest(BaseModel):
    name: str
    objective: str
    leads: List[str]
    schedule: Optional[Dict[str, Any]] = None


class OpenRouterMessageRequest(BaseModel):
    objective: str
    leads: List[str]


class OpenRouterMessageRequest(BaseModel):
    objective: str
    leads: List[str]


class OpenRouterMessageRequest(BaseModel):
    objective: str
    leads: List[str]


@router.get("/dashboard/sequences")
async def get_dashboard_sequences():
    return {"sequences": await dashboard_service.list_sequences()}


@router.post("/dashboard/global-inbox")
async def global_inbox():
    return await dashboard_service.trigger_global_inbox()


@router.post("/dashboard/global-analytics")
async def global_analytics():
    return await dashboard_service.trigger_global_analytics()


@router.get("/dashboard/email-accounts")
async def get_email_accounts():
    return {"accounts": await dashboard_service.list_email_accounts()}


@router.post("/dashboard/email-accounts")
async def add_email_account(request: EmailAccountRequest):
    account = await dashboard_service.add_email_account(request.email, request.provider)
    return {"account": account}


@router.get("/dashboard/blocklist")
async def get_blocklist():
    return {"entries": await dashboard_service.list_blocklist()}


@router.post("/dashboard/blocklist")
async def add_blocklist_entry(request: BlocklistRequest):
    entry = await dashboard_service.add_blocklist_entry(request.domain, request.reason, request.added_by)
    return {"entry": entry}


@router.post("/dashboard/campaigns")
async def create_dashboard_campaign(request: CampaignCreateRequest):
    campaign = await dashboard_service.create_campaign(
        name=request.name,
        objective=request.objective,
        leads=request.leads,
        schedule=request.schedule,
    )
    return {"campaign": campaign}


@router.get("/dashboard/campaigns")
async def get_dashboard_campaigns():
    return {"campaigns": await dashboard_service.list_campaigns()}


@router.patch("/dashboard/campaigns/{campaign_id}/status")
async def update_campaign_status(campaign_id: str, request: CampaignStatusRequest):
    try:
        campaign = await dashboard_service.update_campaign_status(campaign_id, request.status)
        return {"campaign": campaign}
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.get("/dashboard/global-status")
async def get_dashboard_global_status():
    return await dashboard_service.get_global_status()


@router.get("/dashboard/global-inbox-feed")
async def get_global_inbox_feed():
    return {"items": await dashboard_service.get_global_inbox_feed()}


@router.get("/dashboard/global-analytics-feed")
async def get_global_analytics_feed():
    return {"items": await dashboard_service.get_global_analytics_feed()}
