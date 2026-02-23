
import asyncio
import os
import json
from app.services.explorium_service import ExploriumService
from dotenv import load_dotenv

load_dotenv()

async def test_search():
    service = ExploriumService()
    filters = {
        "location": ["United States", "Canada", "Mexico"],
        "industry": ["Software"],
        "company_type": ["B2B"],
        "keywords": ["SaaS", "B2B"]
    }
    log_file = "search_debug_direct.log"
    with open(log_file, "w", encoding="utf-8") as f:
        import sys
        old_stdout = sys.stdout
        old_stderr = sys.stderr
        sys.stdout = f
        sys.stderr = f
        try:
            print(f">>> Testing search with filters: {filters}")
            result_dict = await service.search_companies(filters, limit=3)
            companies = result_dict.get("companies") or []
            print(f"✅ Success! Found {len(companies)} companies.")
            for i, c in enumerate(companies):
                print(f"  {i+1}. {c.get('name')} ({c.get('industry')})")
        except Exception as e:
            import traceback
            traceback.print_exc()
            print(f"❌ Error during search: {e}")
        finally:
            sys.stdout = old_stdout
            sys.stderr = old_stderr

if __name__ == "__main__":
    asyncio.run(test_search())
