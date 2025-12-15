import json
import requests

def check_ddragon():
    print("--- DDragon ---")
    try:
        # Get latest version
        v = requests.get("https://ddragon.leagueoflegends.com/api/versions.json").json()[0]
        url = f"https://ddragon.leagueoflegends.com/cdn/{v}/data/en_US/item.json"
        data = requests.get(url).json().get("data", {}).get("1055", {})
        
        print(f"Name: {data.get('name')}")
        print(f"Plaintext: {data.get('plaintext')}")
        print(f"Description: {data.get('description')}")
        print(f"Colloq: {data.get('colloq')}")
    except Exception as e:
        print(f"DDragon Error: {e}")

def check_cdragon():
    print("\n--- CDragon ---")
    try:
        # CommunityDragon items
        url = "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/items.json"
        items = requests.get(url).json()
        
        # Find 1055
        item = next((i for i in items if i.get("id") == 1055), None)
        if item:
            print(f"Name: {item.get('name')}")
            print(f"Description: {item.get('description')}")
            print(f"Tooltip: {item.get('tooltip')}")
        else:
            print("Item 1055 not found in CDragon.")
    except Exception as e:
        print(f"CDragon Error: {e}")

if __name__ == "__main__":
    check_ddragon()
    check_cdragon()
