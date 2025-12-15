import requests
import json

def simulate_merge():
    print("Fetching Meraki...")
    # 1. Fetch Meraki (Base Data)
    url = "https://cdn.merakianalytics.com/riot/lol/resources/latest/en-US/items.json"
    try:
        resp = requests.get(url, timeout=10)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        print(f"Meraki Fetch Error: {e}")
        return

    print("Fetching DDragon...")
    # 2. Fetch DDragon (Enrichment for Text/Description)
    try:
        # Get latest version
        v_resp = requests.get("https://ddragon.leagueoflegends.com/api/versions.json", timeout=5)
        latest_version = v_resp.json()[0]
        print(f"Version: {latest_version}")
        
        # Get DDragon Items
        dd_resp = requests.get(f"https://ddragon.leagueoflegends.com/cdn/{latest_version}/data/en_US/item.json", timeout=10)
        dd_items = dd_resp.json().get("data", {})

        # Merge Logic from views.py
        item_info = data.get("1055")
        if item_info:
            dd_item = dd_items.get("1055")
            if dd_item:
                print("Doran's Blade found in both.")
                print(f"Original Meraki Desc: {item_info.get('description')}")
                
                # Logic: Always overwrite
                if dd_item.get("description"):
                    item_info["description"] = dd_item.get("description")
                
                print(f"Merged Desc: {item_info.get('description')}")
            else:
                print("Doran's Blade NOT found in DDragon.")
        else:
            print("Doran's Blade NOT found in Meraki.")

    except Exception as e:
        print(f"DDragon Merge Error: {e}")

if __name__ == "__main__":
    simulate_merge()
