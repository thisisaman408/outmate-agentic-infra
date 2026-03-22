import asyncio
import os
import sys

# Add project root to path
sys.path.append(os.getcwd())

from app.db.session import SessionLocal
from app.services.copilot.lead_copilot_service import LeadCopilotService

async def test_all_actions():
    db = SessionLocal()
    service = LeadCopilotService(db)
    
    # Use a real prospect ID from the DB
    prospect_id = "9273ea9f-2327-4b58-a4ec-8d0c78e9eea1"
    
    actions = [
        "crossfire", 
        "compliance", 
        "bombora_intent", 
        "talent_radar",
        "virality",
        "regime_shift",
        "website_traffic",
        "business_events",
        "linkedin_posts"
    ]
    
    for action in actions:
        print(f"\n--- Testing Action: {action} ---")
        try:
            # Set a timeout for individual actions
            result = await asyncio.wait_for(
                service.execute_action(
                    user_id="test-user",
                    prospect_id=prospect_id,
                    action_type=action,
                    prompt="Test template for compliance audit" if action == "compliance" else None
                ),
                timeout=20
            )
            print(f"SUCCESS: {action}")
            print(f"RESULT: {str(result)[:200]}...")
        except asyncio.TimeoutError:
            print(f"TIMEOUT: {action} took too long")
        except Exception as e:
            import traceback
            print(f"ACTION FAILED: {action}")
            print(f"ERROR TYPE: {type(e).__name__}")
            print(f"ERROR: {str(e)[:500]}")
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_all_actions())
