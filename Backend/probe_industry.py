
import httpx
import json
import os
from dotenv import load_dotenv

load_dotenv()
API_KEY = os.getenv("CRUSTDATA_API_KEY")
ENDPOINT = "https://api.crustdata.com/screener/persondb/search"

def probe_column(column_name, value):
    print(f"\n--- Probing Column: {column_name} ---")
    payload = {
        "filters": {
            "column": column_name,
            "type": "in",
            "value": [value]
        },
        "limit": 1
    }
    
    headers = {
        "Authorization": f"Token {API_KEY}",
        "Content-Type": "application/json"
    }
    
    try:
        response = httpx.post(ENDPOINT, json=payload, headers=headers, timeout=10.0)
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            count = response.json().get('total_count', 0)
            print(f"✅ SUCCESS - Count: {count}")
        else:
            print(f"❌ FAIL: {response.text}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    # Test values available in linkdin_industry.json
    value = "Computer Software" 
    
    columns_to_test = [
        "current_employers.company_linkedin_industry", # Implemented
        "current_employers.industry",
        "current_employers.industries",
        "industry",
        "company_linkedin_industry"
    ]
    
    for col in columns_to_test:
        probe_column(col, value)
