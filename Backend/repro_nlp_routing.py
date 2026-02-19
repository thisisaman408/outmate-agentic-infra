import asyncio
import json
import os
from dotenv import load_dotenv
from app.services.advanced_nlp_service import AdvancedNLPService

load_dotenv()

async def test_repro():
    query = "Find Marketing decision makers at digital agencies with 1 to 50 employees in Texas and Florida"
    print(f"Testing query: {query}")
    
    service = AdvancedNLPService()
    
    print("\n--- Testing analyze_query ---")
    analysis = await service.analyze_query(query)
    print(json.dumps(analysis, indent=2))
    
    print("\n--- Testing process_query ---")
    # This might actually call external APIs if keys are present
    try:
        result = await service.process_query(query)
        print(f"Intent: {result.get('intent')}")
        print(f"Confidence: {result.get('confidence')}")
        print(f"Filters: {json.dumps(result.get('filters'), indent=2)}")
        print(f"Results found: {result.get('results', {}).get('total_results', 0)}")
    except Exception as e:
        print(f"Error calling process_query: {e}")

if __name__ == "__main__":
    asyncio.run(test_repro())
