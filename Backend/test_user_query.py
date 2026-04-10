"""Test with exact user query"""
import asyncio
import logging
from app.services.database_finder_service import DatabaseFinderService

logging.basicConfig(level=logging.INFO, format='[%(levelname)s] %(message)s')

async def test_user_query():
    service = DatabaseFinderService()

    print(f"\n{'='*80}")
    print(f"TEST 1: 'Manager' in 'United States' (should work)")
    print(f"{'='*80}\n")

    result1 = await service.search(
        query="Manager",
        location="United States",
        limit=5,
        include_signals=False
    )
    print(f"Result: {len(result1['leads'])} leads\n")

    print(f"{'='*80}")
    print(f"TEST 2: 'Neemrana Hotels' in 'India' (user's search)")
    print(f"{'='*80}\n")

    result2 = await service.search(
        query="Neemrana Hotels",
        location="India",
        limit=5,
        include_signals=False
    )
    print(f"Result: {len(result2['leads'])} leads")

    if result2['leads']:
        print(f"First lead: {result2['leads'][0]}")
    else:
        print("❌ No leads found for company search")

    print(f"\n{'='*80}")
    print(f"TEST 3: 'Hotel Manager' in 'India' (alternative search)")
    print(f"{'='*80}\n")

    result3 = await service.search(
        query="Hotel Manager",
        location="India",
        limit=5,
        include_signals=False
    )
    print(f"Result: {len(result3['leads'])} leads")

if __name__ == "__main__":
    asyncio.run(test_user_query())
