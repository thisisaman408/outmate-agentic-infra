"""Debug test to trace search flow"""
import asyncio
import logging
from app.services.database_finder_service import DatabaseFinderService

logging.basicConfig(
    level=logging.DEBUG,
    format='%(levelname)s: %(message)s'
)

async def test_search(query, location="United States"):
    print(f"\n{'='*80}")
    print(f"TESTING SEARCH: '{query}' in {location}")
    print(f"{'='*80}\n")

    service = DatabaseFinderService()
    result = await service.search(
        query=query,
        location=location,
        limit=20,
        include_signals=False
    )

    leads = result.get("leads", [])
    print(f"\n{'='*80}")
    print(f"RESULT: {len(leads)} leads found")
    if leads:
        for i, lead in enumerate(leads[:3]):
            print(f"  {i+1}. {lead.get('first_name')} {lead.get('last_name')} - {lead.get('title')}")
    print(f"{'='*80}\n")

    return len(leads)

async def run_tests():
    # Test with job title (should work)
    print("\n[TEST 1] Job title search:")
    count1 = await test_search("Manager", "United States")

    # Test with company name (what we're trying to fix)
    print("\n[TEST 2] Company name search:")
    count2 = await test_search("Neemrana Hotels", "United States")

    print(f"\nSUMMARY:")
    print(f"  Job title 'Manager': {count1} leads")
    print(f"  Company name 'Neemrana Hotels': {count2} leads")

if __name__ == "__main__":
    asyncio.run(run_tests())
