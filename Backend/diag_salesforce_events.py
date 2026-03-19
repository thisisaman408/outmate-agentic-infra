import asyncio
import os
import httpx
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("EXPLORIUM_API_KEY")
BASE_URL = os.getenv("EXPLORIUM_BASE_URL", "https://api.explorium.ai/v1")

async def test_business_events():
    # Salesforce Business ID
    business_id = "4044680601076201931"
    
    url = f"{BASE_URL}/businesses/events"
    headers = {
        "api_key": API_KEY,
        "Content-Type": "application/json"
    }
    payload = {
        "business_ids": [business_id],
        "event_types": ["new_funding_round", "merger_and_acquisitions", "new_partnership", "new_product", "new_office", "employee_joined_company"],
        "timestamp_from": "2024-03-19T00:00:00Z"
    }
    
    print(f"URL: {url}")
    print(f"Business ID: {business_id}")
    
    async with httpx.AsyncClient() as client:
        resp = await client.post(url, headers=headers, json=payload)
        print(f"Status: {resp.status_code}")
        try:
            data = resp.json()
            import json
            print(json.dumps(data, indent=2))
        except:
            print(f"Response text: {resp.text}")

if __name__ == "__main__":
    asyncio.run(test_business_events())
