"""
NLP Service for query categorization and filter extraction using OpenRouter
"""

import os
import httpx
from typing import Dict, Any, Optional
import logging
from fastapi import HTTPException

logger = logging.getLogger(__name__)

class NLPService:
    def __init__(self):
        self.api_key = os.getenv("OPENROUTER_API_KEY")
        self.base_url = "https://openrouter.ai/api/v1/chat/completions"
        
    async def categorize_query(self, query: str) -> Dict[str, Any]:
        """
        Use OpenRouter to categorize user query and extract filters
        """
        if not self.api_key:
            raise HTTPException(status_code=500, detail="OpenRouter API key is required for NLP categorization")
            
        try:
            prompt = f"""
            Analyze this business search query and categorize it:

            Query: "{query}"

            Return JSON response with:
            1. "intent": "prospect" or "company" 
            2. "filters": extracted filters as JSON object with these possible keys:
               - industry: array of industries
               - location: array of locations (countries, cities, states)
               - company_size: array of company sizes
               - keywords: array of relevant keywords
            3. "confidence": number 0-100 for categorization confidence

            Examples:
            "SaaS companies in USA" -> {{"intent": "company", "filters": {{"industry": ["Software"], "location": ["USA"]}}, "confidence": 90}}
            "Marketing managers in tech" -> {{"intent": "prospect", "filters": {{"industry": ["Technology"], "keywords": ["Marketing", "managers"]}}, "confidence": 85}}
            """

            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "http://localhost:3000",
                "X-Title": "Outmate AI"
            }
            
            payload = {
                "model": "anthropic/claude-sonnet-4.5",
                "messages": [
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                "temperature": 0.1,
                "max_tokens": 500
            }
            
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.post(self.base_url, headers=headers, json=payload)
                if response.status_code == 200:
                    result = response.json()
                    content = result["choices"][0]["message"]["content"]
                    
                    # Parse JSON from response
                    try:
                        # Extract JSON from the response
                        import re
                        json_match = re.search(r'\{.*\}', content)
                        if json_match:
                            parsed = json.loads(json_match.group())
                            print(f">>> [NLP] OpenRouter categorized: {parsed}", flush=True)
                            return parsed
                    except Exception as e:
                        print(f">>> [NLP] Failed to parse OpenRouter response: {e}", flush=True)
                        
                else:
                    print(f">>> [NLP] OpenRouter API error: {response.status_code}", flush=True)
                    raise HTTPException(status_code=500, detail=f"OpenRouter API error: {response.status_code}")
                    
        except Exception as e:
            print(f">>> [NLP] OpenRouter request failed: {e}", flush=True)
            raise HTTPException(status_code=500, detail=f"NLP service failed: {str(e)}")
