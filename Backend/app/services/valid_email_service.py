import logging
import httpx
from typing import List, Dict, Any, Optional
from app.core.config import settings

logger = logging.getLogger(__name__)

class ValidEmailService:
    """
    Email Prediction and Verification Service using ValidEmailAPI.com
    """
    def __init__(self):
        self.api_key = getattr(settings, "VALIDEMAIL_API_KEY", None) or ""
        self.base_url = "https://api.validemailapi.com/v1/verify"

    def predict_emails(self, first_name: str, last_name: str, domain: str) -> List[str]:
        """Generate common email patterns for a person and domain."""
        if not first_name or not domain:
            return []
        
        fn = first_name.lower().strip()
        ln = last_name.lower().strip() if last_name else ""
        d = domain.lower().strip()
        
        patterns = []
        # basic
        patterns.append(f"{fn}@{d}")
        if ln:
            patterns.append(f"{fn}.{ln}@{d}")
            patterns.append(f"{fn}{ln}@{d}")
            patterns.append(f"{fn[0]}{ln}@{d}")
            patterns.append(f"{fn}{ln[0]}@{d}")
            patterns.append(f"{fn[0]}.{ln}@{d}")
            patterns.append(f"{fn}.{ln[0]}@{d}")
            patterns.append(f"{fn}_{ln}@{d}")
            patterns.append(f"{ln}@{d}")
            patterns.append(f"{ln}.{fn}@{d}")
            
        return list(dict.fromkeys(patterns)) # Deduplicate

    async def verify_email(self, email: str) -> Dict[str, Any]:
        """Verify an email using ValidEmailAPI.com."""
        if not self.api_key:
            logger.warning("VALIDEMAIL_API_KEY not configured")
            return {"success": False, "error": "API Key not configured"}

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                params = {
                    "email": email,
                    "token": self.api_key
                }
                response = await client.get(self.base_url, params=params)
                
                if response.status_code != 200:
                    logger.error(f"ValidEmail API error: {response.status_code} - {response.text}")
                    return {"success": False, "error": f"API returned {response.status_code}"}
                
                data = response.json()
                # Use the response format provided by the user
                return {
                    "success": True,
                    "is_valid": data.get("IsValid", False),
                    "score": data.get("Score", 0),
                    "state": data.get("State", "Unknown"),
                    "reason": data.get("Reason", ""),
                    "raw": data
                }
        except httpx.ConnectError:
            logger.error(f"ValidEmail connection error: Failed to resolve {self.base_url}")
            return {"success": False, "error": "Connection error: Failed to resolve API host"}
        except httpx.TimeoutException:
            logger.error(f"ValidEmail timeout error: Request to {self.base_url} timed out")
            return {"success": False, "error": "API request timed out"}
        except Exception as e:
            logger.error(f"ValidEmail service exception: {str(e)}")
            return {"success": False, "error": f"Service error: {str(e)}"}

    async def predict_and_verify(self, first_name: str, last_name: str, domain: str) -> Optional[str]:
        """Predict multiple patterns and return the first one that passes verification."""
        emails = self.predict_emails(first_name, last_name, domain)
        if not emails:
            return None

        # Iterate through patterns and verify
        # To avoid too many API calls, we could limit this or do it in parallel
        # For now, let's do it sequentially but we could use asyncio.gather
        
        for email in emails:
            result = await self.verify_email(email)
            if result.get("success") and result.get("is_valid") and result.get("score", 0) >= 80:
                logger.info(f"Predicted and verified email: {email} (Score: {result['score']})")
                return email
        
        return None
