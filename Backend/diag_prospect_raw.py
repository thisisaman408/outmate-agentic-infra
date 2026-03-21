import asyncio
import os
import httpx
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("EXPLORIUM_API_KEY")
BASE_URL = os.getenv("EXPLORIUM_BASE_URL", "https://api.explorium.ai/v1")

async def test_prospect_events():
    # Prospect ID from my previous search
    prospect_id = "5e6f6a7d-e599-56b4-8524-45e8ade5a507"
    
    url = f"{BASE_URL}/prospects/events"
    headers = {
        "api_key": API_KEY,
        "Content-Type": "application/json"
    }
    payload = {
        "prospect_ids": [prospect_id],
        "event_types": ["prospect_changed_company", "prospect_changed_role", "prospect_job_start_anniversary"],
        "timestamp_from": "2024-03-19T00:00:00Z"
    }
    
    print(f"URL: {url}")
    print(f"Payload: {payload}")
    
    async with httpx.AsyncClient() as client:
        resp = await client.post(url, headers=headers, json=payload)
        print(f"Status: {resp.status_code}")
        try:
            data = resp.json()
            print("Raw JSON response:")
            import json
            print(json.dumps(data, indent=2))
        except:
            print(f"Response text: {resp.text}")

if __name__ == "__main__":
    asyncio.run(test_prospect_events())
