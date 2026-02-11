
import httpx
import json
import os
import sys
from dotenv import load_dotenv

load_dotenv()
API_KEY = os.getenv("CRUSTDATA_API_KEY")
ENDPOINT = "https://api.crustdata.com/screener/persondb/search"

def probe(label, value_list):
    print(f"\n--- Testing: {label} ---")
    print(f"Values: {value_list}")
    payload = {
        "filters": {
            "column": "current_employers.company_linkedin_industry",
            "type": "in",
            "value": value_list
        },
        "limit": 1
    }
    
    headers = {
        "Authorization": f"Token {API_KEY}",
        "Content-Type": "application/json"
    }
    
    try:
        response = httpx.post(ENDPOINT, json=payload, headers=headers, timeout=30.0)
        if response.status_code == 200:
            data = response.json()
            count = data.get('total_count', 0)
            print(f"✅ Count: {count}")
        else:
            print(f"❌ Error {response.status_code}: {response.text}")
    except Exception as e:
        print(f"Exception: {e}")
    
    sys.stdout.flush()

if __name__ == "__main__":
    # 1. The Legacy Term (Normalized)
    probe("Legacy: computer-software", ["computer-software"])
    
    # 2. The User's Failed Combination
    probe("User Query", ["computer-software", "internet"])
    
    # 3. The New Taxonomy Term
    probe("Modern: software-development", ["software-development"])
    
    # 4. The 'Internet' Term (User typed)
    probe("Term: internet", ["internet"])
    
    # 5. The Modern 'Internet' Term
    probe("Modern: technology-information-and-internet", ["technology-information-and-internet"])
