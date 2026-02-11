
import httpx
import json
import os
import sys
from dotenv import load_dotenv

load_dotenv()
API_KEY = os.getenv("CRUSTDATA_API_KEY")
ENDPOINT = "https://api.crustdata.com/screener/persondb/search"

def inspect_profile():
    print(f"\n--- Inspecting Profile Structure ---")
    # Fetch a generic profile (no filters)
    payload = {
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
            profiles = data.get('profiles', [])
            if not profiles:
                print("❌ No profiles returned.")
                return

            profile = profiles[0]
            curr_employers = profile.get('current_employers', [])
            
            print(f"Profile found: {profile.get('name', 'Unknown')}")
            
            # Dump current_employers to see industry fields
            print("\n--- Current Employers Dump ---")
            print(json.dumps(curr_employers, indent=2))
            
            # Check root level fields too
            print("\n--- Root Keys ---")
            print(list(profile.keys()))
            
        else:
            print(f"❌ Error {response.status_code}: {response.text}")
    except Exception as e:
        print(f"Exception: {e}")
    
    sys.stdout.flush()

if __name__ == "__main__":
    inspect_profile()
