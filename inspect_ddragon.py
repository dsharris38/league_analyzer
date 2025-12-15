import json
import requests

# Use a recent version, e.g. 14.23.1
url = "https://ddragon.leagueoflegends.com/cdn/14.23.1/data/en_US/item.json"
print("Fetching DDragon items...")
try:
    resp = requests.get(url)
    data = resp.json()
    item = data.get("data", {}).get("1055")
    if item:
        print(f"Name: {item.get('name')}")
        print(f"Description: {item.get('description')}")
        print(f"Stats: {item.get('stats')}")
    else:
        print("Item 1055 not found in DDragon.")
except Exception as e:
    print(f"Error: {e}")
