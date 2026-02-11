"""
Person Enrichment Service for CrustData API

Handles business email enrichment for prospect profiles.
Endpoint: GET /screener/person/enrich
Cost: 5 credits per enrichment (3 profile + 2 email)
"""

from typing import Optional, Dict, Any, List
import httpx
from app.core.config import settings


class PersonEnrichmentService:
    """Service for enriching person profiles with business email data"""
    
    def __init__(self):
        self.base_url = "https://api.crustdata.com"
        self.endpoint = "/screener/person/enrich"
        self.auth_token = settings.CRUSTDATA_API_KEY
        
    async def enrich_person_email(
        self,
        linkedin_profile_url: str,
        enrich_realtime: bool = False
    ) -> Dict[str, Any]:
        """
        Enrich a person profile with business email
        
        Args:
            linkedin_profile_url: Full LinkedIn profile URL
            enrich_realtime: Whether to fetch in real-time (5 credits) or from DB (3 credits)
            
        Returns:
            dict: Enrichment data containing business_email
            
        Raises:
            HTTPException: If enrichment fails
            
        Example Response:
            {
                "business_email": ["john@company.com"],
                "current_employers": [{
                    "employer_name": "Company",
                    "business_emails": {
                        "john@company.com": {
                            "verification_status": "verified",
                            "last_validated_at": "2024-02-01"
                        }
                    }
                }],
                "enriched_realtime": false,
                "query_linkedin_profile_urn_or_slug": ["john-doe"]
            }
        """
        
        # Construct query parameters
        params = {
            "linkedin_profile_url": linkedin_profile_url,
            "fields": "business_email",  # Only request email to minimize credits
            "enrich_realtime": str(enrich_realtime).lower()
        }
        
        # Make API request
        headers = {
            "Authorization": f"Token {self.auth_token}",
            "Accept": "application/json",
            "Content-Type": "application/json"
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.get(
                    f"{self.base_url}{self.endpoint}",
                    params=params,
                    headers=headers
                )
                
                # Handle different response codes
                if response.status_code == 200:
                    try:
                        data = response.json()
                        
                        # DEBUG: Log response structure
                        import logging
                        logger = logging.getLogger(__name__)
                        logger.info(f"CrustData response type: {type(data)}")
                        logger.info(f"CrustData response: {data}")
                        
                        # API returns array of profiles
                        if isinstance(data, list):
                            if len(data) > 0:
                                profile_data = data[0]
                                
                                # Extract business email
                                business_email = profile_data.get("business_email", [])
                                
                                return {
                                    "success": True,
                                    "business_email": business_email,
                                    "enriched_at": profile_data.get("last_updated"),
                                    "verification_status": self._get_email_verification_status(profile_data),
                                    "credits_used": 5
                                }
                            else:
                                # Empty list
                                return {
                                    "success": False,
                                    "error": "No data found - empty response",
                                    "error_code": "PE03"
                                }
                        elif isinstance(data, dict):
                            # Single profile object (non-standard response)
                            business_email = data.get("business_email", [])
                            
                            return {
                                "success": True,
                                "business_email": business_email,
                                "enriched_at": data.get("last_updated"),
                                "verification_status": self._get_email_verification_status(data),
                                "credits_used": 5
                            }
                        else:
                            # Unexpected response type
                            return {
                                "success": False,
                                "error": f"Unexpected response type: {type(data)}",
                                "error_code": "PE03"
                            }
                    except Exception as e:
                        logger.error(f"Error parsing 200 response: {str(e)}")
                        return {
                            "success": False,
                            "error": f"Failed to parse success response: {str(e)}",
                            "error_code": "PARSE_ERROR"
                        }
                        
                elif response.status_code == 404:
                    # Profile not found
                    try:
                        error_data = response.json()
                        if isinstance(error_data, dict):
                            return {
                                "success": False,
                                "error": error_data.get("message", "Profile not found"),
                                "error_code": error_data.get("error_code", "PE01")
                            }
                        else:
                            return {
                                "success": False,
                                "error": "Profile not found",
                                "error_code": "PE01"
                            }
                    except Exception:
                        return {
                            "success": False,
                            "error": "Profile not found",
                            "error_code": "PE01"
                        }
                    
                elif response.status_code == 400:
                    # Invalid request
                    try:
                        error_data = response.json()
                        if isinstance(error_data, dict):
                            return {
                                "success": False,
                                "error": error_data.get("message", "Invalid request"),
                                "error_code": "INVALID_REQUEST"
                            }
                        else:
                            return {
                                "success": False,
                                "error": "Invalid request",
                                "error_code": "INVALID_REQUEST"
                            }
                    except Exception:
                        return {
                            "success": False,
                            "error": "Invalid request",
                            "error_code": "INVALID_REQUEST"
                        }
                    
                else:
                    # Other errors
                    return {
                        "success": False,
                        "error": f"Enrichment failed with status {response.status_code}",
                        "error_code": "PE02"
                    }
                    
            except httpx.TimeoutException:
                return {
                    "success": False,
                    "error": "Request timeout - enrichment taking too long",
                    "error_code": "TIMEOUT"
                }
            except httpx.RequestError as e:
                return {
                    "success": False,
                    "error": f"Network error: {str(e)}",
                    "error_code": "NETWORK_ERROR"
                }
            except Exception as e:
                import logging
                logger = logging.getLogger(__name__)
                logger.error(f"Unexpected error in enrich_person_email: {str(e)}")
                return {
                    "success": False,
                    "error": f"Unexpected error: {str(e)}",
                    "error_code": "UNKNOWN_ERROR"
                }
    
    def _get_email_verification_status(self, profile_data: Dict[str, Any]) -> Optional[str]:
        """Extract email verification status from employer data"""
        try:
            current_employers = profile_data.get("current_employers", [])
            if current_employers and len(current_employers) > 0:
                employer = current_employers[0]
                business_emails = employer.get("business_emails", {})
                
                # Get first email's verification status
                for email, email_data in business_emails.items():
                    return email_data.get("verification_status", "unknown")
            
            return "unknown"
        except Exception:
            return "unknown"
    
    async def enrich_multiple_persons(
        self,
        linkedin_urls: List[str],
        enrich_realtime: bool = False
    ) -> List[Dict[str, Any]]:
        """
        Enrich multiple persons (up to 25) in a single request
        
        Args:
            linkedin_urls: List of LinkedIn profile URLs (max 25)
            enrich_realtime: Whether to fetch in real-time
            
        Returns:
            List of enrichment results
        """
        if len(linkedin_urls) > 25:
            raise ValueError("Maximum 25 profiles can be enriched at once")
        
        # Comma-separated URLs
        urls_param = ",".join(linkedin_urls)
        
        params = {
            "linkedin_profile_url": urls_param,
            "fields": "business_email",
            "enrich_realtime": str(enrich_realtime).lower()
        }
        
        headers = {
            "Authorization": f"Token {self.auth_token}",
            "Accept": "application/json",
            "Content-Type": "application/json"
        }
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.get(
                f"{self.base_url}{self.endpoint}",
                params=params,
                headers=headers
            )
            
            if response.status_code == 200:
                profiles = response.json()
                
                # Process each profile
                results = []
                for profile in profiles:
                    results.append({
                        "linkedin_url": f"https://linkedin.com/in/{profile.get('query_linkedin_profile_urn_or_slug', ['unknown'])[0]}",
                        "business_email": profile.get("business_email", []),
                        "enriched_at": profile.get("last_updated")
                    })
                
                return results
            else:
                raise Exception(f"Batch enrichment failed with status {response.status_code}")
