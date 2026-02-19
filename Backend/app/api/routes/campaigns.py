"""
Campaign Draft Generation & Send API Routes
"""

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from typing import Optional
import logging

from app.services.campaign_service import CampaignService, CampaignDraftRequest, CampaignDraftResponse
from app.services.gmail_service import GmailService
from app.services.unipile_service import UnipileService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["campaigns"])


# --- Draft Generation ---

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


# --- Gmail OAuth2 ---

@router.get("/gmail/auth-url")
async def gmail_auth_url():
    """Get the Google OAuth2 authorization URL for Gmail."""
    try:
        service = GmailService()
        url = service.get_auth_url(state="campaign")
        return {"auth_url": url}
    except Exception as e:
        logger.error(f"Gmail auth URL error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/gmail/callback")
async def gmail_callback(code: str = Query(...), state: str = Query("")):
    """Handle Google OAuth2 callback - exchange code for tokens."""
    try:
        service = GmailService()
        result = await service.exchange_code(code)
        # Redirect back to the frontend with success
        return RedirectResponse(
            url=f"http://localhost:3000/ai-powered-search?gmail_connected=true&gmail_email={result['email']}"
        )
    except Exception as e:
        logger.error(f"Gmail callback error: {e}")
        return RedirectResponse(
            url=f"http://localhost:3000/ai-powered-search?gmail_connected=false&gmail_error={str(e)}"
        )


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
