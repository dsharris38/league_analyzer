
import requests
import json

def find_items():
    url = "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/items.json"
    print(f"Fetching {url}...")
    try:
        resp = requests.get(url, timeout=10)
        data = resp.json()
        print(f"Fetched {len(data)} items.")
        
        targets = [
            "Dusk", "Dawn", "Endless", "Bastion", 
            "Actualizer", "Bandle", "Whispering", "Diadem"
        ]
        
        found = []
        for item in data:
            item_id = item.get("id")
            name = item.get("name", "")
            desc = item.get("description", "")
            
            for t in targets:
                if t.lower() in name.lower():
                    print(f"FOUND: {item_id} - {name}")
                    found.append(item_id)
        
        if not found:
            print("No items found matching targets.")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    find_items()
