from fastapi import APIRouter, Depends, HTTPException, Body
from app.api.deps.auth import get_current_user
from app.db.models.user import User
from app.db.deps import get_db
from sqlalchemy.orm import Session
import httpx
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/integrations", tags=["integrations"])

@router.get("/status")
async def get_status(user: User = Depends(get_current_user)):
    """Get the connection status of all key integrations."""
    ints = user.integrations or {}
    
    # Gmail status
    gmail_connected = bool(user.gmail_access_token)
    
    # Slack, CRM, Outreach status
    status = {
        "gmail": {
            "name": "Gmail",
            "connected": gmail_connected,
            "skipped": ints.get("gmail", {}).get("skipped", False),
            "priority": "must-have"
        },
        "slack": {
            "name": "Slack",
            "connected": bool(ints.get("slack", {}).get("connected")),
            "skipped": ints.get("slack", {}).get("skipped", False),
            "priority": "must-have"
        },
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
        "outreach": {
            "name": "Outreach (Instantly/Smartlead)",
            "connected": bool(ints.get("outreach", {}).get("connected")),
            "skipped": ints.get("outreach", {}).get("skipped", False),
            "priority": "recommended"
        }
    }
    
    connected_count = sum(1 for s in status.values() if s["connected"])
    return {
        "integrations": status,
        "connected_count": connected_count,
        "total_count": 5
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
        # Instantly V1 verify endpoint
        url = "https://api.instantly.ai/1.0/account/list"
        params = {"api_key": api_key}
        headers = {}
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
                    "connected_at": str(httpx.datetime.datetime.now()),
                    "skipped": False
                }
                # We store the mask of the key for safety or the whole key if needed for functionality
                ints["outreach_api_key"] = api_key 
                user.integrations = ints
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
    services = ["gmail", "slack", "hubspot", "salesforce", "outreach"]
    for s in services:
        if s not in ints:
            ints[s] = {}
        if not ints[s].get("connected"):
            ints[s]["skipped"] = True
            
    user.integrations = ints
    db.commit()
    return {"success": True}
