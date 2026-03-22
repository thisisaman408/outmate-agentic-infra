import asyncio
import httpx
import time
import json

async def test_stream():
    start = time.time()
    url = "http://localhost:8000/api/copilot/product-assistant/stream"
    payload = {"question": "How does the campaign optimizer work?", "context": {}}
    
    # We need a valid token. Since we don't have one easily, let's see if we get 401.
    # Actually, we can just use the /api/copilot/product-assistant endpoint which might be secured.
    # But let's try it.
    
    print(f"Connecting to {url}...")
    try:
        async with httpx.AsyncClient() as client:
            async with client.stream("POST", url, json=payload, headers={"Authorization": "Bearer TEST"}) as response:
                print(f"Status: {response.status_code}")
                if response.status_code != 200:
                    print("Need to mock auth to test over HTTP.")
                    return
                
                first_token = False
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        if not first_token:
                            first_token = True
                            print(f"\n[TTFT] Time to first token: {time.time() - start:.2f}s")
                        print(line)
                        if '"type": "done"' in line:
                            break
                            
        print(f"\n[TOTAL] Total time: {time.time() - start:.2f}s")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_stream())
