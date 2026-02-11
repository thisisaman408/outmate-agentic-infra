
import asyncio
import os
import sys

# Add the project root to sys.path
sys.path.append(os.getcwd())

from app.services.explorium_service import ExploriumService

async def debug_search():
    # Ensure API key is set for the test session if not in environment
    if not os.getenv("EXPLORIUM_API_KEY"):
        print("WARNING: EXPLORIUM_API_KEY not set. Test will likely fail.")
    
    svc = ExploriumService()
    filters = {"company_name": "Zoominfo"}
    limit = 5
    
    print(f"--- Debugging search with filters: {filters} ---")
    
    # Test Match
    name = filters.get("name") or filters.get("company_name")
    print(f"Testing match with name: {name}")
    try:
        inputs = [{"name": name}]
        match_res = await svc.match_businesses(inputs)
        print(f"Raw Match Response: {match_res}")
        
        matched = match_res.get("matched_businesses") or match_res.get("matches") or []
        print(f"Extracted matched count: {len(matched)}")
        
        if matched:
            for i, item in enumerate(matched[:2]):
                bid = item.get("business_id") or (item.get("business", {}) if isinstance(item.get("business"), dict) else {}).get("business_id")
                print(f"Match {i}: business_id={bid}")
    except Exception as e:
        print(f"Match error: {e}")

    # Test Fetch fallback
    print("\nTesting fetch fallback...")
    try:
        # Check mapping
        mapped = svc._map_filters(filters)
        print(f"Mapped filters for fetch: {mapped}")
        
        raw_fetch = await svc.fetch_businesses(filters, size=limit)
        print(f"Raw Fetch Data count: {len(raw_fetch.get('data', [])) if raw_fetch.get('data') else 0}")
        if raw_fetch.get('data'):
            print(f"First result name: {raw_fetch['data'][0].get('name') or raw_fetch['data'][0].get('business_name')}")
    except Exception as e:
        print(f"Fetch error: {e}")

if __name__ == "__main__":
    asyncio.run(debug_search())
