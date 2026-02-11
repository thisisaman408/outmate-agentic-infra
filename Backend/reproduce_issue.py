
from app.utils.filter_builder import ProspectFilterBuilder
import json

def test_name_location_combination():
    builder = ProspectFilterBuilder()
    
    # Simulate user request: First Name="Mayank", Location="Indore"
    filters = builder.build(
        first_name="Mayank",
        locations=["Indore"]
    )
    
    print("\n--- Generated Filters ---")
    print(json.dumps(filters, indent=2))
    
    # Check logic
    if "op" in filters and filters["op"] == "and":
        conditions = filters["conditions"]
        has_name = any(c.get("column") == "first_name" for c in conditions)
        has_location = any(c.get("column") == "region" for c in conditions)
        
        if has_name and has_location:
            print("✅ SUCCESS: Both filters present in AND block")
        else:
            print("❌ FAILURE: Missing one or more filters")
    else:
        print("❌ FAILURE: Filters not combined with AND operator")

if __name__ == "__main__":
    test_name_location_combination()
