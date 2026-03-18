import asyncio
import json
from app.services.explorium_service import ExploriumService

async def main():
    svc = ExploriumService()
    print("Testing match_prospects...")
    match_res = await svc.match_prospects([{"full_name": "Sarah Chen", "company_name": "Stripe"}])
    print(json.dumps(match_res, indent=2))
    
    if match_res.get("matched_prospects"):
        prospect_id = match_res["matched_prospects"][0].get("prospect_id")
        print(f"Matched prospect ID: {prospect_id}")
        if prospect_id:
            print("Fetching prospect events...")
            events_res = await svc.fetch_prospect_events(
                [prospect_id],
                ["prospect_changed_role", "prospect_changed_company", "prospect_job_start_anniversary"]
            )
            print(json.dumps(events_res, indent=2))

            # Fetch full prospect info
            print("Fetching prospect full profile...")
            # If there's an endpoint
            
if __name__ == "__main__":
    asyncio.run(main())
