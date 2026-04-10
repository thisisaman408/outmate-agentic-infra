"""Diagnostic test to find where search is failing"""
import asyncio
import logging
from app.services.database_finder_service import DatabaseFinderService

logging.basicConfig(level=logging.DEBUG, format='[%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)

async def test():
    service = DatabaseFinderService()

    # Test with a simple query
    query = "Sales Manager"
    location = "United States"

    print(f"\n{'='*80}")
    print(f"DIAGNOSTIC TEST: query='{query}', location='{location}'")
    print(f"{'='*80}\n")

    try:
        result = await service.search(
            query=query,
            location=location,
            limit=10,
            include_signals=False
        )

        leads = result.get("leads", [])
        meta = result.get("meta", {})

        print(f"\n{'='*80}")
        print(f"RESULTS: {len(leads)} leads found")
        print(f"Meta: {meta}")

        if leads:
            print(f"\nFirst lead: {leads[0]}")
        else:
            print("\n❌ No leads were returned!")

        print(f"{'='*80}\n")

    except Exception as e:
        print(f"\n❌ ERROR: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test())
