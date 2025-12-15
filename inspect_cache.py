import json
import requests

url = "https://cdn.merakianalytics.com/riot/lol/resources/latest/en-US/items.json"
print("Fetching Meraki items...")
resp = requests.get(url)
data = resp.json()

# Inspect 'stats'
for item_id, item in list(data.items())[:5]:
    print(f"Item: {item.get('name')} (ID: {item_id})")
    stats = item.get('stats', {})
    print(f"Stats Keys: {list(stats.keys())}")
    for k, v in stats.items():
        print(f"  {k}: {v} (Type: {type(v)})")
    print("-" * 20)
