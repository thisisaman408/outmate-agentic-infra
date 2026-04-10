"""Step-by-step diagnostic for Tavily-only search"""
import asyncio
import logging
from app.services.database_finder_service import DatabaseFinderService

logging.basicConfig(level=logging.INFO, format='[%(levelname)s] %(message)s')

async def test():
    service = DatabaseFinderService()
    query = "Manager"
    location = "United States"

    print(f"\n{'='*80}")
    print(f"Testing Tavily-only search for: '{query}'")
    print(f"{'='*80}\n")

    # Test 1: Check Tavily API key
    print(f"[TEST 1] Tavily API Key configured: {bool(service.tavily_api_key)}")
    if service.tavily_api_key:
        key_preview = service.tavily_api_key[:10] + "****"
        print(f"         Key: {key_preview}")

    # Test 2: Run search
    print(f"\n[TEST 2] Running search...")
    try:
        result = await service.search(
            query=query,
            location=location,
            limit=10,
            include_signals=False
        )

        leads = result.get("leads", [])
        print(f"[RESULT] {len(leads)} leads found")

        if leads:
            print(f"\nFirst 3 leads:")
            for i, lead in enumerate(leads[:3]):
                print(f"  {i+1}. {lead.get('first_name')} {lead.get('last_name')} - {lead.get('title')}")
        else:
            print(f"❌ No leads returned")

    except Exception as e:
        print(f"❌ ERROR: {e}")
        import traceback
        traceback.print_exc()

    print(f"\n{'='*80}\n")

if __name__ == "__main__":
    asyncio.run(test())
