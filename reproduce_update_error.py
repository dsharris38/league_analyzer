import requests
import json

url = "http://localhost:8000/api/analyze/"
payload = {
    "riot_id": "Bingbong#nabab",
    "match_count": 55, 
    "region": "NA",
    "call_ai": False # Keep it fast for debug, but test if it fails even without AI
}

print(f"Sending POST to {url}...")
try:
    response = requests.post(url, json=payload)
    print(f"Status Code: {response.status_code}")
    try:
        print("Response JSON:")
        print(json.dumps(response.json(), indent=2))
    except:
        print("Response Text:")
        print(response.text)
except Exception as e:
    print(f"Request failed: {e}")
