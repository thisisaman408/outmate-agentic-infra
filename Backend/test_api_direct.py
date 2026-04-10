"""Test the actual API endpoint"""
import asyncio
import httpx

async def test_api():
    # Test calling the API directly
    url = "http://127.0.0.1:8001/api/database_finder/search"

    payload = {
        "query": "Neemrana Hotels",
        "location": "India",
        "limit": 10,
        "include_signals": False
    }

    # Use a dummy auth token (you'll need a real one)
    headers = {
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(url, json=payload, headers=headers, timeout=180)
            print(f"Status: {response.status_code}")
            print(f"Response: {response.json()}")
        except Exception as e:
            print(f"Error: {e}")

asyncio.run(test_api())
