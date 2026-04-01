"""
Campaign Draft Generation & Send API Routes
"""

import httpx
import os
from urllib.parse import quote_plus
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse, StreamingResponse
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
from app.api.deps.auth import get_current_user, get_current_user_optional
from app.db.models.user import User
from sqlalchemy.orm import Session
from app.db.deps import get_db

logger = logging.getLogger(__name__)

router = APIRouter(tags=["campaigns"])
public_router = APIRouter(tags=["campaigns"])
dashboard_service = CampaignDashboardService()



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
async def generate_campaign_message(
    request: OpenRouterMessageRequest,
    user: Optional[User] = Depends(get_current_user_optional),
):
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
        # Initialize OpenRouterService with BYOK if user has it enabled
        api_key = None
        use_byok = False
        if user and user.use_byok and user.anthropic_api_key:
            api_key = user.anthropic_api_key
            use_byok = True

        openrouter = OpenRouterService(
            api_key=api_key,
            user_id=str(user.id) if user else None,
            use_byok=use_byok
        )

        # Build user prompt for campaign message generation
        user_prompt = f"""Generate a personalized B2B campaign message.

Objective: {request.objective}
Lead IDs: {', '.join(request.leads) if request.leads else 'general audience'}
Signal references: {', '.join(request.signals) if request.signals else 'company momentum, hiring, tech adoption'}

Requirements:
- Use {{firstName}} and {{companyName}} placeholders for personalization
- Email subject should reference the strongest signal
- Email body and LinkedIn message should offer clear value with low-friction CTA
- Keep each message under 120 words
- Output as JSON with keys: subject, email_body, linkedin_message

Return ONLY valid JSON."""

        response = await openrouter.agent_call(
            user_prompt=user_prompt,
            agent_type="campaign",
            temperature=0.7,
            max_tokens=800,
            stream=False
        )

        extracted = _extract_json_payload(response)
        return {
            "subject": extracted.get("subject", ""),
            "email_body": extracted.get("email_body", extracted.get("body", response)),
            "linkedin_message": extracted.get("linkedin_message", extracted.get("linkedin", "")),
            "raw": response,
        }
    except httpx.HTTPStatusError as exc:
        logger.error(f"Upstream HTTP error: {exc}")
        raise HTTPException(status_code=exc.response.status_code, detail="Upstream service error")
    except Exception as exc:
        logger.error(f"Campaign draft error: {exc}")
        raise HTTPException(status_code=500, detail="An error occurred generating the campaign draft")


@router.post("/generate-message-stream")
async def generate_campaign_message_stream(
    request: OpenRouterMessageRequest,
    user: Optional[User] = Depends(get_current_user_optional),
):
    """Generate campaign message with streaming support for progressive display."""
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

    async def stream_generator():
        try:
            # Initialize OpenRouterService with BYOK if user has it enabled
            api_key = None
            use_byok = False
            if user and user.use_byok and user.anthropic_api_key:
                api_key = user.anthropic_api_key
                use_byok = True

            openrouter = OpenRouterService(
                api_key=api_key,
                user_id=str(user.id) if user else None,
                use_byok=use_byok
            )

            user_prompt = f"""Generate a personalized B2B campaign message.

Objective: {request.objective}
Lead IDs: {', '.join(request.leads) if request.leads else 'general audience'}
Signal references: {', '.join(request.signals) if request.signals else 'company momentum, hiring, tech adoption'}

Requirements:
- Use {{firstName}} and {{companyName}} placeholders for personalization
- Email subject should reference the strongest signal
- Email body and LinkedIn message should offer clear value with low-friction CTA
- Keep each message under 120 words
- Output as JSON with keys: subject, email_body, linkedin_message

Return ONLY valid JSON."""

            accumulated_text = ""
            async for chunk in await openrouter.agent_call(
                user_prompt=user_prompt,
                agent_type="campaign",
                temperature=0.7,
                max_tokens=800,
                stream=True
            ):
                if chunk.get("type") == "token":
                    content = chunk.get("content", "")
                    accumulated_text += content
                    # Stream each token as SSE
                    yield f"data: {json.dumps({'type': 'chunk', 'content': content})}\n\n"

                elif chunk.get("type") == "done":
                    # Parse complete response
                    extracted = _extract_json_payload(accumulated_text)
                    final_result = {
                        "subject": extracted.get("subject", ""),
                        "email_body": extracted.get("email_body", extracted.get("body", accumulated_text)),
                        "linkedin_message": extracted.get("linkedin_message", extracted.get("linkedin", "")),
                        "raw": accumulated_text,
                    }
                    yield f"data: {json.dumps({'type': 'done', 'result': final_result})}\n\n"

        except httpx.HTTPStatusError as exc:
            logger.error(f"Upstream HTTP error: {exc}")
            yield f"data: {json.dumps({'type': 'error', 'detail': 'Upstream service error'})}\n\n"
        except Exception as exc:
            logger.error(f"Campaign stream generation error: {exc}")
            yield f"data: {json.dumps({'type': 'error', 'detail': 'An error occurred generating the campaign draft'})}\n\n"

    return StreamingResponse(
        stream_generator(),
        media_type="text/event-stream"
    )



class SendEmailRequest(BaseModel):
    to_email: str
    subject: str
    body: str
    from_email: Optional[str] = None


@router.post("/send-email")
async def send_email(request: SendEmailRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Send an email via the logged-in user's Gmail tokens."""
    try:
        service = GmailService()
        result = await service.send_email(
            user=user,
            to_email=request.to_email,
            subject=request.subject,
            body=request.body,
            db=db,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Send email error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")


@router.get("/gmail/status")
async def gmail_status(user: User = Depends(get_current_user)):
    """Check if the current user has Gmail connected."""
    service = GmailService()
    return service.is_connected(user)


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
