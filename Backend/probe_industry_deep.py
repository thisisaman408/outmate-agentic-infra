
import httpx
import json
import os
import time
from dotenv import load_dotenv

load_dotenv()
API_KEY = os.getenv("CRUSTDATA_API_KEY")
ENDPOINT = "https://api.crustdata.com/screener/persondb/search"

def probe(value_list):
    print(f"\n--- Probing Values: {value_list} ---")
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
            if count == 0:
                print("⚠️  Zero results.")
        else:
            print(f"❌ Error {response.status_code}: {response.text}")
    except Exception as e:
        print(f"Exception: {e}")

if __name__ == "__main__":
    # 1. The user's failing case
    probe(["computer-software", "internet"])
    
    # 2. Legacy vs New Taxonomy?
    # "Computer Software" -> "computer-software"
    probe(["computer-software"])
    
    # "Software Development" -> "software-development" (From input JSON)
    probe(["software-development"])
    
    # "Internet" -> "internet"
    probe(["internet"])
    
    # "Technology, Information and Internet" -> "technology-information-and-internet"
    probe(["technology-information-and-internet"])

    # Mixed validation
    probe(["software-development", "technology-information-and-internet"])
