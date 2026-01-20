import requests
import json
import time

# Test update endpoint
url = "http://localhost:8000/api/analyze/"

# First, let's check what analyses exist
print("Checking existing analyses...")
list_response = requests.get("http://localhost:8000/api/analyses/")
print(f"Status: {list_response.status_code}")

if list_response.status_code == 200:
    analyses = list_response.json()
    if analyses:
        # Try to update the first one
        first = analyses[0]
        print(f"\nTrying to update: {first.get('riot_id')}")
        
        # Extract info
        game_name = first.get('game_name', '')
        tag_line = first.get('tag_line', '')
        riot_id = f"{game_name}#{tag_line}"
        match_count = first.get('match_count_requested', 20)
        region = first.get('region', 'NA')
        
        print(f"RiotID: {riot_id}")
        print(f"Match Count: {match_count}")
        print(f"Region: {region}")
        
        # Test Stage 1 (matches only)
        print("\n--- Testing Stage 1 (call_ai=false) ---")
        data = {
            "riot_id": riot_id,
            "match_count": match_count,
            "region": region,
            "force_refresh": True,
            "call_ai": False
        }
        
        print(f"POST {url}")
        print(f"Data: {json.dumps(data, indent=2)}")
        
        try:
            response = requests.post(url, json=data, timeout=120)
            print(f"\nStatus: {response.status_code}")
            print(f"Response: {response.text[:1000]}")
        except Exception as e:
            print(f"\nError: {e}")
            import traceback
            traceback.print_exc()
    else:
        print("No analyses found!")
else:
    print(f"Failed to list analyses: {list_response.text}")
