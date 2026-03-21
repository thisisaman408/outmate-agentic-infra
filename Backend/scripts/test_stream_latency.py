import asyncio
import time
import sys
import os

# Ensure the app context is available
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import SessionLocal
from app.services.copilot.product_assistant_service import ProductAssistantService

async def measure_latency():
    db = SessionLocal()
    try:
        service = ProductAssistantService(db)
        question = "How does the campaign optimizer work?"
        
        print(f"Asking: {question}")
        start_time = time.time()
        
        first_token_time = None
        
        async for chunk in service.stream_ask(question=question):
            if first_token_time is None:
                first_token_time = time.time()
                print(f"\n[TTFT] Time to first token: {first_token_time - start_time:.2f}s")
            
            if chunk.get("type") == "token":
                print(chunk.get("content", ""), end="", flush=True)
            elif chunk.get("type") == "done":
                print("\n\n[DONE] Final Result:")
                print(chunk.get("result"))
                
        end_time = time.time()
        print(f"\n[TOTAL] Total time: {end_time - start_time:.2f}s")

    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(measure_latency())
