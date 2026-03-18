
import asyncio
import time
import json
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.services.copilot.lead_copilot_service import LeadCopilotService
from app.core.redis import RedisManager

async def test_caching_performance():
    db = SessionLocal()
    service = LeadCopilotService(db)
    
    # Use a real prospect ID from your DB if available, otherwise this will use mock if MOCK_LLM=true
    prospect_id = "9273ea9f-2327-4b58-a4ec-8d0c78e9eea1" 
    action_type = "research"
    
    print(f"--- Testing Caching for Action: {action_type} ---")
    
    # 1. First Run (Cache Miss/Populate)
    print("\n[Run 1] Executing action (First time)...")
    start_time = time.time()
    result1 = await service.execute_action(
        user_id="test_user",
        prospect_id=prospect_id,
        action_type=action_type,
        context_overrides={"refresh": True} # Force refresh to ensure we hit the source
    )
    end_time = time.time()
    duration1 = end_time - start_time
    print(f"Run 1 Duration: {duration1:.2f} seconds")
    
    # 2. Second Run (Cache Hit)
    print("\n[Run 2] Executing action (Cached)...")
    start_time = time.time()
    result2 = await service.execute_action(
        user_id="test_user",
        prospect_id=prospect_id,
        action_type=action_type,
        context_overrides={} # Should hit cache
    )
    end_time = time.time()
    duration2 = end_time - start_time
    print(f"Run 2 Duration: {duration2:.2f} seconds")
    
    if duration2 < 1.0:
        print("\n✅ SUCCESS: Cache hit was instant (< 1s)")
    else:
        print("\n❌ FAILURE: Cache hit took longer than expected")
        
    print(f"Speedup Factor: {duration1/duration2:.1f}x faster")
    
    db.close()

if __name__ == "__main__":
    # Ensure Redis is connected
    RedisManager.connect()
    asyncio.run(test_caching_performance())
