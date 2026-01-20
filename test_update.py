import requests
import json

# Test the analyze endpoint
url = "http://localhost:8000/api/analyze/"
data = {
    "riot_id": "Doublelift#NA1",
    "match_count": 20,
    "region": "NA",
    "force_refresh": True,
    "call_ai": False
}

print("Testing /api/analyze/ endpoint...")
print(f"POST {url}")
print(f"Data: {json.dumps(data, indent=2)}")

try:
    response = requests.post(url, json=data, timeout=60)
    print(f"\nStatus Code: {response.status_code}")
    print(f"Response: {response.text[:500]}")
except Exception as e:
    print(f"\nError: {e}")
