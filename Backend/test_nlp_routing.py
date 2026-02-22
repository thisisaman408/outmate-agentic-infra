
import asyncio
import os
import json
import httpx
from app.services.advanced_nlp_service import AdvancedNLPService

async def test_intent_routing():
    service = AdvancedNLPService()
    
    queries = [
        "Find Marketing decision makers at digital agencies with 1 to 50 employees in Texas and Florida",
        "Find digital agencies in Texas with 1-50 employees",
        "Who are the founders of B2B SaaS companies in California?",
        "Get a list of software companies in New York"
    ]
    
    print("-" * 50)
    for query in queries:
        print(f"Testing Query: '{query}'")
        try:
            # We don't want to call the actual existing services (which require a running server)
            # so we'll mock call_existing_service or just test analyze_query
            analysis = await service.analyze_query(query)
            
            intent = analysis.get("intent")
            filters = analysis.get("filters", {})
            
            print(f"  Calculated Intent: {intent}")
            print(f"  Extracted Filters: {json.dumps(filters, indent=4)}")
            
            # Check if our rules work
            if "decision maker" in query.lower() or "founder" in query.lower():
                if intent != "prospect":
                    print(f"  Result: [FAILED] Should be 'prospect' intent")
                else:
                    print(f"  Result: [PASSED]")
            elif "digital agencies" in query.lower() and "decision maker" not in query.lower():
                if intent != "company":
                    print(f"  Result: [NOTE] Categorized as {intent}")
                else:
                    print(f"  Result: [PASSED]")
            
        except Exception as e:
            print(f"  Error: {e}")
        print("-" * 50)

if __name__ == "__main__":
    # Ensure environment variables are set or mocked if needed for embedding init
    # The service init should handle it if .env is loaded in main.py but here we might need to load it
    from dotenv import load_dotenv
    load_dotenv()
    
    asyncio.run(test_intent_routing())
