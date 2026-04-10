"""Quick test to verify search is working"""
import asyncio
import logging
from app.services.database_finder_service import DatabaseFinderService

logging.basicConfig(level=logging.WARNING)
logger = logging.getLogger(__name__)

async def test():
    service = DatabaseFinderService()
    result = await service.search(
        query="Manager",
        location="United States",
        limit=5,
        include_signals=False
    )

    leads = result.get("leads", [])
    print(f"\n{'='*80}")
    print(f"Got {len(leads)} leads")

    if leads:
        for i, lead in enumerate(leads[:3]):
            print(f"Lead {i}: {lead.get('first_name')} {lead.get('last_name')} | "
                  f"{lead.get('title')} @ {lead.get('organization_name')}")
        print("✅ Search is working!")
    else:
        print("❌ No leads found")
    print(f"{'='*80}\n")

if __name__ == "__main__":
    asyncio.run(test())
