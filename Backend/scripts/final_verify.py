import requests
import time
import uuid

# Configuration
BACKEND_URL = "http://127.0.0.1:8000"
PIXEL_KEY = "outmate_test_key_123"

def test_visitor_flow():
    print("🚀 Starting End-to-End Visitor Tracking Test")
    
    # 1. Send Tracking Request
    print("\nStep 1: Sending tracking request for a new IP (1.1.1.1)...")
    headers = {
        "X-Pixel-Key": PIXEL_KEY,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Test/1.0"
    }
    data = {
        "url": "http://localhost:3000/pricing",
        "referrer": "https://google.com"
    }
    
    try:
        res = requests.post(f"{BACKEND_URL}/api/visitors/track", data=data, headers=headers)
        if res.status_code == 200:
            print("  ✅ Tracking request accepted by backend.")
        else:
            print(f"  ❌ Backend error ({res.status_code}): {res.text}")
            return
    except Exception as e:
        print(f"  ❌ Connection failed: {e}")
        print("     Ensure backend is running: python -m uvicorn app.main:app --host 127.0.0.1 --port 8000")
        return

    # 2. Inform user about the worker
    print("\nStep 2: Processing in background...")
    print("  ⚠️ IMPORTANT: Make sure your Celery worker is running in another terminal!")
    print("  Command: python -m celery -A app.core.celery_app worker --loglevel=info -P solo")
    
    print("\nWaiting 10 seconds for enrichment to complete...")
    for i in range(10, 0, -1):
        print(f"  {i}...", end="\r")
        time.sleep(1)
    
    # 3. Check Dashboard Stats
    print("\n\nStep 3: Verifying enrichment in dashboard data...")
    try:
        res = requests.get(f"{BACKEND_URL}/api/visitors/")
        if res.status_code == 200:
            visits = res.json()
            # Find our visit
            latest = next((v for v in visits if v['ip'] == "1.1.1.1"), None)
            if latest:
                print(f"  ✅ Visit found in dashboard!")
                print(f"  🔍 Status: {'SUCCESS' if latest['matched'] else 'STILL RESOLVING'}")
                print(f"  🏢 Company: {latest.get('resolution', {}).get('company', 'None')}")
                if latest['matched']:
                    print("\n🎉 CONGRATULATIONS! The visitor tracking and enrichment is working perfectly.")
                else:
                    print("\n⚠️ Enrichment is still pending. Ensure the Celery worker is active and has no errors.")
            else:
                print("  ❌ Visit not found in recent records. Check Redis/Worker connection.")
        else:
            print(f"  ❌ Dashboard API error: {res.text}")
    except Exception as e:
        print(f"  ❌ Failed to verify: {e}")

if __name__ == "__main__":
    test_visitor_flow()
