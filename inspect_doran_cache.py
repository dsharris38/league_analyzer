import json
import os

path = "saves/cache/meraki_items.json"
if os.path.exists(path):
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
        item = data.get("1055", {})
        print(f"Name: {item.get('name')}")
        print(f"Description: {item.get('description')}")
else:
    print("Cache file not found.")
