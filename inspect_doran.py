import json
import requests

url = "https://cdn.merakianalytics.com/riot/lol/resources/latest/en-US/items.json"
print("Fetching Meraki items from CDN...")
try:
    resp = requests.get(url)
    data = resp.json()
    item = data.get("1055")
    if item:
        print(f"Name: {item.get('name')}")
        print(f"Lifesteal: {item.get('stats', {}).get('lifesteal')}")
        print(f"Omnivamp: {item.get('stats', {}).get('omnivamp')}")
        print(f"Description: {item.get('description')}")
        print(f"Passives: {json.dumps(item.get('passives'), indent=2)}")
    else:
        print("Item 1055 not found.")
except Exception as e:
    print(f"Error: {e}")
