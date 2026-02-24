import requests
import uuid
import time
import sys

BACKEND_URL = "http://127.0.0.1:8000"
PIXEL_KEY = "outmate_test_key_123"

def run_diagnostics():
    print(f"--- Outmate Visitor Tracker Diagnostics ---")
    
    # 1. Check Backend Connectivity
    print(f"[1/4] Checking backend connectivity at {BACKEND_URL}...")
    try:
        res = requests.get(f"{BACKEND_URL}/api/visitors/stats")
        if res.status_code == 200:
            print(f"  ✓ Backend is ONLINE. Current stats: {res.json()}")
        else:
            print(f"  ✗ Backend returned error {res.status_code}: {res.text}")
            return
    except Exception as e:
        print(f"  ✗ Backend is UNREACHABLE: {e}")
        return

    # 2. Simulate a Tracking Request
    print(f"\n[2/4] Simulating a tracking request for IP 1.1.1.1...")
    track_data = {
        "url": "http://example.com/pricing",
        "referrer": "http://google.com"
    }
    headers = {
        "X-Pixel-Key": PIXEL_KEY,
        "User-Agent": "Outmate-Diagnostic-Tool/1.0"
    }
    
    try:
        # We use Form data as per the backend implementation
        res = requests.post(f"{BACKEND_URL}/api/visitors/track", data=track_data, headers=headers)
        if res.status_code == 200:
            print(f"  ✓ Tracking request ACCEPTED. Response: {res.json()}")
        else:
            print(f"  ✗ Tracking request FAILED ({res.status_code}): {res.text}")
            print(f"    Check if the pixel_key '{PIXEL_KEY}' is correctly set in your database.")
            return
    except Exception as e:
        print(f"  ✗ Connection failed: {e}")
        return

    # 3. Check for background processing
    print(f"\n[3/4] Waiting for background enrichment (Celery)...")
    print(f"  * Please ensure your Celery worker is running in another terminal:")
    print(f"  * Command: python -m celery -A app.core.celery_app worker --loglevel=info -P solo")
    
    time.sleep(5) # Wait for processing
    
    # 4. Deep Enrichment Logic Test
    print(f"\n[4/4] Testing Enrichment Logic directly (bypassing worker)...")
    try:
        import asyncio
        from app.services.visitor_enrich import VisitorEnricher
        
        async def test_enrich():
            enricher = VisitorEnricher()
            print(f"  * Calling enrichment for 8.8.8.8...")
            res = await enricher.enrich_ip("8.8.8.8", "http://example.com/pricing", 1.0)
            print(f"  ✓ Enrichment Result:")
            import json
            print(json.dumps(res, indent=4))
            return res

        res = asyncio.run(test_enrich())
        if res.get("confidence", 0) > 0.4:
            print(f"\n  🎉 SUCCESS: Enrichment is working correctly!")
        else:
            print(f"\n  ⚠️  Confidence too low: {res.get('confidence')}. Check API keys.")
            
    except Exception as e:
        print(f"  ✗ Enrichment logic failed: {e}")

if __name__ == "__main__":
    run_diagnostics()
