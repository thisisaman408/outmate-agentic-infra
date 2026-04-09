"""Test script to verify mandatory fields are set for all leads"""
import asyncio
import json
import logging
from app.services.database_finder_service import DatabaseFinderService

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_mandatory_fields():
    """Test that all leads have mandatory fields (full_name, title, organization)"""
    service = DatabaseFinderService()

    # Test search
    query = "VP Sales"
    location = "United States"

    logger.info(f"Testing database_finder with query='{query}', location='{location}'")

    try:
        result = await service.search(
            query=query,
            location=location,
            limit=20,
            include_signals=False  # Skip signals to speed up test
        )

        leads = result.get("leads", [])
        meta = result.get("meta", {})

        logger.info(f"Got {len(leads)} leads from search")
        logger.info(f"Meta: {json.dumps(meta, indent=2)}")

        # Verify mandatory fields
        missing_count = 0
        for i, lead in enumerate(leads):
            full_name = lead.get("full_name", "").strip()
            title = lead.get("title", "").strip()
            org = lead.get("organization_name", "").strip()

            if not full_name or not title or not org:
                missing_count += 1
                logger.error(
                    f"❌ Lead {i}: MISSING FIELDS - "
                    f"full_name='{full_name}', title='{title}', org='{org}'"
                )
            else:
                logger.info(
                    f"✅ Lead {i}: {full_name} | {title} @ {org}"
                )

        logger.warning(f"\n{'='*80}")
        if missing_count == 0:
            logger.warning(f"✅✅✅ SUCCESS! All {len(leads)} leads have mandatory fields!")
        else:
            logger.error(f"❌❌❌ FAILED! {missing_count}/{len(leads)} leads missing mandatory fields")
        logger.warning(f"{'='*80}\n")

        return missing_count == 0

    except Exception as e:
        logger.exception(f"Error during test: {e}")
        return False

if __name__ == "__main__":
    success = asyncio.run(test_mandatory_fields())
    exit(0 if success else 1)
