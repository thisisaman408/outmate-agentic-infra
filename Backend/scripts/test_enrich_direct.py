
import asyncio
import json
import os
from app.services.visitor_enrich import VisitorEnricher

async def test():
    try:
        enricher = VisitorEnricher()
        print("Starting enrichment test for 8.8.8.8...")
        res = await enricher.enrich_ip("8.8.8.8", "http://example.com/pricing", 1.0)
        
        output_file = "scripts/test_output.json"
        with open(output_file, "w") as f:
            json.dump(res, f, indent=4)
        print(f"Results written to {output_file}")
    except Exception as e:
        print(f"Test failed: {e}")
        with open("scripts/test_error.txt", "w") as f:
            f.write(str(e))

if __name__ == "__main__":
    asyncio.run(test())
