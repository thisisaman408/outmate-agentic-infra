
import os
import httpx
import asyncio
from dotenv import load_dotenv

load_dotenv()

EXPLORIUM_API_KEY = os.getenv("EXPLORIUM_API_KEY")
EXPLORIUM_BASE_URL = os.getenv("EXPLORIUM_BASE_URL", "https://api.explorium.ai/v1")

async def probe_categories(query: str):
    print(f"\n--- Probing categories for: {query} ---")
    url = f"{EXPLORIUM_BASE_URL}/businesses/autocomplete"
    headers = {
        "api_key": EXPLORIUM_API_KEY,
        "Content-Type": "application/json"
    }
    # Based on docs, autocomplete might support categories specifically or just general text
    # Usually autocomplete returns candidates with categories
    payload = {
        "field": "linkedin_category",
        "value": query
    }
    
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(url, headers=headers, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                print(f"✅ Success: {json.dumps(data, indent=2)}")
            else:
                print(f"❌ Error {resp.status_code}: {resp.text}")
        except Exception as e:
            print(f"Exception: {e}")

async def main():
    import json
    # Try different fields and values to find valid categories
    # The docs mention autocomplete for categories
    queries = ["soft", "tech", "infor", "fin"]
    for q in queries:
        await probe_categories(q)

if __name__ == "__main__":
    asyncio.run(main())
