import asyncio
import os
import httpx
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("EXPLORIUM_API_KEY")
BASE_URL = os.getenv("EXPLORIUM_BASE_URL", "https://api.explorium.ai/v1")

async def test_prospect_match():
    url = f"{BASE_URL}/prospects/match"
    headers = {
        "api_key": API_KEY,
        "Content-Type": "application/json"
    }
    payload = {
        "prospects_to_match": [{
            "email": "chauhanaryan5976@gmail.com"
        }]
    }
    
    async with httpx.AsyncClient() as client:
        resp = await client.post(url, headers=headers, json=payload)
        print(f"Status: {resp.status_code}")
        data = resp.json()
        import json
        print(json.dumps(data, indent=2))

if __name__ == "__main__":
    asyncio.run(test_prospect_match())
