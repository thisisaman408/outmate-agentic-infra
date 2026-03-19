import asyncio
import os
import sys
import json

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "Backend")))

from app.services.explorium_service import ExploriumService

async def main():
    svc = ExploriumService()
    try:
        res = await svc.match_prospects([{"email": "gautam@Outmate.ai"}])
        print(json.dumps(res, indent=2))
    except Exception as e:
        print("Error Type:", type(e))
        print("Error Str:", str(e))
        if hasattr(e, 'response'):
            print("Response:", e.response.text)

if __name__ == "__main__":
    asyncio.run(main())
