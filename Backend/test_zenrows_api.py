"""Test ZenRows API directly"""
import httpx
import asyncio

async def test_zenrows():
    api_key = "b7d8d1659a1ddcbcfd0e5a7247d27aa918c8a1fb"
    test_url = "https://www.example.com"

    params = {
        "apikey": api_key,
        "url": test_url,
        "mode": "auto"
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get("https://api.zenrows.com/v1/", params=params, timeout=10)
            print(f"Status Code: {response.status_code}")
            print(f"Response: {response.text[:500]}")
        except Exception as e:
            print(f"Error: {e}")

asyncio.run(test_zenrows())
