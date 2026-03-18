import asyncio
import json
from app.services.explorium_service import ExploriumService

async def main():
    svc = ExploriumService()
    match_res = await svc.match_prospects([{"full_name": "Sarah Chen", "company_name": "Stripe"}])
    prospect_id = match_res["matched_prospects"][0].get("prospect_id")
    info_res = await svc.bulk_enrich_contacts_information([prospect_id])
    with open('tmp_json_out.json', 'w') as f:
        json.dump(info_res.get("data", []), f)
        
if __name__ == "__main__":
    asyncio.run(main())
